// Exact authenticated /api route over DSH's shared Connection carrier.
// Connection admits owner peers before invoking an exact route.
export function createModelsRoute(createClient) {
  return {
    path: '/api/gpt-api/models',
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request) {
      let message;
      try { message = await request.json(); }
      catch { return new Response('Invalid JSON request', { status: 400 }); }
      if (message?.type !== 'client-request' || typeof message.rpcId !== 'string' ||
          message.method !== 'gpt-api/models' || !message.payload ||
          typeof message.payload !== 'object' || Array.isArray(message.payload) ||
          Object.keys(message.payload).length !== 0) {
        return new Response('Invalid model-list request', { status: 400 });
      }
      let result;
      try {
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30000)]);
        const client = await createClient(signal);
        result = { ok: true, value: { models: await client.models() } };
      } catch (error) {
        result = { ok: false, error: {
          code: 'gpt-api/models-failed',
          message: error instanceof Error ? error.message : '模型列表获取失败。',
          details: {},
        } };
      }
      return Response.json({ type: 'server-response', rpcId: message.rpcId, result });
    },
  };
}
