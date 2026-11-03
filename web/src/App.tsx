import { useCallback, useEffect, useState } from "react";
import "./app.css";
import { api } from "./lib/go";
import { Action, Card, Footer, Header, Stat, Stats, reportError, useLoad } from "./lib/ui";
import type { Report, WriteResult } from "./types.gen";

// Envelopes and the memory view are built in cmd/web; WriteResult and the
// eval Report inside are generated from Go.
export interface MemView {
  ID: string; Scope: string; Owner: string; Subject: string; Content: string; Source: string;
  Confirmations: number; From: string; To?: string; Current: boolean;
}
interface Users { users: { id: string; teams: string[]; org_writer: boolean }[]; now: string; sessions: number }
interface Said { results: WriteResult[] | null; retry_duplicates: number; now: string; memories: MemView[] | null }
interface Recalled { memory: MemView; similarity: number; score: number }

const fixed = (n: number) => n.toFixed(3);

export function Memories({ rows, user, onHistory, onForget }: { rows: MemView[]; user: string; onHistory: (s: string) => void; onForget: (id: string) => void }) {
  return (
    <table>
      <thead><tr><th>Scope</th><th>Subject</th><th>Content</th><th className="num">Seen</th><th>Valid (greyed = replaced)</th><th>Source</th><th></th></tr></thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.ID} className={m.Current ? "" : "closed"}>
            <td>{m.Scope}{m.Scope === "team" && ` · ${m.Owner}`}</td>
            <td><a href="#history" onClick={(e) => { e.preventDefault(); onHistory(m.Subject); }}>{m.Subject}</a></td>
            <td>{m.Content}</td>
            <td className="num">{m.Confirmations}</td>
            <td className="muted">{m.From} → {m.To ?? "now"}</td>
            <td className="mono muted">{m.Source}</td>
            <td>{m.Current && m.Scope === "user" && m.Owner === user && <a href="#forget" onClick={(e) => { e.preventDefault(); onForget(m.ID); }}>forget</a>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Said({ r }: { r: Said | null }) {
  if (!r) return null;
  const res = r.results ?? [];
  if (!res.length) return <pre className="out">no fact found in that message</pre>;
  return (
    <pre className="out">
      {res.map((w, i) => (
        <div key={i}><span className={"act " + w.action}>{w.action}</span> {w.candidate.scope} · {w.candidate.subject}: {w.candidate.content} <span className="muted">({w.reason})</span></div>
      ))}
      <div className="muted">sent again as a retried webhook: {r.retry_duplicates} of {res.length} recognised as already processed</div>
    </pre>
  );
}

function EvalCard() {
  const [e, setE] = useState<Report | null>(null);
  const n = e?.Questions || 1;
  const mark = (ok: boolean, stale: boolean) => (stale ? <b className="bad">stale</b> : ok ? <span className="ok">ok</span> : <b className="bad">miss</b>);
  return (
    <Card wide n={4} title="Eval: memory vs searching raw chat history">
      <div className="row">
        <Action onRun={async () => setE(await api<Report>("POST", "eval"))}>Run the eval</Action>
        <span className="muted">34 questions whose answers changed over time, asked as different users; the baseline returns the most similar past message from that user's own history.</span>
      </div>
      {e && (
        <>
          <Stats>
            <Stat tone="ok" value={fixed(e.SmritiCorrect / n)} label="smriti correct" />
            <Stat value={fixed(e.SmritiStale / n)} label="smriti stale" />
            <Stat value={fixed(e.BaseCorrect / n)} label="raw history correct" />
            <Stat tone="bad" value={fixed(e.BaseStale / n)} label="raw history stale" />
            <Stat value={e.Leaks} label="leaks to the wrong user" />
            <Stat value={e.ReplayChanged} label="rows changed by replaying all sessions" />
          </Stats>
          <table>
            <thead><tr><th>User</th><th>Question</th><th>smriti</th><th>raw history</th></tr></thead>
            <tbody>
              {(e.Rows ?? []).map((r) => (
                <tr key={r.ID}>
                  <td>{r.User}</td><td>{r.Query}</td>
                  <td>{mark(r.SmritiOK, r.SmritiStale)} <span className="muted">{r.Smriti || "(nothing)"}</span></td>
                  <td>{mark(r.BaselineOK, r.BaseStale)} <span className="muted">{r.Baseline}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}

export default function App() {
  const [users] = useLoad(() => api<Users>("GET", "users"), []);
  const [user, setUser] = useState("anita");
  const [mems, setMems] = useState<MemView[]>([]);
  const [history, setHistory] = useState<{ subject: string; rows: MemView[] } | null>(null);
  const [text, setText] = useState("My manager is Kavya Iyer now.");
  const [said, setSaid] = useState<Said | null>(null);
  const [note, setNote] = useState("");
  const [q, setQ] = useState("who is my manager");
  const [asOf, setAsOf] = useState("");
  const [rec, setRec] = useState<Recalled[] | null>(null);

  const loadMems = useCallback(async (u: string) => setMems((await api<MemView[] | null>("GET", "memories?user=" + u)) ?? []), []);
  useEffect(() => {
    setHistory(null);
    setSaid(null);
    setRec(null);
    loadMems(user).catch(reportError);
  }, [user, loadMems]);

  const me = users?.users.find((u) => u.id === user);
  const showHistory = async (subject: string) =>
    setHistory({ subject, rows: (await api<MemView[] | null>("GET", `history?user=${user}&subject=${encodeURIComponent(subject)}`)) ?? [] });
  const forget = async (id: string) => {
    const r = await api<{ deleted_versions: number; memories: MemView[] | null }>("POST", "forget", { User: user, ID: id });
    setNote(`forgot ${r.deleted_versions} version(s); they are deleted, not just hidden`);
    setMems(r.memories ?? []);
  };
  return (
    <>
      <Header repo="smriti" title="smriti" tagline="memory an agent can trust">
        <p>An AI assistant at a garment company, Kaveri, remembers what each person tells it. A changed fact replaces the old one instead of piling up next to it, old answers stay queryable by date, people only see their own, their team's and the company's memories, and only HR can change company-wide facts. The memory layer from the repo runs here as Go WebAssembly.</p>
        <p className="muted">The full version stores memories in Postgres with pgvector; this page keeps them in memory with the same rules. Facts are pulled out by the repo's rule-based extractor; the README covers the LLM extractor.</p>
      </Header>
      <main>
        <Card n={1} title="Talk to the assistant">
          <div className="row">
            as
            <select value={user} onChange={(e) => setUser(e.target.value)} aria-label="user">
              {users?.users.map((u) => <option key={u.id}>{u.id}</option>)}
            </select>
            {me && <span className="muted">teams: {me.teams.join(", ")}{me.org_writer && " · may write company facts"}</span>}
          </div>
          <form className="row" onSubmit={(e) => e.preventDefault()}>
            <input value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} aria-label="message" />
            <Action onRun={async () => {
              const r = await api<Said>("POST", "say", { User: user, Text: text });
              setSaid(r);
              setMems(r.memories ?? []);
            }}>Send</Action>
          </form>
          <div className="muted">Try: "I prefer Tamil for voice calls." · "Our team uses Canva for mockups." · "The company's leave policy is 30 days." (only meena, in HR, may change company facts) · "I am travelling to Delhi this week."</div>
          <Said r={said} />
        </Card>
        <Card n={2} title="What would the agent recall?">
          <form className="row" onSubmit={(e) => e.preventDefault()}>
            <input value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} aria-label="query" />
            as of <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} aria-label="as of" />
            <Action onRun={async () => setRec(await api<Recalled[] | null>("POST", "recall", { User: user, Query: q, AsOf: asOf }))}>Recall</Action>
          </form>
          <div className="muted">Leave the date empty for "now" (the demo clock starts on the scenario's last day). Try as of 2026-03-01 for anita: her manager then was Priya.</div>
          {rec && (
            <table>
              <thead><tr><th>#</th><th>Memory</th><th className="num">Similarity</th><th className="num">Score</th></tr></thead>
              <tbody>
                {rec.map((x, i) => (
                  <tr key={x.memory.ID}><td>{i + 1}</td><td>{x.memory.Content}<div className="muted">{x.memory.Scope} · {x.memory.From} → {x.memory.To ?? "now"}</div></td>
                    <td className="num">{fixed(x.similarity)}</td><td className="num">{fixed(x.score)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card wide n={3} title={`Memories ${user} can see`}>
          <div className="row">
            <Action variant="ghost" onRun={async () => {
              const r = await api<{ actions: Record<string, number>; changed: number }>("POST", "replay");
              setNote(`${Object.entries(r.actions).map(([k, v]) => `${v} ${k}`).join(", ")}: ${r.changed} memories changed`);
              await loadMems(user);
            }}>Replay every past conversation again</Action>
            <Action variant="ghost" onRun={async () => { await api("POST", "reset"); setSaid(null); setNote(""); await loadMems(user); }}>Reset</Action>
            <span className="muted">{note}</span>
          </div>
          <Memories rows={mems} user={user} onHistory={(s) => showHistory(s).catch(reportError)} onForget={(id) => forget(id).catch(reportError)} />
          {history && (
            <>
              <h2 style={{ marginTop: 10 }}>History of {history.subject}</h2>
              <table><tbody>{history.rows.map((m) => <tr key={m.ID}><td className="muted">{m.From} → {m.To ?? "now"}</td><td>{m.Content}</td><td className="mono muted">{m.Source}</td></tr>)}</tbody></table>
            </>
          )}
        </Card>
        <EvalCard />
      </main>
      <Footer>Embeddings are a 384-dimension hashing embedder, so the demo needs no model download. Message times come from the scenario; each message you send moves the demo clock forward an hour.</Footer>
    </>
  );
}
