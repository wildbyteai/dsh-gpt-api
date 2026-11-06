import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
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
