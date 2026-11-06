import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { apply, Config } from '../index.js';

const defaults = { baseURL: 'https://api.openai.com/v1', apiKeyEnv: 'DSH_GPT_API_KEY', textModel: 'test-gpt', imageModel: 'test-image', textAPI: 'responses', timeoutMs: 1000 };
function mount(overrides = {}) {
  const tools = new Map();
  const ctx = {
    tools: { register: tool => tools.set(tool.name, tool) },
    credentials: { resolve: async () => undefined },
    workingDirectory: { ensure: async () => process.cwd() },
    sandboxPolicy: { resolve: () => ({ mode: 'read-only', workspaceRoot: process.cwd() }) },
    get: () => undefined,
    inject: () => {},
    ...overrides,
  };
  const values = { ...defaults };
  const config = Object.fromEntries(Object.keys(values).map(key => [key, { get: () => values[key] }]));
  apply(ctx, config);
  return { tools, ctx, values };
}
const exec = () => ({ signal: new AbortController().signal, agent: { session: {} } });

test('configured model defaults use GPT 6.1 Sol and GPT Image 2.6 Flare', () => {
  assert.equal(Config.dict.textModel.meta.default, 'gpt-6.1-sol');
  assert.equal(Config.dict.imageModel.meta.default, 'gpt-image-2.6-flare');
  assert.equal(Config.dict.textModel.meta.volatile, true);
  assert.equal(Config.dict.imageModel.meta.volatile, true);
});

test('native Host registers exactly three conversation tools', () => {
  const { tools } = mount();
  assert.deepEqual([...tools.keys()], ['gpt_models', 'gpt_call', 'gpt_image']);
});

test('native image tool exposes reference image paths as a string array', () => {
  const { tools } = mount();
  const parameter = tools.get('gpt_image').parameters.properties.reference_images;
  assert.equal(parameter.type, 'array');
  assert.equal(parameter.items.type, 'string');
});

test('missing credentials produce actionable configuration guidance', async () => {
  const { tools } = mount();
  await assert.rejects(tools.get('gpt_models').execute({}, exec()), /插件 → GPT API/);
});

test('read-only image generation stops before credential lookup or network', async () => {
  let resolutions = 0;
  const { tools } = mount({ credentials: { resolve: async () => { resolutions++; return { value: 'fixture-key' }; } } });
  await assert.rejects(tools.get('gpt_image').execute({ prompt: 'test' }, exec()), /只读/);
  assert.equal(resolutions, 0);
});

test('native image tool saves original file and renders attachment block', async t => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF5sAAAAASUVORK5CYII=', 'base64');
  const server = createServer(async (req, res) => {
    for await (const _chunk of req) { /* consume request */ }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const cwd = await mkdtemp(join(tmpdir(), 'gpt-host-test-'));
  t.after(async () => { server.closeAllConnections(); server.close(); await rm(cwd, { recursive: true, force: true }); });
  const attachment = { kind: 'image', id: 'fixture-image', mediaType: 'image/png', width: 1, height: 1, bytes: png.length };
  const { tools, values } = mount({
    credentials: { resolve: async ref => { assert.equal(ref, 'DSH_GPT_API_KEY'); return { value: 'fixture-key' }; } },
    workingDirectory: { ensure: async () => cwd },
    sandboxPolicy: { resolve: () => ({ mode: 'workspace-write', workspaceRoot: cwd }) },
    get: name => name === 'attachments' ? { saveImage: async input => { assert.deepEqual(input.data, png); return attachment; } } : undefined,
  });
  values.baseURL = `http://127.0.0.1:${server.address().port}/v1`;
  const tool = tools.get('gpt_image');
  const value = await tool.execute({ prompt: 'fixture image' }, exec());
  assert.deepEqual(await readFile(value.files[0].path), png);
  assert.deepEqual(value.attachments, [attachment]);
  assert.equal(tool.output.render({}, value)[1].type, 'image');
  assert.equal(JSON.stringify(value).includes('fixture-key'), false);
});

test('native tool uploads reference bytes and saves a new image without changing the source', async t => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF5sAAAAASUVORK5CYII=', 'base64');
  const root = await mkdtemp(join(tmpdir(), 'gpt-host-ref-'));
  const cwd = join(root, 'draft');
  await mkdir(cwd);
  const source = join(root, 'reference.png');
  await writeFile(source, png);
  let received;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received = { path: req.url, contentType: req.headers['content-type'], body: Buffer.concat(chunks) };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); server.close(); await rm(root, { recursive: true, force: true }); });
  const { tools, values } = mount({
    credentials: { resolve: async () => ({ value: 'fixture-key' }) },
    workingDirectory: { ensure: async () => cwd },
    sandboxPolicy: { resolve: () => ({ mode: 'workspace-write', workspaceRoot: root }) },
  });
  values.baseURL = `http://127.0.0.1:${server.address().port}/v1`;
  const result = await tools.get('gpt_image').execute({ prompt: 'keep the reference composition', reference_images: ['../reference.png'] }, exec());
  assert.equal(received.path, '/v1/images/edits');
  const form = await new Response(received.body, { headers: { 'content-type': received.contentType } }).formData();
  const uploaded = form.getAll('image[]');
  assert.equal(uploaded.length, 1);
  assert.deepEqual(Buffer.from(await uploaded[0].arrayBuffer()), png);
  assert.deepEqual(await readFile(source), png);
  assert.deepEqual(await readFile(result.files[0].path), png);
  assert.notEqual(result.files[0].path, source);
  assert.ok(result.files[0].path.startsWith(join(await realpath(cwd), 'output', 'gpt-api')));
  assert.deepEqual(result.references, [{ name: 'reference.png', sha256: createHash('sha256').update(png).digest('hex') }]);
  assert.equal(JSON.stringify(result).includes('fixture-key'), false);
  assert.equal(JSON.stringify(result).includes(png.toString('base64')), false);
});

test('native tool checks reference workspace before resolving the API key', async t => {
  const root = await mkdtemp(join(tmpdir(), 'gpt-host-ref-root-'));
  const outside = await mkdtemp(join(tmpdir(), 'gpt-host-ref-out-'));
  t.after(() => Promise.all([root, outside].map(path => rm(path, { recursive: true, force: true }))));
  const source = join(outside, 'outside.png');
  await writeFile(source, Buffer.from('iVBORw0KGgo=', 'base64'));
  let resolutions = 0;
  const { tools } = mount({
    credentials: { resolve: async () => { resolutions++; return { value: 'fixture-key' }; } },
    workingDirectory: { ensure: async () => root },
    sandboxPolicy: { resolve: () => ({ mode: 'workspace-write', workspaceRoot: root }) },
  });
  await assert.rejects(tools.get('gpt_image').execute({ prompt: 'test', reference_images: [source] }, exec()), /工作区内/);
  assert.equal(resolutions, 0);
});
