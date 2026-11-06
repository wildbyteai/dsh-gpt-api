import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fsPromises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GPTClient, endpoint, imageType, saveImages } from '../api.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF5sAAAAASUVORK5CYII=', 'base64');
const defaults = { textModel: 'test-gpt', imageModel: 'test-image', textAPI: 'responses', timeoutMs: 3000 };
async function fixture(t, handler) {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : undefined;
    await handler(req, res, body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}/v1`;
}
const reply = (res, value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };

test('endpoint preserves /v1 and validates transport', () => {
  assert.equal(endpoint('https://api.openai.com/v1/', 'models'), 'https://api.openai.com/v1/models');
  for (const base of ['file:///tmp/x', 'https://u:p@example.com/v1', 'http://remote.example/v1', 'https://a.test/v1?token=x']) assert.throws(() => endpoint(base, 'models'));
});

test('Responses text call sends chosen context, extracts text and usage', async t => {
  const baseURL = await fixture(t, (req, res, body) => {
    assert.equal(req.url, '/v1/responses');
    assert.equal(req.headers.authorization, 'Bearer fixture-key');
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 128);
    assert.match(body.input, /explicit-context/);
    assert.equal(body.instructions, 'Be concise');
    reply(res, { model: 'test-gpt', output: [{ type: 'message', content: [{ type: 'output_text', text: 'fixture response' }] }], usage: { output_tokens: 3 } });
  });
  const result = await new GPTClient({ ...defaults, baseURL }, 'fixture-key').call({ prompt: 'hello', context: 'explicit-context', instructions: 'Be concise', max_output_tokens: 128 });
  assert.equal(result.text, 'fixture response');
  assert.equal(result.usage.output_tokens, 3);
});

test('Chat Completions compatibility uses messages and max_completion_tokens', async t => {
  const baseURL = await fixture(t, (req, res, body) => {
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.messages[1].content, 'hello');
    assert.equal(body.max_completion_tokens, 4096);
    reply(res, { choices: [{ message: { content: 'chat reply' } }] });
  });
  assert.equal((await new GPTClient({ ...defaults, textAPI: 'chat-completions', baseURL }, 'fixture-key').call({ prompt: 'hello', instructions: 'short' })).text, 'chat reply');
});

test('models endpoint sorts names', async t => {
  const baseURL = await fixture(t, (req, res) => { assert.equal(req.method, 'GET'); reply(res, { data: [{ id: 'z' }, { id: 'a' }] }); });
  assert.deepEqual(await new GPTClient({ ...defaults, baseURL }, 'fixture-key').models(), ['a', 'z']);
});

test('image generation decodes real PNG and creates unique files', async t => {
  const baseURL = await fixture(t, (req, res, body) => {
    assert.equal(req.url, '/v1/images/generations');
    assert.equal(body.n, 1);
    assert.equal(body.output_format, 'png');
    assert.equal(body.response_format, undefined);
    reply(res, { data: [{ b64_json: PNG.toString('base64') }], usage: { total_tokens: 1 } });
  });
  const result = await new GPTClient({ ...defaults, baseURL }, 'fixture-key').image({ prompt: 'test image' });
  const cwd = await mkdtemp(join(tmpdir(), 'gpt-api-test-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const first = await saveImages(cwd, result);
  const second = await saveImages(cwd, result);
  assert.notEqual(first.files[0].path, second.files[0].path);
  assert.deepEqual(await readFile(first.files[0].path), PNG);
  assert.equal(first.usage.total_tokens, 1);
});

test('image output does not follow a symlink outside working directory', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'gpt-cwd-'));
  const outside = await mkdtemp(join(tmpdir(), 'gpt-outside-'));
  t.after(() => Promise.all([cwd, outside].map(p => rm(p, { recursive: true, force: true }))));
  await symlink(outside, join(cwd, 'output'));
  await assert.rejects(saveImages(cwd, { images: [{ bytes: PNG, ext: 'png' }] }), /以外/);
});

test('exclusive-create collision never cleans up someone else\'s file', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'gpt-collision-'));
  let collisionPath;
  const originalOpen = fsPromises.open;
  fsPromises.open = async (path) => {
    collisionPath = path;
    await fsPromises.writeFile(path, 'existing file');
    throw Object.assign(new Error('already exists'), { code: 'EEXIST' });
  };
  syncBuiltinESMExports();
  try {
    await assert.rejects(saveImages(cwd, { images: [{ bytes: PNG, ext: 'png' }] }), /already exists/);
    assert.equal(await readFile(collisionPath, 'utf8'), 'existing file');
  } finally {
    fsPromises.open = originalOpen;
    syncBuiltinESMExports();
    await rm(cwd, { recursive: true, force: true });
  }
});

test('API 401 errors redact credentials and do not retry', async t => {
  let calls = 0;
  const baseURL = await fixture(t, (_req, res) => { calls++; reply(res, { error: { message: 'Bad fixture-key Bearer fixture-key' } }, 401); });
  await assert.rejects(new GPTClient({ ...defaults, baseURL }, 'fixture-key').models(), error => error.message.includes('401') && !error.message.includes('fixture-key'));
  assert.equal(calls, 1);
});

test('masked provider key fragments are fully redacted', async t => {
  const baseURL = await fixture(t, (_req, res) => reply(res, { error: { message: 'Incorrect API key: sk-prefix********suffix' } }, 401));
  await assert.rejects(new GPTClient({ ...defaults, baseURL }, 'fixture-key').models(), error =>
    error.message.includes('[redacted]') && !error.message.includes('prefix') && !error.message.includes('suffix'));
});

test('non-JSON, malformed text, and non-image responses fail clearly', async t => {
  const urls = [
    await fixture(t, (_req, res) => res.end('<html>wrong endpoint</html>')),
    await fixture(t, (_req, res) => reply(res, { output: [] })),
    await fixture(t, (_req, res) => reply(res, { data: [{ b64_json: Buffer.from('not an image').toString('base64') }] })),
  ];
  await assert.rejects(new GPTClient({ ...defaults, baseURL: urls[0] }, 'key').models(), /JSON/);
  await assert.rejects(new GPTClient({ ...defaults, baseURL: urls[1] }, 'key').call({ prompt: 'test' }), /未返回文本/);
  await assert.rejects(new GPTClient({ ...defaults, baseURL: urls[2] }, 'key').image({ prompt: 'test' }), /不是 PNG/);
});

test('invalid image args and empty prompt never dispatch', async () => {
  const client = new GPTClient({ ...defaults, baseURL: 'http://127.0.0.1:1/v1' }, 'key');
  for (const args of [{ prompt: '' }, { prompt: 'a', n: 5 }, { prompt: 'a', output_format: 'exe' }, { prompt: 'a', quality: 'bogus' }, { prompt: 'a', size: '../../x' }]) await assert.rejects(client.image(args));
  await assert.rejects(client.call({ prompt: 'x', max_output_tokens: -1 }));
});

test('cancellation aborts request promptly without retry', async t => {
  let calls = 0;
  const baseURL = await fixture(t, () => { calls++; });
  const controller = new AbortController();
  const request = new GPTClient({ ...defaults, baseURL }, 'key', controller.signal).models();
  const timer = setTimeout(() => controller.abort(), 40);
  t.after(() => clearTimeout(timer));
  await assert.rejects(request, /取消或超时/);
  assert.ok(calls <= 1);
});

test('pre-cancelled save makes no files', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'gpt-cancel-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await assert.rejects(saveImages(cwd, { images: [{ bytes: PNG, ext: 'png' }] }, AbortSignal.abort()));
  assert.equal(imageType(PNG), 'png');
  assert.equal(imageType(Buffer.from('arbitrary')), null);
});
