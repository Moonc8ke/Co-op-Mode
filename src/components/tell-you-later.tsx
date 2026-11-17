"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addTellYouLater,
  deleteTellYouLater,
  markTellYouLaterDone,
} from "@/lib/data";
import { fmtWhen } from "@/lib/seasons";
import type { Person, TellYouLater, TellYouLaterKind } from "@/lib/types";
import { IdentityMiniPicker } from "./identity";
import { EmptyNote, SectionHeader, sectionPanelStyle } from "./shared";

const KIND_META: Record<
  TellYouLaterKind,
  {
    chip: string;
    badge: (name: string) => string;
    placeholder: string;
    doneLabel: string;
    doneBadge: string;
    doneVerb: string;
  }
> = {
  tell: {
    chip: "Tell you",
    badge: (name) => `${name} wants to tell you`,
    placeholder: "What do you want to tell them? That funny thing at work, something you heard…",
    doneLabel: "Told you",
    doneBadge: "✓ Told you",
    doneVerb: "told",
  },
  do: {
    chip: "Remind me to do",
    badge: () => "Remind me to do",
    placeholder: "What should you remember to do? Call the landlord, book the tickets…",
    doneLabel: "Done",
    doneBadge: "✓ Done",
    doneVerb: "did",
  },
  news: {
    chip: "Good news",
    badge: (name) => `${name} has good news`,
    placeholder: "What happened? Something worth celebrating together later…",
    doneLabel: "Celebrated",
    doneBadge: "✓ Celebrated",
    doneVerb: "celebrated",
  },
};

export function TellYouLaterSection({
  entries,
  compact,
  refresh,
  me,
  onPickIdentity,
  onNeedIdentity,
  identitySaving,
  identityError,
  // On the home page the section can be tucked away with the little
  // arrow in its header. When these aren't given (the Add & browse
  // page), the section is always open and has no arrow.
  collapsed,
  onToggleCollapsed,
}: {
  entries: TellYouLater[];
  compact?: boolean;
  refresh: () => void;
  /** Who is signed in (null until they have picked a name). */
  me: Person | null;
  /** Save a name picked in the inline mini-picker. */
  onPickIdentity: (person: Person) => void;
  /** Open the first-run picker (when an action needs an identity). */
  onNeedIdentity: () => void;
  identitySaving: boolean;
  identityError: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const supabase = createClient();
  const open = entries.filter((e) => !e.is_done);
  const done = entries.filter((e) => e.is_done);

  const [kind, setKind] = useState<TellYouLaterKind>("tell");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [error, setError] = useState("");

  async function onPost(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || pendingSubmit || !me) return;
    setPendingSubmit(true);
    setError("");
    try {
      await addTellYouLater(supabase, {
        text: text.trim(),
        kind,
        note: note.trim(),
        wanted_by: me,
      });
      setText("");
      setNote("");
      refresh();
    } catch {
      setError("That note didn't post. Please try again.");
    } finally {
      setPendingSubmit(false);
    }
  }

  return (
    <section
      aria-label="Tell you later"
      className={`${compact ? "mt-8" : "mt-6"} rounded-[1.4rem] border border-[var(--border)] p-4 shadow-sm sm:p-5`}
      style={sectionPanelStyle("var(--sky-soft)")}
    >
      <SectionHeader
        emoji="💬"
        label="Tell you later"
        blurb="Something to tell the other, a thing to remember to do, or good news worth celebrating later — post it here so it isn't forgotten."
        color="var(--sky)"
        pill={open.length > 0 ? `${open.length} waiting` : undefined}
        collapsed={collapsed}
        onToggle={onToggleCollapsed}
      />

      {!collapsed && (
        <>
          {open.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {open.map((entry) => (
                <TellYouLaterCard
                  key={entry.id}
                  entry={entry}
                  refresh={refresh}
                  me={me}
                  onNeedIdentity={onNeedIdentity}
                />
              ))}
            </ul>
          ) : (
            <EmptyNote text="Nothing waiting to be told. When something pops into your head, leave it here for the other." />
          )}

          {/* Post a note — posted as whoever is signed in. */}
          {me === null ? (
            <div className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-sm font-semibold">Leave a note for later</p>
              <IdentityMiniPicker
                saving={identitySaving}
                error={identityError}
                onPick={onPickIdentity}
                accent="var(--sky)"
              />
            </div>
          ) : (
            <form
              onSubmit={onPost}
              className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <p className="text-sm font-semibold">Leave a note for later</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(["tell", "do", "news"] as TellYouLaterKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    aria-label={
                      k === "tell"
                        ? "This is something to tell the other"
                        : k === "do"
                          ? "This is something to remember to do"
                          : "This is good news to celebrate later"
                    }
                    onClick={() => setKind(k)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                      kind === k
                        ? "text-white shadow-sm"
                        : "border border-[var(--border)] bg-[var(--bg)]"
                    }`}
                    style={
                      kind === k ? { background: "var(--sky)" } : undefined
                    }
                  >
                    {KIND_META[k].chip}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label={
                    kind === "tell"
                      ? "What do you want to tell the other"
                      : kind === "do"
                        ? "What should you remember to do"
                        : "What is the good news"
                  }
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={KIND_META[kind].placeholder}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
                />
                <button
                  type="submit"
                  disabled={!text.trim() || pendingSubmit}
                  className="rounded-full bg-[var(--sky)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {pendingSubmit ? "Posting…" : "Post it →"}
                </button>
              </div>
              <input
                aria-label="When should this come up (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="When? (optional) — tonight, this weekend, when we're together…"
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              />
              {error && (
                <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>
              )}
            </form>
          )}

          {done.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer py-1 text-sm font-medium text-[var(--sage)]">
                ✓ Taken care of ({done.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {done.map((entry) => (
                  <TellYouLaterCard
                    key={entry.id}
                    entry={entry}
                    refresh={refresh}
                    me={me}
                    onNeedIdentity={onNeedIdentity}
                  />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function TellYouLaterCard({
  entry,
  refresh,
  me,
  onNeedIdentity,
}: {
  entry: TellYouLater;
  refresh: () => void;
  /** Who is signed in (null until they have picked a name). */
  me: Person | null;
  /** Open the first-run picker (when an action needs an identity). */
  onNeedIdentity: () => void;
}) {
  const supabase = createClient();
  const meta = KIND_META[entry.kind];
  const isOpen = !entry.is_done;

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onDone() {
    if (busy) return;
    if (!me) {
      onNeedIdentity();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await markTellYouLaterDone(supabase, entry.id, { done_by: me });
      refresh();
    } catch {
      setError("That didn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteTellYouLater(supabase, entry.id);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-sm ${!isOpen ? "opacity-80" : ""}`}
      style={{ borderLeft: "5px solid var(--sky)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
          style={{ background: "var(--sky)" }}
        >
          {meta.badge(entry.wanted_by)}
        </span>
        <span className="text-xs text-[var(--dim)]">
          {fmtWhen(entry.created_at)}
        </span>
        {!isOpen && (
          <span className="ml-auto rounded-full bg-[var(--sage-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--sage)]">
            {meta.doneBadge}
          </span>
        )}
      </div>

      <p className="font-display mt-2 text-xl font-semibold leading-tight">
        {entry.text}
      </p>
      {entry.note && (
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          {entry.note}
        </p>
      )}

      {!isOpen && entry.done_by && (
        <p className="mt-1.5 text-sm text-[var(--dim)]">
          {entry.done_by} {meta.doneVerb} it
          {entry.done_at ? ` · ${fmtWhen(entry.done_at)}` : ""}
        </p>
      )}

      {isOpen && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            aria-label={`Mark as ${meta.doneLabel.toLowerCase()}: ${entry.text}`}
            onClick={() => void onDone()}
            disabled={busy}
            className="rounded-full bg-[var(--sage)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            ✓ {meta.doneLabel}
          </button>
          {confirmingDelete ? (
            <span className="flex gap-1">
              <button
                type="button"
                aria-label={`Confirm delete note ${entry.text}`}
                onClick={() => void remove()}
                className="rounded-full bg-[var(--rose)] px-3 py-2 text-sm font-semibold text-white"
              >
                Delete
              </button>
              <button
                type="button"
                aria-label="Cancel delete note"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-full border border-[var(--border)] px-3 py-2 text-sm"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Delete note ${entry.text}`}
              onClick={() => setConfirmingDelete(true)}
              className="rounded-full px-2 py-2 text-sm text-[var(--dim)]"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {!isOpen && (
        <div className="mt-2 flex justify-end">
          {confirmingDelete ? (
            <span className="flex gap-1">
              <button
                type="button"
                aria-label={`Confirm delete note ${entry.text}`}
                onClick={() => void remove()}
                className="rounded-full bg-[var(--rose)] px-3 py-1.5 text-sm font-semibold text-white"
              >
                Delete
              </button>
              <button
                type="button"
                aria-label="Cancel delete note"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Delete note ${entry.text}`}
              onClick={() => setConfirmingDelete(true)}
              className="rounded-full px-2 py-1 text-xs text-[var(--dim)]"
            >
              Remove ✕
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>
      )}
    </li>
  );
}
