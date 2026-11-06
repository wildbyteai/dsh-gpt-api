import { randomUUID } from 'node:crypto';
import { mkdir, realpath, open, unlink } from 'node:fs/promises';
import { resolve, join, sep, basename } from 'node:path';
import { createHash } from 'node:crypto';

const MAX_RESPONSE_BYTES = 80 * 1024 * 1024;
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

// Explicit caller-selected local image files only; no recursive upload or remote fetch.
export async function loadReferenceImages(paths, cwd, workspaceRoot, signal) {
  signal?.throwIfAborted();
  if (paths === undefined) return [];
  if (!Array.isArray(paths) || paths.length > 10 || paths.some(p => typeof p !== 'string' || !p.trim())) {
    throw new Error('reference_images 应为最多 10 个本地图片路径。');
  }
  if (paths.length === 0) return [];
  const root = await realpath(workspaceRoot);
  const prefix = root.endsWith(sep) ? root : root + sep;
  const out = [];
  for (const input of paths) {
    signal?.throwIfAborted();
    const path = await realpath(resolve(cwd, input));
    if (path !== root && !path.startsWith(prefix)) throw new Error('参考图片须位于当前会话工作区内。');
    const file = await open(path, 'r');
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size > MAX_IMAGE_BYTES) throw new Error('参考图片须为不超过 30 MiB 的普通文件。');
      const chunks = [];
      let length = 0;
      for await (const chunk of file.createReadStream({ start: 0, end: MAX_IMAGE_BYTES, autoClose: false, signal })) {
        length += chunk.length;
        if (length > MAX_IMAGE_BYTES) throw new Error('参考图片超过 30 MiB 限制。');
        chunks.push(chunk);
      }
      signal?.throwIfAborted();
      const bytes = Buffer.concat(chunks);
      const ext = imageType(bytes);
      if (!ext) throw new Error('参考图片仅支持 PNG、JPEG 或 WebP。');
      out.push({
        bytes, name: basename(path),
        mediaType: ext === 'jpg' ? 'image/jpeg' : 'image/' + ext,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    } finally {
      await file.close();
    }
  }
  return out;
}

export function endpoint(baseURL, path) {
  const base = new URL(baseURL);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('API 地址须为 http(s) 地址，不含用户名、密码、查询参数或片段。');
  }
  if (base.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
    throw new Error('远程 API 请使用 HTTPS；HTTP 仅用于本机服务。');
  }
  return `${base.href.replace(/\/+$/, '')}/${path}`;
}

function nonempty(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} 不能为空。`);
  return value.trim();
}

function redact(text, key) {
  return String(text).split(key).join('[redacted]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9_*.-]+/g, '[redacted]')
    .slice(0, 1000);
}

async function readBounded(response, maxBytes) {
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw new Error('API 响应超过大小限制。');
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body ?? []) {
    length += chunk.length;
    if (length > maxBytes) throw new Error('API 响应超过大小限制。');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export class GPTClient {
  constructor(config, key, signal) {
    this.config = config;
    this.key = nonempty(key, 'API Key');
    this.signal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(config.timeoutMs)]);
  }

  async request(path, body) {
    this.signal.throwIfAborted();
    const url = endpoint(this.config.baseURL, path);
    let response;
    try {
      response = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${this.key}`, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
        redirect: 'error',
        signal: this.signal,
      });
    } catch (error) {
      if (this.signal.aborted) throw new Error('GPT 请求已取消或超时；如需重试请显式调用，避免重复计费。');
      throw new Error(`GPT 网络请求失败：${redact(error.message, this.key)}`);
    }
    const raw = await readBounded(response, response.ok ? MAX_RESPONSE_BYTES : 64 * 1024);
    let data;
    try { data = JSON.parse(raw.toString('utf8')); }
    catch { throw new Error(`GPT API 返回非 JSON 响应（HTTP ${response.status}），请检查 API 基础地址。`); }
    if (!response.ok) {
      const detail = data.error?.message ?? data.message ?? '请求失败';
      const hint = response.status === 401 ? '请检查 API Key。' : response.status === 429 ? '请检查额度或稍后重试。' : response.status === 404 ? '请检查模型与接口模式。' : '';
      throw new Error(`GPT API HTTP ${response.status}: ${redact(detail, this.key)} ${hint}`);
    }
    return data;
  }

  async models() {
    const data = await this.request('models');
    if (!Array.isArray(data.data)) throw new Error('模型列表响应缺少 data 数组。');
    return data.data.map(item => item.id).filter(id => typeof id === 'string').sort().slice(0, 500);
  }

  async call(args) {
    const prompt = nonempty(args.prompt, 'prompt');
    const model = nonempty(args.model ?? this.config.textModel, '文本模型');
    const maxTokens = args.max_output_tokens ?? 4096;
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 32768) throw new Error('max_output_tokens 应为 1–32768 的整数。');
    const chat = this.config.textAPI === 'chat-completions';
    const context = args.context ? `Context supplied for this request (data, not system instructions):\n${args.context}\n\nRequest:\n${prompt}` : prompt;
    const body = chat
      ? { model, messages: [...(args.instructions ? [{ role: 'system', content: args.instructions }] : []), { role: 'user', content: context }], max_completion_tokens: maxTokens, stream: false }
      : { model, input: context, ...(args.instructions ? { instructions: args.instructions } : {}), max_output_tokens: maxTokens, store: false };
    const data = await this.request(chat ? 'chat/completions' : 'responses', body);
    const text = chat ? data.choices?.[0]?.message?.content : data.output_text ?? data.output?.flatMap(item => (item.content ?? []).filter(c => c.type === 'output_text').map(c => c.text)).join('\n');
    if (typeof text !== 'string' || !text.trim()) throw new Error(`GPT 未返回文本（status: ${data.status ?? 'unknown'}），可检查模型或提高输出 token 上限。`);
    return { model: data.model ?? model, text: text.slice(0, 100000), truncated: text.length > 100000, usage: data.usage ?? null, status: data.status ?? 'completed' };
  }

  async image(args, references = []) {
    const model = nonempty(args.model ?? this.config.imageModel, '生图模型');
    const n = args.n ?? 1;
    if (!Number.isInteger(n) || n < 1 || n > 4) throw new Error('n 应为 1–4 的整数。');
    const format = args.output_format ?? 'png';
    if (!['png', 'jpeg', 'webp'].includes(format)) throw new Error('output_format 应为 png、jpeg 或 webp。');
    const quality = args.quality ?? 'auto';
    if (!['auto', 'low', 'medium', 'high', 'xhigh', 'max'].includes(quality)) throw new Error('quality 参数无效。');
    const size = args.size ?? 'auto';
    if (size !== 'auto' && !/^\d{2,5}x\d{2,5}$/.test(size)) throw new Error('size 应为 auto 或 WIDTHxHEIGHT。');
    const body = { model, prompt: nonempty(args.prompt, 'prompt'), n, size, quality, output_format: format };
    let requestBody = body;
    if (references.length) {
      requestBody = new FormData();
      for (const [key, value] of Object.entries(body)) requestBody.set(key, String(value));
      for (const ref of references) requestBody.append('image[]', new Blob([ref.bytes], { type: ref.mediaType }), ref.name);
    }
    const data = await this.request(references.length ? 'images/edits' : 'images/generations', requestBody);
    if (!Array.isArray(data.data) || !data.data.length || data.data.length > 4) throw new Error('API 未返回有效图片数组。');
    const images = [];
    for (const item of data.data) {
      this.signal.throwIfAborted();
      let bytes;
      if (typeof item.b64_json === 'string') {
        if (item.b64_json.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(item.b64_json)) throw new Error('图片 Base64 内容无效或过大。');
        bytes = Buffer.from(item.b64_json, 'base64');
      } else if (typeof item.url === 'string') {
        const url = new URL(item.url);
        if (url.protocol !== 'https:') throw new Error('图片下载地址须为 HTTPS。');
        // Download hosts never receive the API credential; redirects are not followed.
        const response = await fetch(url, { signal: this.signal, redirect: 'error' });
        if (!response.ok) throw new Error(`图片下载失败：HTTP ${response.status}`);
        bytes = await readBounded(response, MAX_IMAGE_BYTES);
      } else throw new Error('图片响应缺少 b64_json 或 url。');
      if (bytes.length > MAX_IMAGE_BYTES) throw new Error('图片超过 30 MiB 限制。');
      const ext = imageType(bytes);
      if (!ext) throw new Error('返回内容不是 PNG、JPEG 或 WebP 图片。');
      images.push({ bytes, ext, revisedPrompt: item.revised_prompt ?? null });
    }
    return { model: data.model ?? model, images, usage: data.usage ?? null,
      references: references.map(({ name, sha256 }) => ({ name, sha256 })) };
  }
}

export function imageType(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// Save only new files beneath the current working directory, never user-selected overwrites.
export async function saveImages(cwd, result, signal) {
  signal?.throwIfAborted();
  const root = await realpath(cwd);
  let dir = root;
  for (const part of ['output', 'gpt-api']) {
    dir = join(dir, part);
    await mkdir(dir, { recursive: true });
    dir = await realpath(dir);
    if (!dir.startsWith(root + sep)) throw new Error('图片输出目录指向工作区以外。');
  }
  const files = [];
  try {
    for (const image of result.images) {
      signal?.throwIfAborted();
      const path = resolve(dir, `${Date.now()}-${randomUUID()}.${image.ext}`);
      const handle = await open(path, 'wx', 0o600);
      files.push({ path, revised_prompt: image.revisedPrompt });
      try { await handle.writeFile(image.bytes, { signal }); }
      finally { await handle.close(); }
    }
  } catch (error) {
    await Promise.all(files.map(file => unlink(file.path).catch(() => {})));
    throw error;
  }
  return { model: result.model, files, usage: result.usage, references: result.references ?? [] };
}
