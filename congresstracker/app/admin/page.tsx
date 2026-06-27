"use client";

/**
 * Phase 8 — Reviewer admin tool.
 *
 * A client-side island that signs a reviewer in with Supabase Auth and lets
 * them create and review promises. All writes go through the anon key carrying
 * the reviewer's JWT; RLS allows the `authenticated` role to INSERT/UPDATE only
 * `promises` (never any other table). The service-role key is never used here.
 *
 * Integrity rules enforced in the UI (and again by the DB):
 *   - A new promise needs text + source_url; status starts `unverified`.
 *   - A resolved status (kept/broken/partial/stalled) needs evidence
 *     (status_source_url); the reviewer id + timestamp are attached
 *     automatically. We never assert a verdict without a source.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "../../lib/supabase.ts";
import {
  PROMISE_STATUSES,
  PROMISE_STATUS_LABELS,
} from "../../lib/constants.ts";
import type { PromiseRow, PromiseStatus } from "../../lib/database.types.ts";

export default function AdminPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
      setUserId(data.session?.user.id ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  if (!supabase) {
    return (
      <Shell>
        <p className="text-sm text-gray-600">
          Supabase is not configured in this environment, so the reviewer tool
          is unavailable. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable it.
        </p>
      </Shell>
    );
  }

  if (!ready) {
    return (
      <Shell>
        <p className="text-sm text-gray-400">Loading…</p>
      </Shell>
    );
  }

  if (!userEmail || !userId) {
    return (
      <Shell>
        <SignIn supabase={supabase} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Signed in as <span className="font-medium">{userEmail}</span>
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-sm text-gray-500 underline hover:text-gray-900"
        >
          Sign out
        </button>
      </div>
      <PromiseManager supabase={supabase} reviewerId={userId} />
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Layout shell
// ---------------------------------------------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <Link href="/" className="text-sm text-gray-500 underline">
        ← CongressTracker
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Reviewer tool</h1>
      <p className="mt-1 mb-8 text-sm text-gray-500">
        Promises are entered and reviewed by hand. Every promise needs a source;
        every verdict needs evidence. Nothing here is auto-generated.
      </p>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------

function SignIn({ supabase }: { supabase: NonNullable<ReturnType<typeof createBrowserClient>> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      <h2 className="text-lg font-semibold">Reviewer sign-in</h2>
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        type="password"
        required
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs text-gray-400">
        Reviewer accounts are provisioned in the Supabase dashboard.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Promise manager (create + review)
// ---------------------------------------------------------------------------

type Supa = NonNullable<ReturnType<typeof createBrowserClient>>;

function PromiseManager({
  supabase,
  reviewerId,
}: {
  supabase: Supa;
  reviewerId: string;
}) {
  const [bioguideId, setBioguideId] = useState("");
  const [promises, setPromises] = useState<PromiseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (id: string) => {
      const target = id.trim();
      if (!target) return;
      setLoading(true);
      // The hand-written Database generic narrows writes/reads awkwardly; cast
      // to any at the client boundary exactly as lib/queries.ts does.
      const { data, error } = await (supabase as any)
        .from("promises")
        .select("*")
        .eq("bioguide_id", target)
        .order("created_at", { ascending: false });
      setLoading(false);
      if (error) {
        setNotice(`Load failed: ${error.message}`);
        return;
      }
      setPromises((data as PromiseRow[]) ?? []);
    },
    [supabase],
  );

  return (
    <div className="space-y-10">
      <CreatePromise
        supabase={supabase}
        onCreated={(id) => {
          setBioguideId(id);
          setNotice("Promise created (status: unverified).");
          load(id);
        }}
      />

      <section>
        <h2 className="text-lg font-semibold mb-3">Review promises</h2>
        <div className="flex gap-2 mb-4">
          <input
            value={bioguideId}
            onChange={(e) => setBioguideId(e.target.value)}
            placeholder="Member bioguide id (e.g. O000172)"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => load(bioguideId)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Load
          </button>
        </div>

        {notice && <p className="mb-3 text-sm text-gray-500">{notice}</p>}
        {loading && <p className="text-sm text-gray-400">Loading…</p>}

        <ul className="space-y-4">
          {promises.map((p) => (
            <ReviewRow
              key={p.id}
              supabase={supabase}
              promise={p}
              reviewerId={reviewerId}
              onSaved={() => load(bioguideId)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function CreatePromise({
  supabase,
  onCreated,
}: {
  supabase: Supa;
  onCreated: (bioguideId: string) => void;
}) {
  const [form, setForm] = useState({
    bioguide_id: "",
    text: "",
    topic: "",
    made_date: "",
    made_context: "",
    source_url: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.bioguide_id.trim() || !form.text.trim() || !form.source_url.trim()) {
      setError("bioguide id, promise text, and source URL are required.");
      return;
    }
    setBusy(true);
    const { error } = await (supabase as any).from("promises").insert({
      bioguide_id: form.bioguide_id.trim(),
      text: form.text.trim(),
      topic: form.topic.trim() || null,
      made_date: form.made_date || null,
      made_context: form.made_context.trim() || null,
      source_url: form.source_url.trim(),
      // status defaults to 'unverified' in the DB.
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    const id = form.bioguide_id.trim();
    setForm({ bioguide_id: "", text: "", topic: "", made_date: "", made_context: "", source_url: "" });
    onCreated(id);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Add a promise</h2>
      <form onSubmit={submit} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid sm:grid-cols-2 gap-3">
          <input value={form.bioguide_id} onChange={set("bioguide_id")} placeholder="Bioguide id *" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input value={form.topic} onChange={set("topic")} placeholder="Topic (e.g. taxes)" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <textarea value={form.text} onChange={set("text")} placeholder="The promise, as stated *" rows={2} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <div className="grid sm:grid-cols-2 gap-3">
          <input type="date" value={form.made_date} onChange={set("made_date")} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input value={form.made_context} onChange={set("made_context")} placeholder="Where it was made" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <input value={form.source_url} onChange={set("source_url")} placeholder="Source URL * (where the promise was made)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
          {busy ? "Saving…" : "Add promise"}
        </button>
      </form>
    </section>
  );
}

function ReviewRow({
  supabase,
  promise: p,
  reviewerId,
  onSaved,
}: {
  supabase: Supa;
  promise: PromiseRow;
  reviewerId: string;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<PromiseStatus>(p.status);
  const [rationale, setRationale] = useState(p.status_rationale ?? "");
  const [evidence, setEvidence] = useState(p.status_source_url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resolved = status !== "unverified";

  async function save() {
    setError(null);
    if (resolved && !evidence.trim()) {
      setError("A resolved status needs evidence (a status source URL).");
      return;
    }
    setBusy(true);
    const patch =
      status === "unverified"
        ? {
            status,
            status_rationale: rationale.trim() || null,
            status_source_url: evidence.trim() || null,
          }
        : {
            status,
            status_rationale: rationale.trim() || null,
            status_source_url: evidence.trim(),
            reviewed_by: reviewerId,
            reviewed_at: new Date().toISOString(),
          };
    const { error } = await (supabase as any)
      .from("promises")
      .update(patch)
      .eq("id", p.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-900">{p.text}</p>
      <p className="mt-1 text-xs text-gray-400">
        <a href={p.source_url} target="_blank" rel="noreferrer noopener" className="underline">
          promise source ↗
        </a>
      </p>
      <div className="mt-3 grid sm:grid-cols-3 gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PromiseStatus)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {PROMISE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROMISE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder={resolved ? "Evidence URL *" : "Evidence URL"}
          className="sm:col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder="Rationale (neutral, factual)"
        rows={2}
        className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        onClick={save}
        disabled={busy}
        className="mt-3 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save verdict"}
      </button>
    </li>
  );
}
