"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addItem,
  deleteItem,
  setItemStatus,
} from "@/lib/data";
import { CATEGORY_META, SEASONAL_SUGGESTIONS, SUGGESTIONS } from "@/lib/suggestions";
import { fmtFull, SEASONS, seasonFor, SEASON_EMOJI } from "@/lib/seasons";
import type { Category, Item, Season } from "@/lib/types";
import { DetailDialog, EmptyNote, SectionHeader, sectionPanelStyle } from "./shared";
import { useBackLayer } from "@/lib/back-nav";

export function CategorySection({
  category,
  items,
  refresh,
  // On the home page the collections are browse-only: the add form and
  // suggestion chips stay on the Add & browse page, which is the place
  // for adding new things.
  showAdd = true,
  // On the home page each section can be tucked away with the little
  // arrow in its header. When these aren't given (the Add & browse
  // page), the section is always open and has no arrow.
  collapsed,
  onToggleCollapsed,
}: {
  category: Category;
  items: Item[];
  refresh: () => void;
  showAdd?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const meta = CATEGORY_META[category];
  const mine = items.filter((i) => i.category === category);
  const open = mine.filter((i) => i.status === "idea");
  const done = mine.filter((i) => i.status === "done");

  return (
    <section
      aria-label={meta.label}
      className="mt-8 rounded-[1.4rem] border border-[var(--border)] p-4 shadow-sm sm:p-5"
      style={sectionPanelStyle(meta.soft)}
    >
      <SectionHeader
        emoji={
          category === "seasonal"
            ? SEASON_EMOJI[seasonFor(new Date())]
            : meta.emoji
        }
        label={meta.label}
        blurb={meta.blurb}
        color={meta.color}
        pill={
          mine.length > 0 ? `${done.length}/${mine.length} done` : undefined
        }
        collapsed={collapsed}
        onToggle={onToggleCollapsed}
      />

      {!collapsed && (
        <>
          {category === "seasonal" ? (
            <SeasonalLists open={open} done={done} refresh={refresh} />
          ) : (
            <>
              {open.length === 0 && done.length === 0 ? (
                <EmptyNote
                  text={
                    showAdd
                      ? "Nothing here yet. Add your first idea below, or tap a suggestion."
                      : "Nothing here yet. Tap “Add new things” to add your first idea."
                  }
                />
              ) : (
                <ul className="mt-3 space-y-2">
                  {open.map((i) => (
                    <ItemCard key={i.id} item={i} refresh={refresh} />
                  ))}
                </ul>
              )}
              {done.length > 0 && (
                <DoneGroup
                  done={done}
                  label="Done together"
                  refresh={refresh}
                />
              )}
            </>
          )}

          {showAdd && (
            <>
              <AddItemForm category={category} refresh={refresh} />
              <Suggestions
                category={category}
                existing={mine}
                refresh={refresh}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}

function SeasonalLists({
  open,
  done,
  refresh,
}: {
  open: Item[];
  done: Item[];
  refresh: () => void;
}) {
  const current = seasonFor(new Date());
  const start = SEASONS.indexOf(current);
  const ordered = [...SEASONS.slice(start), ...SEASONS.slice(0, start)];
  const anyOpen = open.length > 0;
  return (
    <div className="mt-3 space-y-4">
      {!anyOpen && done.length === 0 && (
        <EmptyNote text="Nothing here yet. Add a wish for this season below, or tap a suggestion." />
      )}
      {ordered.map((s) => {
        const group = open.filter((i) => i.season === s);
        if (group.length === 0) return null;
        return (
          <div key={s}>
            <h3 className="text-sm font-semibold tracking-wide text-[var(--dim)]">
              {SEASON_EMOJI[s]} {s}
              {s === current ? " · this season" : ""}
            </h3>
            <ul className="mt-2 space-y-2">
              {group.map((i) => (
                <ItemCard key={i.id} item={i} refresh={refresh} />
              ))}
            </ul>
          </div>
        );
      })}
      {done.length > 0 && (
        <DoneGroup done={done} label="Seasonal memories" refresh={refresh} />
      )}
    </div>
  );
}

function DoneGroup({
  done,
  label,
  refresh,
}: {
  done: Item[];
  label: string;
  refresh: () => void;
}) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer py-1 text-sm font-medium text-[var(--sage)]">
        ✓ {label} ({done.length})
      </summary>
      <ul className="mt-2 space-y-2">
        {done.map((i) => (
          <ItemCard key={i.id} item={i} refresh={refresh} />
        ))}
      </ul>
    </details>
  );
}

export function ItemCard({
  item,
  refresh,
}: {
  item: Item;
  refresh: () => void;
}) {
  const supabase = createClient();
  const meta = CATEGORY_META[item.category];
  const [confirming, setConfirming] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const isDone = item.status === "done";

  // Back navigation: the detail is a back step (see src/lib/back-nav.ts).
  const detailNav = useBackLayer("item-detail", showDetail, () =>
    setShowDetail(false),
  );

  useEffect(() => {
    if (!showDetail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") detailNav.closeViaUi();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDetail, detailNav]);

  async function toggleDone(checked: boolean) {
    setBusy(true);
    try {
      await setItemStatus(supabase, item.id, checked ? "done" : "idea");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteItem(supabase, item.id);
      // Same shared-delete shape as calendar events: closing from
      // inside the detail unwinds its history entry; deleting from
      // the list row just runs the close with nothing to unwind.
      detailNav.closeViaUi();
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <li
        className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm"
        style={{ borderLeft: `5px solid ${meta.color}` }}
      >
        <input
          type="checkbox"
          checked={isDone}
          disabled={busy}
          aria-label={`Mark “${item.title}” as done`}
          onChange={(e) => void toggleDone(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0"
          style={{ accentColor: meta.color }}
        />
        <button
          type="button"
          onClick={() => {
            setShowDetail(true);
            detailNav.open();
          }}
          aria-label={`View details for ${item.title}`}
          aria-haspopup="dialog"
          className="min-w-0 flex-1 rounded-lg text-left"
        >
          <span
            className={`block font-medium ${isDone ? "text-[var(--dim)] line-through decoration-2" : ""}`}
          >
            {item.title}
          </span>
          {item.notes && (
            <span className="mt-0.5 line-clamp-2 block text-sm text-[var(--dim)]">
              {item.notes}
            </span>
          )}
          {isDone && item.done_at && (
            <span className="mt-0.5 block text-xs font-medium text-[var(--sage)]">
              ✓ Done {fmtFull(item.done_at.slice(0, 10))}
            </span>
          )}
          <span
            className="mt-1 block text-xs font-semibold"
            style={{ color: meta.color }}
          >
            Tap for details →
          </span>
        </button>
        {confirming ? (
          <span className="flex shrink-0 gap-1">
            <button
              type="button"
              aria-label={`Confirm delete “${item.title}”`}
              onClick={() => void remove()}
              className="rounded-full bg-[var(--rose)] px-3 py-1.5 text-sm font-semibold text-white"
            >
              Delete
            </button>
            <button
              type="button"
              aria-label="Cancel delete"
              onClick={() => setConfirming(false)}
              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Delete “${item.title}”`}
            onClick={() => setConfirming(true)}
            className="shrink-0 rounded-full px-2 py-1.5 text-[var(--dim)]"
          >
            ✕
          </button>
        )}
      </li>

      {showDetail && (
        <DetailDialog
          label={`Details for ${item.title}`}
          onClose={() => detailNav.closeViaUi()}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[22px] shadow-sm"
              style={{ background: meta.color }}
            >
              {meta.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: meta.color }}
              >
                {meta.label}
                {item.season ? ` · ${item.season}` : ""}
                {isDone ? " · Done" : " · Still to do"}
              </p>
              <h3 className="font-display mt-1 text-2xl font-semibold leading-tight">
                {item.title}
              </h3>
            </div>
            <button
              type="button"
              aria-label="Close details"
              onClick={() => detailNav.closeViaUi()}
              className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm font-medium"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-[var(--bg)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
                About this one
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-base leading-relaxed">
                {item.notes ? (
                  item.notes
                ) : (
                  <span className="text-[var(--dim)]">
                    No extra details were added for this one yet.
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-[var(--dim)]">{meta.blurb}</p>
            </div>
            <div className="rounded-xl bg-[var(--bg)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
                Status
              </p>
              <p className="mt-0.5 text-base">
                {isDone
                  ? `✓ Checked off${item.done_at ? ` on ${fmtFull(item.done_at.slice(0, 10))}` : ""} — kept as a memory.`
                  : "Still an idea, waiting for its moment."}
              </p>
              {item.season && (
                <p className="mt-0.5 text-sm text-[var(--dim)]">
                  Season: {item.season} {SEASON_EMOJI[item.season]}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => detailNav.closeViaUi()}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: meta.color }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void toggleDone(!isDone)}
              className="rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-medium"
            >
              {isDone ? "Move back to ideas" : "Mark as done ✓"}
            </button>
            {confirming ? (
              <>
                <button
                  type="button"
                  aria-label={`Confirm delete “${item.title}”`}
                  onClick={() => void remove()}
                  disabled={busy}
                  className="rounded-full bg-[var(--rose)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {busy ? "Deleting…" : "Confirm delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-medium"
                >
                  Keep it
                </button>
              </>
            ) : (
              <button
                type="button"
                aria-label={`Delete “${item.title}”`}
                onClick={() => setConfirming(true)}
                className="rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--rose)]"
              >
                Delete
              </button>
            )}
          </div>
        </DetailDialog>
      )}
    </>
  );
}

function AddItemForm({
  category,
  refresh,
}: {
  category: Category;
  refresh: () => void;
}) {
  const supabase = createClient();
  const meta = CATEGORY_META[category];
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [season, setSeason] = useState<Season>(seasonFor(new Date()));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || pending) return;
    setPending(true);
    setError("");
    try {
      await addItem(supabase, {
        category,
        title: title.trim(),
        notes: notes.trim(),
        season: category === "seasonal" ? season : null,
      });
      setTitle("");
      setNotes("");
      refresh();
    } catch {
      setError("That didn't save. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label={`New ${meta.label} idea`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            category === "places"
              ? "Add a place — restaurant, café, park, shop…"
              : `Add to ${meta.label.toLowerCase()}…`
          }
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
        />
        {category === "seasonal" && (
          <select
            aria-label="Season for this idea"
            value={season}
            onChange={(e) => setSeason(e.target.value as Season)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
          >
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {SEASON_EMOJI[s]} {s}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={!title.trim() || pending}
          className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--bg)] disabled:opacity-40"
          style={{ background: meta.color }}
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <input
        aria-label={`Notes for new ${meta.label} idea (optional)`}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={
          category === "places"
            ? "Notes (optional) — neighborhood, cuisine, or why you want to try it"
            : "Notes (optional) — a place, a link, a detail to remember"
        }
        className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
      />
      {error && <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>}
    </form>
  );
}

function Suggestions({
  category,
  existing,
  refresh,
}: {
  category: Category;
  existing: Item[];
  refresh: () => void;
}) {
  const supabase = createClient();
  const meta = CATEGORY_META[category];
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const existingTitles = new Set(existing.map((i) => i.title.toLowerCase()));
  const suggestionList =
    category === "seasonal"
      ? SEASONAL_SUGGESTIONS[seasonFor(new Date())]
      : SUGGESTIONS[category];
  const remaining = suggestionList.filter(
    (s) => !existingTitles.has(s.toLowerCase()),
  );
  if (remaining.length === 0) return null;

  async function addSuggestion(title: string) {
    setPendingTitle(title);
    try {
      await addItem(supabase, {
        category,
        title,
        notes: "",
        season: category === "seasonal" ? seasonFor(new Date()) : null,
      });
      refresh();
    } finally {
      setPendingTitle(null);
    }
  }

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
        {category === "seasonal"
          ? `Need a spark? ${seasonFor(new Date())} ideas — tap to add`
          : "Need a spark? Tap to add"}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {remaining.map((s) => (
          <button
            key={s}
            type="button"
            aria-label={`Add suggestion: ${s}`}
            disabled={pendingTitle === s}
            onClick={() => void addSuggestion(s)}
            className="rounded-full border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            style={{
              background: "var(--surface)",
              borderColor: meta.color,
              color: meta.color,
            }}
          >
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}
