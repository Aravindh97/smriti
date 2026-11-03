import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import App, { type MemView } from "./App";
import { setTransport } from "./lib/go";

afterEach(cleanup);

const mem = (id: string, content: string, current: boolean): MemView => ({
  ID: id, Scope: "user", Owner: "anita", Subject: "manager", Content: content, Source: "a1/0",
  Confirmations: 1, From: "2026-01-05 10:00", To: current ? undefined : "2026-04-01 11:00", Current: current,
});

test("a message shows what was written, and a denied company fact says why", async () => {
  const bodies: string[] = [];
  setTransport(async (_m, path, body) => {
    if (path === "users") return { status: 200, body: { users: [{ id: "anita", teams: ["design"], org_writer: false }], now: "", sessions: 1 } };
    if (path.startsWith("memories")) return { status: 200, body: [mem("1", "User's manager is Priya Raman", false), mem("2", "User's manager is Arjun Mehta now", true)] };
    bodies.push(body);
    return { status: 200, body: {
      results: [{ candidate: { scope: "org", subject: "leave_policy", content: "30 days", confidence: 0.8, source_ref: "x" }, action: "denied", reason: "user anita may not write org memories" }],
      retry_duplicates: 0, now: "", memories: null,
    } };
  });
  render(<App />);
  expect(await screen.findByText("User's manager is Arjun Mehta now")).toBeTruthy();
  expect(screen.getAllByText("forget")).toHaveLength(1); // only the current memory
  fireEvent.change(screen.getByLabelText("message"), { target: { value: "The company's leave policy is 30 days." } });
  fireEvent.click(screen.getByText("Send"));
  expect(await screen.findByText("(user anita may not write org memories)")).toBeTruthy();
  expect(JSON.parse(bodies[0])).toEqual({ User: "anita", Text: "The company's leave policy is 30 days." });
});
