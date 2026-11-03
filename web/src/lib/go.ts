// Runs the project's Go code, compiled to WebAssembly, in this tab and
// exposes it as a JSON API: api("POST", "path?x=1", body) is answered by the
// Go handler registered for "POST path", exactly as a server would.

type GoAPI = (method: string, path: string, body: string, done: (raw: string) => void) => void;
declare global {
  interface Window {
    goapi?: GoAPI;
    Go: new () => { importObject: WebAssembly.Imports; run(i: WebAssembly.Instance): Promise<void> };
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** A transport answers one call; tests swap in a fake. */
export type Transport = (method: string, path: string, body: string) => Promise<{ status: number; body: unknown }>;

let ready: Promise<void> | null = null;

/** Loads and starts app.wasm once. */
export function loadGo(url = "app.wasm"): Promise<void> {
  ready ??= (async () => {
    const go = new window.Go();
    let inst: WebAssembly.Instance;
    try {
      inst = (await WebAssembly.instantiateStreaming(fetch(url), go.importObject)).instance;
    } catch {
      // Servers that send the wrong Content-Type for .wasm.
      const bytes = await (await fetch(url)).arrayBuffer();
      inst = (await WebAssembly.instantiate(bytes, go.importObject)).instance;
    }
    void go.run(inst);
    while (!window.goapi) await new Promise((r) => setTimeout(r, 20));
  })();
  return ready;
}

let transport: Transport = async (method, path, body) => {
  await loadGo();
  const raw = await new Promise<string>((res) => window.goapi!(method, path, body, res));
  return JSON.parse(raw);
};

export function setTransport(t: Transport) {
  transport = t;
  ready = Promise.resolve();
}

export async function api<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const r = await transport(method, path, body === undefined ? "" : JSON.stringify(body));
  if (r.status >= 300) {
    const msg = (r.body as { error?: string } | null)?.error ?? `HTTP ${r.status}`;
    throw new ApiError(r.status, msg);
  }
  return r.body as T;
}
