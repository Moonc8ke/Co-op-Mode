"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addGroceryItem,
  deleteGroceryItem,
  setGroceryItemDone,
} from "@/lib/data";
import { fmtWhen } from "@/lib/seasons";
import type { GroceryItem, Person } from "@/lib/types";
import { IdentityMiniPicker } from "./identity";
import { EmptyNote, SectionHeader, sectionPanelStyle } from "./shared";

export function GrocerySection({
  items,
  refresh,
  me,
  onPickIdentity,
  onNeedIdentity,
  identitySaving,
  identityError,
  // On the home page the section can be tucked away with the little
  // arrow in its header. When these aren't given, the section is
  // always open and has no arrow.
  collapsed,
  onToggleCollapsed,
}: {
  items: GroceryItem[];
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
  const open = items.filter((i) => !i.is_done);
  const pickedUp = items.filter((i) => i.is_done);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [error, setError] = useState("");

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || pendingSubmit || !me) return;
    setPendingSubmit(true);
    setError("");
    try {
      await addGroceryItem(supabase, {
        title: title.trim(),
        note: note.trim(),
        wanted_by: me,
      });
      setTitle("");
      setNote("");
      refresh();
    } catch {
      setError("That didn't add. Please try again.");
    } finally {
      setPendingSubmit(false);
    }
  }

  return (
    <section
      aria-label="Grocery list"
      className="mt-6 rounded-[1.4rem] border border-[var(--border)] p-4 shadow-sm sm:p-5"
      style={sectionPanelStyle("var(--sky-soft)")}
    >
      <SectionHeader
        emoji="🛒"
        label="Grocery list"
        blurb="What do we need from the shop? Add it here and check it off together."
        color="var(--sky)"
        pill={open.length > 0 ? `${open.length} to get` : undefined}
        collapsed={collapsed}
        onToggle={onToggleCollapsed}
      />

      {!collapsed && (
        <>
          {open.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {open.map((item) => (
                <GroceryCard
                  key={item.id}
                  item={item}
                  refresh={refresh}
                  me={me}
                  onNeedIdentity={onNeedIdentity}
                />
              ))}
            </ul>
          ) : (
            <EmptyNote text="The list is empty. Add what you need for the next shop below." />
          )}

          {/* Add an item — added as whoever is signed in. */}
          {me === null ? (
            <div className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-sm font-semibold">Add to the grocery list</p>
              <IdentityMiniPicker
                saving={identitySaving}
                error={identityError}
                onPick={onPickIdentity}
                accent="var(--sky)"
              />
            </div>
          ) : (
            <form
              onSubmit={onAdd}
              className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <p className="text-sm font-semibold">Add to the grocery list</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label="Grocery item"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What do we need? Milk, sage, coffee beans…"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
                />
                <input
                  aria-label="Quantity or detail (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="How much? (optional) — 2 lbs, a dozen…"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base sm:max-w-52"
                />
                <button
                  type="submit"
                  disabled={!title.trim() || pendingSubmit}
                  className="rounded-full bg-[var(--sky)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {pendingSubmit ? "Adding…" : "Add it →"}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>
              )}
            </form>
          )}

          {pickedUp.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer py-1 text-sm font-medium text-[var(--sage)]">
                ✓ Picked up ({pickedUp.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {pickedUp.map((item) => (
                  <GroceryCard
                    key={item.id}
                    item={item}
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

function GroceryCard({
  item,
  refresh,
  me,
  onNeedIdentity,
}: {
  item: GroceryItem;
  refresh: () => void;
  /** Who is signed in (null until they have picked a name). */
  me: Person | null;
  /** Open the first-run picker (when an action needs an identity). */
  onNeedIdentity: () => void;
}) {
  const supabase = createClient();
  const isDone = item.is_done;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggleDone(next: boolean) {
    if (busy) return;
    if (next && !me) {
      onNeedIdentity();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await setGroceryItemDone(supabase, item.id, next, next ? me : null);
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
      await deleteGroceryItem(supabase, item.id);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={`flex items-start gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm ${isDone ? "opacity-80" : ""}`}
      style={{ borderLeft: "5px solid var(--sky)" }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={isDone}
        aria-label={
          isDone
            ? `Put “${item.title}” back on the list`
            : `Check off “${item.title}” as picked up`
        }
        onClick={() => void toggleDone(!isDone)}
        disabled={busy}
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm font-bold disabled:opacity-40 ${
          isDone
            ? "border-[var(--sage)] bg-[var(--sage)] text-white"
            : "border-[var(--border)] bg-[var(--bg)] text-transparent"
        }`}
      >
        ✓
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`font-medium leading-tight ${isDone ? "text-[var(--dim)] line-through decoration-2" : ""}`}
        >
          {item.title}
          {item.note && (
            <span className="font-normal text-[var(--dim)]">
              {" "}
              · {item.note}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-[var(--dim)]">
          Added by {item.wanted_by} · {fmtWhen(item.created_at)}
          {isDone && item.done_by && (
            <>
              {" · "}
              ✓ {item.done_by} picked it up
              {item.done_at ? ` · ${fmtWhen(item.done_at)}` : ""}
            </>
          )}
        </p>
        {error && <p className="mt-1 text-sm text-[var(--rose)]">{error}</p>}
      </div>
      {confirmingDelete ? (
        <span className="flex shrink-0 gap-1">
          <button
            type="button"
            aria-label={`Confirm delete grocery item ${item.title}`}
            onClick={() => void remove()}
            className="rounded-full bg-[var(--rose)] px-3 py-1.5 text-sm font-semibold text-white"
          >
            Delete
          </button>
          <button
            type="button"
            aria-label="Cancel delete grocery item"
            onClick={() => setConfirmingDelete(false)}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Keep
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-label={`Delete grocery item ${item.title}`}
          onClick={() => setConfirmingDelete(true)}
          className="shrink-0 rounded-full px-2 py-1.5 text-[var(--dim)]"
        >
          ✕
        </button>
      )}
    </li>
  );
}
