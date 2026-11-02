// Loads app.wasm (the project's Go code compiled to WebAssembly) and exposes
// api(method, path, body): the same JSON API a server would offer, answered
// by Go running in this tab.
"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const goReady = (async () => {
  const go = new Go();
  const r = await WebAssembly.instantiateStreaming(fetch("app.wasm"), go.importObject);
  go.run(r.instance);
  while (!window.goapi) await new Promise((res) => setTimeout(res, 20));
  document.querySelectorAll(".loading").forEach((e) => e.classList.remove("loading"));
})();
async function api(method, path, body) {
  await goReady;
  const raw = await new Promise((res) => goapi(method, path, body === undefined ? "" : JSON.stringify(body), res));
  const r = JSON.parse(raw);
  if (r.status >= 300) throw new Error((r.body && r.body.error) || ("HTTP " + r.status));
  return r.body;
}
function busy(btn, on) { if (btn) { btn.disabled = on; btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = on ? "running…" : btn.dataset.label; } }
async function run(btn, fn) { busy(btn, true); try { await fn(); } catch (e) { alert(e.message); } finally { busy(btn, false); } }
