import test from 'node:test';
import assert from 'node:assert/strict';
import fsPromises, { mkdtemp, writeFile, mkdir, symlink, rm, open } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { loadReferenceImages, GPTClient } from '../api.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF5sAAAAASUVORK5CYII=', 'base64');
const MAX_BYTES = 30 * 1024 * 1024;

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'gpt-ref-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('reference loader accepts explicit image files and records exact bytes', async t => {
  const root = await workspace(t);
  await writeFile(join(root, 'style.png'), PNG);
  const refs = await loadReferenceImages(['style.png'], root, root);
  assert.equal(refs.length, 1);
  assert.deepEqual(refs[0].bytes, PNG);
  assert.equal(refs[0].mediaType, 'image/png');
  assert.equal(refs[0].sha256, createHash('sha256').update(PNG).digest('hex'));
  assert.deepEqual(await loadReferenceImages(undefined, root, root), []);
  assert.deepEqual(await loadReferenceImages([], root, root), []);
});

test('reference loader rejects non-images, directories and paths outside workspace', async t => {
  const root = await workspace(t);
  const outside = await workspace(t);
  await writeFile(join(root, 'fake.png'), 'text');
  await writeFile(join(outside, 'real.png'), PNG);
  await symlink(join(outside, 'real.png'), join(root, 'escape.png'));
  await mkdir(join(root, 'directory'));
  for (const path of ['fake.png', 'escape.png', 'directory', join(outside, 'real.png')]) {
    await assert.rejects(loadReferenceImages([path], root, root));
  }
});

test('reference loader validates path types and image count', async t => {
  const root = await workspace(t);
  for (const paths of [null, 'style.png', [''], ['   '], [123], Array(11).fill('style.png')]) {
    await assert.rejects(loadReferenceImages(paths, root, root), /reference_images/);
  }
  await writeFile(join(root, 'style.png'), PNG);
  assert.equal((await loadReferenceImages(Array(10).fill('style.png'), root, root)).length, 10);
});

test('reference loader supports absolute paths and names containing spaces', async t => {
  const root = await workspace(t);
  const file = join(root, '参考 图.png');
  await writeFile(file, PNG);
  assert.equal((await loadReferenceImages([file], root, root))[0].name, '参考 图.png');
});

test('reference loader rejects files larger than 30 MiB before reading', async t => {
  const root = await workspace(t);
  const file = await open(join(root, 'large.png'), 'w');
  try { await file.truncate(MAX_BYTES + 1); }
  finally { await file.close(); }
  await assert.rejects(loadReferenceImages(['large.png'], root, root), /30 MiB/);
});

test('reference loading honors an already-cancelled request', async t => {
  const root = await workspace(t);
  await assert.rejects(loadReferenceImages(['missing.png'], root, root,
    AbortSignal.abort(new Error('cancelled reference loading'))), /cancelled reference loading/);
});

test('reference loading forwards cancellation and closes the file handle', async t => {
  const root = await workspace(t);
  await writeFile(join(root, 'style.png'), PNG);
  const controller = new AbortController();
  const originalOpen = fsPromises.open;
  let closed = false;
  fsPromises.open = async () => ({
    stat: async () => ({ isFile: () => true, size: PNG.length }),
    createReadStream(options) {
      assert.equal(options.signal, controller.signal);
      return (async function* () {
        yield PNG;
        controller.abort(new Error('cancelled while reading'));
        controller.signal.throwIfAborted();
      })();
    },
    close: async () => { closed = true; },
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(loadReferenceImages(['style.png'], root, root, controller.signal), /cancelled while reading/);
    assert.equal(closed, true);
  } finally {
    fsPromises.open = originalOpen;
    syncBuiltinESMExports();
  }
});

test('reference read enforces its byte cap even if a file grows after stat', async t => {
  const root = await workspace(t);
  await writeFile(join(root, 'style.png'), PNG);
  const originalOpen = fsPromises.open;
  let closed = false;
  fsPromises.open = async () => ({
    stat: async () => ({ isFile: () => true, size: PNG.length }),
    createReadStream(options) {
      assert.equal(options.end, MAX_BYTES);
      return (async function* () {
        const chunk = Buffer.alloc(1024 * 1024);
        for (let i = 0; i < 31; i++) yield chunk;
      })();
    },
    close: async () => { closed = true; },
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(loadReferenceImages(['style.png'], root, root), /30 MiB/);
    assert.equal(closed, true);
  } finally {
    fsPromises.open = originalOpen;
    syncBuiltinESMExports();
  }
});

test('reference images are uploaded as multipart file bytes with all generation options', async t => {
  let received;
  let calls = 0;
  const server = createServer(async (req, res) => {
    calls++;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received = { path: req.url, headers: req.headers, body: Buffer.concat(chunks) };
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ model: 'test-image-version', data: [{ b64_json: PNG.toString('base64') }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const sha256 = createHash('sha256').update(PNG).digest('hex');
  const references = ['style.png', 'subject.png'].map(name => ({ bytes: PNG, name, mediaType: 'image/png', sha256 }));
  const client = new GPTClient({ baseURL: `http://127.0.0.1:${server.address().port}/v1`, imageModel: 'test-image', timeoutMs: 3000 }, 'fixture-key');
  const result = await client.image({ prompt: 'exact prompt', n: 2, size: '1536x1024', quality: 'high', output_format: 'png' }, references);
  assert.equal(calls, 1);
  assert.equal(received.path, '/v1/images/edits');
  assert.match(received.headers['content-type'], /multipart\/form-data; boundary=/);
  assert.equal(received.headers.authorization, 'Bearer fixture-key');
  const form = await new Response(received.body, { headers: { 'content-type': received.headers['content-type'] } }).formData();
  for (const [key, value] of Object.entries({ model: 'test-image', prompt: 'exact prompt', n: '2', size: '1536x1024', quality: 'high', output_format: 'png' })) {
    assert.equal(form.get(key), value);
  }
  const files = form.getAll('image[]');
  assert.equal(files.length, 2);
  for (let i = 0; i < files.length; i++) {
    assert.equal(files[i].name, references[i].name);
    assert.equal(files[i].type, 'image/png');
    assert.deepEqual(Buffer.from(await files[i].arrayBuffer()), PNG);
  }
  assert.equal(received.body.includes(Buffer.from('fixture-key')), false);
  assert.equal(result.model, 'test-image-version');
  assert.deepEqual(result.references, references.map(({ name, sha256 }) => ({ name, sha256 })));
});
