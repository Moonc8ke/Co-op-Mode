"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addCraving,
  deleteCraving,
  fulfillCraving,
} from "@/lib/data";
import { fmtWhen } from "@/lib/seasons";
import type { Craving, CravingKind, Person } from "@/lib/types";
import { IdentityMiniPicker } from "./identity";
import { EmptyNote, SectionHeader, sectionPanelStyle } from "./shared";

export function CravingsSection({
  cravings,
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
  cravings: Craving[];
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
  const open = cravings.filter((c) => c.status === "open");
  const fulfilled = cravings.filter((c) => c.status === "fulfilled");

  const [kind, setKind] = useState<CravingKind>("craving");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [error, setError] = useState("");

  async function onPost(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || pendingSubmit || !me) return;
    setPendingSubmit(true);
    setError("");
    try {
      await addCraving(supabase, {
        title: title.trim(),
        kind,
        note: note.trim(),
        wanted_by: me,
      });
      setTitle("");
      setNote("");
      refresh();
    } catch {
      setError("That craving didn't post. Please try again.");
    } finally {
      setPendingSubmit(false);
    }
  }

  return (
    <section
      aria-label="Cravings and wishes"
      className={`${compact ? "mt-8" : "mt-6"} rounded-[1.4rem] border border-[var(--border)] p-4 shadow-sm sm:p-5`}
      style={sectionPanelStyle("var(--plum-soft)")}
    >
      <SectionHeader
        emoji="🤤"
        label="Cravings"
        blurb="Craving something, or looking for a thing? Post it here so the other can surprise you."
        color="var(--plum)"
        pill={open.length > 0 ? `${open.length} open` : undefined}
        collapsed={collapsed}
        onToggle={onToggleCollapsed}
      />

      {!collapsed && (
        <>
      {open.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {open.map((c) => (
            <CravingCard
              key={c.id}
              craving={c}
              refresh={refresh}
              me={me}
              onNeedIdentity={onNeedIdentity}
            />
          ))}
        </ul>
      ) : (
        <EmptyNote text="Nothing on the craving board. Post a hankering below and see if the other stumbles across it." />
      )}

      {/* Post a craving — posted as whoever is signed in. */}
      {me === null ? (
        <div className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-sm font-semibold">Post a craving or a wish</p>
          <IdentityMiniPicker
            saving={identitySaving}
            error={identityError}
            onPick={onPickIdentity}
            accent="var(--plum)"
          />
        </div>
      ) : (
        <form
          onSubmit={onPost}
          className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3"
        >
          <p className="text-sm font-semibold">Post a craving or a wish</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--dim)]">I&apos;m</span>
            {(["craving", "looking_for"] as CravingKind[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                aria-label={
                  k === "craving"
                    ? "This is a craving"
                    : "This is something I am looking for"
                }
                onClick={() => setKind(k)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                  kind === k
                    ? "text-white shadow-sm"
                    : "border border-[var(--border)] bg-[var(--bg)]"
                }`}
                style={
                  kind === k ? { background: "var(--plum)" } : undefined
                }
              >
                {k === "craving" ? "craving" : "looking for"}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              aria-label={
                kind === "craving"
                  ? "What are you craving"
                  : "What are you looking for"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                kind === "craving"
                  ? "What are you craving? Ice cream, tacos, that bakery croissant…"
                  : "What are you looking for? A book, a game, that jacket you saw…"
              }
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
            />
            <button
              type="submit"
              disabled={!title.trim() || pendingSubmit}
              className="rounded-full bg-[var(--plum)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {pendingSubmit ? "Posting…" : "Post it →"}
            </button>
          </div>
          <input
            aria-label="Note for this craving (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional) — where you saw it, which brand, the flavour…"
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          />
          {error && <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>}
        </form>
      )}

      {fulfilled.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer py-1 text-sm font-medium text-[var(--sage)]">
            ✓ Taken care of ({fulfilled.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {fulfilled.map((c) => (
              <CravingCard
                key={c.id}
                craving={c}
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

function CravingCard({
  craving,
  refresh,
  me,
  onNeedIdentity,
}: {
  craving: Craving;
  refresh: () => void;
  /** Who is signed in (null until they have picked a name). */
  me: Person | null;
  /** Open the first-run picker (when an action needs an identity). */
  onNeedIdentity: () => void;
}) {
  const supabase = createClient();
  const isOpen = craving.status === "open";

  const [showFulfill, setShowFulfill] = useState(false);
  const [fulfilledNote, setFulfilledNote] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFulfill(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!me) {
      onNeedIdentity();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await fulfillCraving(supabase, craving.id, {
        fulfilled_by: me,
        fulfilled_note: fulfilledNote.trim(),
      });
      setShowFulfill(false);
      setFulfilledNote("");
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
      await deleteCraving(supabase, craving.id);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-sm ${!isOpen ? "opacity-80" : ""}`}
      style={{ borderLeft: "5px solid var(--plum)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
          style={{ background: "var(--plum)" }}
        >
          {craving.wanted_by}{" "}
          {craving.kind === "craving" ? "is craving" : "is looking for"}
        </span>
        <span className="text-xs text-[var(--dim)]">
          {fmtWhen(craving.created_at)}
        </span>
        {!isOpen && (
          <span className="ml-auto rounded-full bg-[var(--sage-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--sage)]">
            ✓ Got it
          </span>
        )}
      </div>

      <p className="font-display mt-2 text-xl font-semibold leading-tight">
        {craving.title}
      </p>
      {craving.note && (
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          {craving.note}
        </p>
      )}

      {!isOpen && craving.fulfilled_by && (
        <p className="mt-1.5 text-sm text-[var(--dim)]">
          {craving.fulfilled_by} got it
          {craving.fulfilled_note ? ` — ${craving.fulfilled_note}` : ""}
          {craving.fulfilled_at ? ` · ${fmtWhen(craving.fulfilled_at)}` : ""}
        </p>
      )}

      {isOpen && (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          {!showFulfill ? (
            <div className="mt-1 flex flex-wrap gap-2">
              <button
                type="button"
                aria-label={`Mark craving as got it: ${craving.title}`}
                onClick={() => {
                  if (!me) {
                    onNeedIdentity();
                    return;
                  }
                  setShowFulfill(true);
                }}
                disabled={busy}
                className="rounded-full bg-[var(--sage)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                ✓ Got it
              </button>
              {confirmingDelete ? (
                <span className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Confirm delete craving ${craving.title}`}
                    onClick={() => void remove()}
                    className="rounded-full bg-[var(--rose)] px-3 py-2 text-sm font-semibold text-white"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel delete craving"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-full border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={`Delete craving ${craving.title}`}
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-full px-2 py-2 text-sm text-[var(--dim)]"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            <form
              onSubmit={onFulfill}
              className="mt-2 rounded-xl bg-[var(--bg)] p-3"
            >
              <p className="text-sm font-medium">
                Got it{me ? `, ${me}` : ""}? Add a note if you like.
              </p>
              <input
                aria-label="Note about where you found it (optional)"
                value={fulfilledNote}
                onChange={(e) => setFulfilledNote(e.target.value)}
                placeholder="Note (optional) — where you found it, which shop…"
                autoFocus
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-[var(--sage)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {busy ? "Saving…" : "✓ Mark it got"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowFulfill(false)}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium"
                >
                  Never mind
                </button>
              </div>
              {error && (
                <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>
              )}
            </form>
          )}
          {error && !showFulfill && (
            <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>
          )}
        </div>
      )}

      {!isOpen && (
        <div className="mt-2 flex justify-end">
          {confirmingDelete ? (
            <span className="flex gap-1">
              <button
                type="button"
                aria-label={`Confirm delete craving ${craving.title}`}
                onClick={() => void remove()}
                className="rounded-full bg-[var(--rose)] px-3 py-1.5 text-sm font-semibold text-white"
              >
                Delete
              </button>
              <button
                type="button"
                aria-label="Cancel delete craving"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Delete craving ${craving.title}`}
              onClick={() => setConfirmingDelete(true)}
              className="rounded-full px-2 py-1 text-xs text-[var(--dim)]"
            >
              Remove ✕
            </button>
          )}
        </div>
      )}
    </li>
  );
}
