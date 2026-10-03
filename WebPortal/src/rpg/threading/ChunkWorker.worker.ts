/**
 * ChunkWorker.worker — Web Worker pour chargement de chunks GLB.
 *
 * Ce fichier est VITRE ENTRY POINT pour un Web Worker.
 * Vite le compile séparément avec `lib: WebWorker`.
 * Il ne doit PAS être inclus dans le tsconfig principal.
 *
 * Usage:
 *   const worker = new Worker(new URL('./ChunkWorker.worker.ts', import.meta.url), { type: 'module' });
 */

// Pas de cast DedicatedWorkerGlobalScope — self (Window) a onmessage/postMessage dans le DOM lib.

interface LoadRequest {
  type: 'load';
  id: number;
  url: string;
  fallbackUrl?: string;
  timeout?: number;
}

interface LoadResponse {
  type: 'loaded';
  id: number;
  error?: string;
  loadMs: number;
  fetchMs: number;
  header?: Record<string, unknown>;
}

interface HealthResponse {
  type: 'health';
  ok: true;
  workerId: number;
}

type WorkerMessage = LoadRequest | { type: 'health' };

const workerId = Math.floor(Math.random() * 1_000_000);

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  if (msg.type === 'load') {
    handleLoad(msg).catch((err: unknown) => {
      self.postMessage({
        type: 'loaded',
        id: msg.id,
        error: err instanceof Error ? err.message : String(err),
        loadMs: 0,
        fetchMs: 0,
      } satisfies LoadResponse);
    });
  } else if (msg.type === 'health') {
    self.postMessage({ type: 'health', ok: true, workerId } satisfies HealthResponse);
  }
};

async function handleLoad(req: LoadRequest): Promise<void> {
  const { id, url, fallbackUrl, timeout = 60_000 } = req;
  const t0 = performance.now();
  let fetchMs = 0;

  try {
    const ft0 = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let buffer: ArrayBuffer;
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) {
        if (fallbackUrl) {
          const fb = await fetch(fallbackUrl, { signal: controller.signal });
          if (!fb.ok) {
            throw new Error(`HTTP ${resp.status} (fallback: ${fb.status})`);
          }
          buffer = await fb.arrayBuffer();
        } else {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else {
        buffer = await resp.arrayBuffer();
      }
    } finally {
      clearTimeout(timer);
    }
    fetchMs = performance.now() - ft0;

    // Analyse préliminaire de l'en-tête GLB
    const header = parseGLBHeader(buffer);
    const totalMs = performance.now() - t0;

    // Transfère le buffer (zero-copy)
    self.postMessage(
      {
        type: 'loaded',
        id,
        loadMs: totalMs,
        fetchMs,
        header,
        buffer,
      } as LoadResponse & { header: Record<string, unknown>; buffer: ArrayBuffer },
      { transfer: [buffer] },
    );
  } catch (err: unknown) {
    const totalMs = performance.now() - t0;
    self.postMessage({
      type: 'loaded',
      id,
      error: err instanceof Error ? err.message : String(err),
      loadMs: totalMs,
      fetchMs,
    } satisfies LoadResponse);
  }
}

function parseGLBHeader(buffer: ArrayBuffer): Record<string, unknown> {
  try {
    const view = new DataView(buffer);
    if (buffer.byteLength < 12) return { error: 'too small' };
    const magic = view.getUint32(0, true);
    if (magic !== 0x46546C67) return { error: `bad magic: 0x${magic.toString(16)}` };
    const version = view.getUint32(4, true);
    const length = view.getUint32(8, true);
    let jsonChunkLength = 0;
    let binChunkLength = 0;
    let offset = 12;
    while (offset + 8 <= buffer.byteLength) {
      const chunkLen = view.getUint32(offset, true);
      const chunkType = view.getUint32(offset + 4, true);
      if (chunkType === 0x4E4F534A) jsonChunkLength = chunkLen;
      else if (chunkType === 0x004E4942) binChunkLength = chunkLen;
      offset += 8 + chunkLen;
      if (offset >= buffer.byteLength) break;
    }
    return { version, fileLength: length, jsonChunkLength, binChunkLength };
  } catch {
    return { error: 'parse failed' };
  }
}
