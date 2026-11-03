import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { loadGo } from "./go";

// ---- errors: any failed action shows one dismissible banner ----
let lastError: string | null = null;
const listeners = new Set<() => void>();
export function reportError(e: unknown) {
  lastError = e instanceof Error ? e.message : String(e);
  listeners.forEach((l) => l());
}
function ErrorBanner() {
  const msg = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => lastError,
  );
  if (!msg) return null;
  return (
    <div className="error" role="alert">
      {msg}
      <button className="ghost small" onClick={() => { lastError = null; listeners.forEach((l) => l()); }}>dismiss</button>
    </div>
  );
}

/** Shows a loading state until the Go WebAssembly module is running. */
export function GoGate({ children, url }: { children: ReactNode; url?: string }) {
  const [state, setState] = useState<"loading" | "ready" | string>("loading");
  useEffect(() => {
    loadGo(url).then(() => setState("ready"), (e) => setState(String(e)));
  }, [url]);
  if (state === "ready") return <>{children}<ErrorBanner /></>;
  return (
    <div className="gate">
      {state === "loading" ? <><div className="spinner" />Loading the Go code (WebAssembly)…</> : <>Could not start WebAssembly: {state}</>}
    </div>
  );
}

const RESUME = "https://aravindh97.github.io/resume/";

export function Header({ title, tagline, repo, children }: { title: string; tagline: ReactNode; repo: string; children?: ReactNode }) {
  return (
    <>
      <nav className="top">
        <a href={RESUME}>← Aravindh Varadharaj · all projects</a>
        <span>
          <a href={`https://github.com/Aravindh97/${repo}`}>Source on GitHub</a>
        </span>
      </nav>
      <header>
        <h1>{title} <span>· {tagline}</span></h1>
        {children}
      </header>
    </>
  );
}

export function Card({ n, title, wide, children }: { n?: number | string; title: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <section className={"card" + (wide ? " wide" : "")}>
      <h2>{n !== undefined && <><b>{n}</b> · </>}{title}</h2>
      {children}
    </section>
  );
}

export function Stats({ children }: { children: ReactNode }) {
  return <div className="stats">{children}</div>;
}

export function Stat({ value, label, tone }: { value: ReactNode; label: ReactNode; tone?: "ok" | "bad" | "warn" }) {
  return (
    <div>
      <div className={"big" + (tone ? " " + tone : "")}>{value}</div>
      {label}
    </div>
  );
}

export function Pill({ tone, children }: { tone?: "ok" | "bad" | "warn"; children: ReactNode }) {
  return <span className={"pill" + (tone ? " " + tone : "")}>{children}</span>;
}

/** A button that runs an async action, disables itself while it runs and reports errors. */
export function Action({ onRun, variant, children, disabled, title }: {
  onRun: () => unknown | Promise<unknown>;
  variant?: "ghost" | "bad";
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  const [busy, setBusy] = useState(false);
  const click = useCallback(async () => {
    setBusy(true);
    try {
      await onRun();
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }, [onRun]);
  return (
    <button className={variant} disabled={busy || disabled} onClick={click} title={title}>
      {busy ? "running…" : children}
    </button>
  );
}

/** Loads data once (and again when deps change); errors go to the banner. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): [T | undefined, (v: T) => void] {
  const [data, setData] = useState<T>();
  useEffect(() => {
    let live = true;
    load().then((v) => live && setData(v), reportError);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [data, setData];
}

export function Footer({ children }: { children: ReactNode }) {
  return <footer>{children}<div>A personal project, built in my own time to learn. React + TypeScript frontend; the Go code runs as WebAssembly.</div></footer>;
}

export const fmt = (n: number, digits = 0) => n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
