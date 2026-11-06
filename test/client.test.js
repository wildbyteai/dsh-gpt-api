import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Contract stubs: tests execute the real client bundle, never Host credentials.
const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');
function store(value) {
  const listeners = new Set();
  return { getSnapshot: () => value, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(next) { value = next; for (const fn of listeners) fn(); }, listeners };
}
async function mount(rpcReply = async () => ({ ok: true, value: { models: ['gpt-5.4', 'gpt-image-2'] } })) {
  let exported, form, dictionary, rejectSet = false, rejectDescribe = false;
  const calls = [], registrations = [], cleanups = [], events = new Map();
  const scope = store({ status: 'ready', writable: true, value: {
    apiKeyEnv: 'DSH_GPT_API_KEY', baseURL: 'https://api.openai.com/v1',
    textModel: 'gpt-5.4', imageModel: 'gpt-image-2', textAPI: 'responses', timeoutMs: 180000,
  } });
  class Model {
    constructor(boundScope, specs, secrets) {
      this.scope = boundScope; this.specs = specs; this.secrets = secrets;
      this.drafts = {}; this.failed = false; this.saving = false; this.signal = store({}); form = this;
    }
    field(name) { return { text: this.drafts[name] ?? String(this.scope.getSnapshot().value[name] ?? '') }; }
    shell() { return { available: true, writable: true, dirty: Object.keys(this.drafts).length > 0,
      failed: this.failed, saving: this.saving, invalid: this.specs.some(s =>
        s.field in this.drafts && s.parse && s.parse(this.drafts[s.field]) === undefined) }; }
    bind() { return this.signal; }
    actions() { return {
      edit: (name, text) => { this.drafts[name] = text; this.failed = false; this.signal.set({}); },
      resetField: name => { this.drafts[name] = ''; this.signal.set({}); },
      discard: () => { this.drafts = {}; this.failed = false; this.signal.set({}); },
    }; }
    async save() {
      if (this.throwSave) throw new Error('network');
      this.saving = true; this.signal.set({});
      for (const secret of this.secrets) if (this.drafts[secret.field]?.trim()) {
        if (!await secret.write(this.drafts[secret.field])) {
          this.failed = true; this.saving = false; this.signal.set({}); return;
        }
      }
      this.drafts = {}; this.failed = false; this.saving = false; this.signal.set({});
    }
    dispose() { this.disposed = true; }
  }
  const primitive = { SettingsFormModel: Model, SettingsForm: 'SettingsForm',
    SettingsValueField: 'SettingsValueField', SettingsSecretField: 'SettingsSecretField',
    settingsTextField: field => ({ field }), settingsNumberField: field => ({ field }) };
  const createElement = (type, props) => ({ type, props });
  const modules = { 'react/jsx-runtime': { jsx: createElement, jsxs: createElement },
    react: { useRef: () => ({ current: null }), useEffect: () => {} },
    '@deepseek-ai/dsh-client-ui-primitives': primitive,
    '@deepseek-ai/dsh-client-store': { createSnapshotStore: store } };
  const document = { createElement: () => ({ dataset: {}, remove() {} }), head: { appendChild() {} } };
  vm.runInNewContext(source, { URL, AbortController, document, window: { __ModuleLoader__: { load(entry) {
    assert.equal(entry.id, 'dsh-gpt-api'); exported = entry.factory(id => {
      assert.ok(modules[id], id); return modules[id];
    });
  } } } });
  const ctx = {
    connection: { rpc: { call: async (...args) => { calls.push(['rpc', ...args]); return rpcReply(...args); } } },
    effect(fn) { cleanups.push(fn()); },
    locale: { bind: () => key => dictionary.en[key], register(ns, value) { dictionary = value; return () => {}; } },
    configForms: { get(ns) { assert.equal(ns, 'gpt-api'); return scope; },
      whileServed(names, fn) { assert.deepEqual([...names], ['gpt-api']); return fn(); } },
    slots: { inject: (name, fn) => fn(), register(meta, render) { registrations.push({ meta, render }); return () => {}; } },
    remote: { $on(name, fn) { events.set(name, fn); return () => events.delete(name); }, credentials: {
      async describe(refs) { calls.push(['describe', ...refs]); return rejectDescribe ? { ok: false }
        : { ok: true, value: { [refs[0]]: { configured: true, writable: true } } }; },
      async set(ref, value) { calls.push(['set', ref, value]); return { ok: !rejectSet }; },
    } },
  };
  exported.apply(ctx); await new Promise(resolve => setImmediate(resolve));
  const entry = registrations.find(r => r.meta.name === 'plugins.item');
  const injected = entry.meta.inject();
  return { registrations, calls, form, scope, events, injected,
    state: () => injected.hooks.gptApi.getSnapshot(),
    render: () => entry.render({ ...injected, t: ctx.locale.bind(), view: 'page',
      useGptApi: selector => selector(injected.hooks.gptApi.getSnapshot()) }),
    rejectSet(value) { rejectSet = value; }, rejectDescribe(value) { rejectDescribe = value; },
    dispose() { for (const fn of cleanups.reverse()) fn?.(); },
  };
}

test('registers both native settings locations and renders native primitives', async () => {
  const h = await mount();
  assert.equal(h.registrations[0].meta.label(), 'GPT API');
  assert.equal(h.registrations[0].meta.order, 25);
  assert.equal(h.registrations[1].meta.key, 'dsh-gpt-api');
  assert.equal(h.state().credential.configured, true);
  assert.match(JSON.stringify(h.render()), /SettingsSecretField/);
  assert.match(JSON.stringify(h.render()), /chat-completions/);
  h.dispose(); assert.equal(h.form.disposed, true); assert.equal(h.scope.listeners.size, 0);
});

test('validates timeout bounds and Host URL policy', async () => {
  const h = await mount();
  const timeout = h.form.specs.find(s => s.field === 'timeoutMs').parse;
  for (const value of ['999', '600001', '1.5', 'NaN']) assert.equal(timeout(value), undefined);
  for (const value of ['1000', '180000', '600000']) assert.equal(timeout(value).kind, 'set');
  assert.equal(timeout('').kind, 'clear');
  const url = h.form.specs.find(s => s.field === 'baseURL').parse;
  for (const value of ['http://example.com/v1', 'https://u:p@example.com', 'https://example.com?q=1', 'https://example.com#x'])
    assert.equal(url(value), undefined);
  for (const value of ['https://api.openai.com/v1', 'http://localhost:1234/v1', 'http://127.0.0.1:1234', 'http://[::1]:1234'])
    assert.equal(url(value).kind, 'set');
  h.dispose();
});

test('blank key remains unchanged, failed key preserves draft, successful save clears it', async () => {
  const h = await mount();
  h.injected.edit('apiKey', '  '); await h.injected.save();
  assert.equal(h.calls.filter(c => c[0] === 'set').length, 0);
  h.rejectSet(true); h.injected.edit('apiKey', 'fixture-key'); await h.injected.save();
  assert.equal(h.state().failed, true); assert.equal(h.state().keySaveFailed, true);
  assert.equal(h.state().apiKey.text, 'fixture-key');
  h.rejectSet(false); await h.injected.save();
  assert.equal(h.state().saved, true); assert.equal(h.state().apiKey.text, '');
  h.dispose();
});

test('follows custom credential reference, retries status errors, and reports save exceptions', async () => {
  const h = await mount();
  h.scope.set({ ...h.scope.getSnapshot(), value: { ...h.scope.getSnapshot().value, apiKeyEnv: 'CUSTOM_GPT_KEY' } });
  await Promise.resolve(); assert.equal(h.state().credential.ref, 'CUSTOM_GPT_KEY');
  h.injected.edit('apiKey', 'fixture-key'); await h.injected.save();
  assert.ok(h.calls.some(c => c[0] === 'set' && c[1] === 'CUSTOM_GPT_KEY'));
  h.rejectDescribe(true); await h.injected.retryCredential();
  assert.equal(h.state().credential.status, 'error');
  h.rejectDescribe(false); await h.injected.retryCredential();
  assert.equal(h.state().credential.status, 'ready');
  h.form.throwSave = true; h.injected.edit('textModel', 'fixture-model'); await h.injected.save();
  assert.equal(h.state().failed, true); assert.equal(h.state().saved, false);
  h.injected.discard(); assert.equal(h.state().failed, false);
  h.dispose();
});

test('fetches models and stages selection without exposing key to model RPC', async () => {
  const h = await mount();
  h.injected.edit('apiKey', 'fixture-key');
  await h.injected.openModelPicker('imageModel');
  assert.equal(h.state().modelPicker.status, 'ready');
  assert.equal(h.state().modelPicker.models[0], 'gpt-image-2');
  const rpc = h.calls.find(c => c[0] === 'rpc');
  assert.equal(rpc[1], '/api'); assert.equal(rpc[2], 'gpt-api/models');
  assert.equal(JSON.stringify(rpc[3]), '{}');
  assert.ok(h.calls.findIndex(c => c[0] === 'set') < h.calls.indexOf(rpc));
  h.injected.searchModels('IMAGE'); assert.equal(h.state().modelPicker.query, 'IMAGE');
  h.injected.chooseModel('gpt-image-2');
  assert.equal(h.state().modelPicker, null);
  assert.equal(h.state().imageModel.text, 'gpt-image-2');
  assert.equal(h.state().dirty, true);
  h.dispose();
});

test('shows model fetch error and supports explicit retry', async () => {
  let calls = 0;
  const h = await mount(async () => ++calls === 1
    ? { ok: false, error: { message: 'HTTP 401: invalid key' } }
    : { ok: true, value: { models: [] } });
  await h.injected.openModelPicker('textModel');
  assert.match(h.state().modelPicker.error, /401/);
  await h.injected.openModelPicker('textModel');
  assert.equal(h.state().modelPicker.status, 'ready');
  assert.equal(h.state().modelPicker.models.length, 0);
  h.dispose();
});

test('closing picker aborts request and ignores late response', async () => {
  let release;
  const h = await mount(() => new Promise(resolve => { release = resolve; }));
  const fetching = h.injected.openModelPicker('textModel');
  const signal = h.calls.find(c => c[0] === 'rpc')[4];
  h.injected.closeModelPicker();
  assert.equal(signal.aborted, true);
  release({ ok: true, value: { models: ['stale-model'] } });
  await fetching;
  assert.equal(h.state().modelPicker, null);
  h.dispose();
});

test('invalid settings prevent model network calls', async () => {
  const h = await mount();
  h.injected.edit('baseURL', 'not-a-url');
  await h.injected.openModelPicker('textModel');
  assert.equal(h.state().modelPicker.errorKey, 'modelsSaveFirst');
  assert.equal(h.calls.some(c => c[0] === 'rpc'), false);
  h.dispose();
});
