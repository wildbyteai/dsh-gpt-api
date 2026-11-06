import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { installConnection } from '@deepseek-ai/dsh-client-connection/client';
import { createModelsRoute } from '../models-route.js';

const request = payload => new Request('http://localhost/api/gpt-api/models', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'client-request', rpcId: 'test-1', method: 'gpt-api/models', payload }),
});

test('native Connection client consumes the exact models route envelope', async () => {
  const route = createModelsRoute(async signal => ({ models: async () => {
    assert.ok(signal instanceof AbortSignal);
    return ['gpt-5.4', 'gpt-image-2'];
  } }));
  const ctx = new Context();
  installConnection(ctx, { transport: { fetch: async (input, init) => {
    const req = new Request(new URL(input, 'http://localhost'), init);
    assert.equal(new URL(req.url).pathname, route.path);
    return route.fetch(req);
  } } });
  const response = await ctx.connection.rpc.call('/api', 'gpt-api/models', {}, new AbortController().signal);
  assert.equal(response.ok, true);
  assert.deepEqual(response.value.models, ['gpt-5.4', 'gpt-image-2']);
});

test('models route returns actionable provider failures', async () => {
  const route = createModelsRoute(async () => { throw new Error('HTTP 401: invalid API key'); });
  const json = await (await route.fetch(request({}))).json();
  assert.equal(json.result.ok, false);
  assert.match(json.result.error.message, /401/);
  assert.equal(json.rpcId, 'test-1');
});

test('models route rejects client-provided secrets and endpoint overrides', async () => {
  let calls = 0;
  const route = createModelsRoute(async () => { calls++; });
  for (const payload of [{ apiKey: 'never-used' }, { baseURL: 'https://other.example' }, [], null]) {
    assert.equal((await route.fetch(request(payload))).status, 400);
  }
  assert.equal(calls, 0);
});
