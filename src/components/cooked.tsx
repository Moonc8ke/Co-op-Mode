"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addCookedDish,
  deleteCookedDish,
  rateDish,
} from "@/lib/data";
import { fmtFull, todayStr } from "@/lib/seasons";
import type { CookedDish, DishRating, Person } from "@/lib/types";
import { IdentityMiniPicker } from "./identity";
import { EmptyNote, SectionHeader, sectionPanelStyle } from "./shared";

/** Renders stars as filled/empty glyphs, e.g. ★★★☆☆ for 3 of 5. */
function Stars({ value, size }: { value: number; size?: string }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span
      aria-label={`${value} out of 5 stars`}
      className={size ?? "text-base leading-none"}
    >
      {"★".repeat(filled)}
      {"☆".repeat(5 - filled)}
    </span>
  );
}

export function CookedSection({
  dishes,
  ratings,
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
  dishes: CookedDish[];
  ratings: DishRating[];
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

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayStr());
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [error, setError] = useState("");

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || pendingSubmit || !me) return;
    setPendingSubmit(true);
    setError("");
    try {
      await addCookedDish(supabase, {
        title: title.trim(),
        cooked_date: date,
        cooked_by: me,
      });
      setTitle("");
      setDate(todayStr());
      refresh();
    } catch {
      setError("That didn't save. Please try again.");
    } finally {
      setPendingSubmit(false);
    }
  }

  return (
    <section
      aria-label="Cooked together"
      className="mt-6 rounded-[1.4rem] border border-[var(--border)] p-4 shadow-sm sm:p-5"
      style={sectionPanelStyle("var(--gold-soft)")}
    >
      <SectionHeader
        emoji="🍳"
        label="Cooked together"
        blurb="The dishes you've made together, and how each of you rated them."
        color="var(--gold)"
        pill={dishes.length > 0 ? `${dishes.length} cooked` : undefined}
        collapsed={collapsed}
        onToggle={onToggleCollapsed}
      />

      {!collapsed && (
        <>
          {dishes.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {dishes.map((dish) => (
                <DishCard
                  key={dish.id}
                  dish={dish}
                  ratings={ratings.filter((r) => r.dish_id === dish.id)}
                  refresh={refresh}
                  me={me}
                  onNeedIdentity={onNeedIdentity}
                />
              ))}
            </ul>
          ) : (
            <EmptyNote text="Nothing cooked yet. Make something together, then log it here — or tap “Cooked it” on a recipe idea." />
          )}

          {/* Log a dish straight from here — logged as whoever is
              signed in. Dishes from a recipe idea come in through
              that idea's “Cooked it” button instead. */}
          {me === null ? (
            <div className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-sm font-semibold">Log a dish you cooked</p>
              <IdentityMiniPicker
                saving={identitySaving}
                error={identityError}
                onPick={onPickIdentity}
                accent="var(--gold)"
              />
            </div>
          ) : (
            <form
              onSubmit={onAdd}
              className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <p className="text-sm font-semibold">Log a dish you cooked</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label="Dish you cooked"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What did you make? Sheet-pan chicken, chili…"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
                />
                <input
                  type="date"
                  aria-label="Date cooked"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
                />
                <button
                  type="submit"
                  disabled={!title.trim() || !date || pendingSubmit}
                  className="rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {pendingSubmit ? "Saving…" : "Log it →"}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>
              )}
            </form>
          )}
        </>
      )}
    </section>
  );
}

function DishCard({
  dish,
  ratings,
  refresh,
  me,
  onNeedIdentity,
}: {
  dish: CookedDish;
  ratings: DishRating[];
  refresh: () => void;
  /** Who is signed in (null until they have picked a name). */
  me: Person | null;
  /** Open the first-run picker (when an action needs an identity). */
  onNeedIdentity: () => void;
}) {
  const supabase = createClient();
  const myRating = me
    ? (ratings.find((r) => r.rated_by === me) ?? null)
    : null;
  const average =
    ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length
      : null;

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onRate(stars: number) {
    if (busy) return;
    if (!me) {
      onNeedIdentity();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await rateDish(supabase, {
        dish_id: dish.id,
        rated_by: me,
        stars,
      });
      refresh();
    } catch {
      setError("That rating didn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteCookedDish(supabase, dish.id);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-sm"
      style={{ borderLeft: "5px solid var(--gold)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold leading-tight">
            {dish.title}
          </p>
          <p className="mt-0.5 text-sm text-[var(--dim)]">
            Cooked {fmtFull(dish.cooked_date)}
            {dish.cooked_by ? ` · by ${dish.cooked_by}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--gold-soft)] px-2.5 py-1 text-sm font-semibold text-[var(--gold)]">
          {average === null ? (
            "No ratings yet"
          ) : (
            <>
              ★ {average.toFixed(1)} · {ratings.length}{" "}
              {ratings.length === 1 ? "rating" : "ratings"}
            </>
          )}
        </span>
      </div>

      {ratings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {ratings.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{r.rated_by}</span>
              <span className="text-[var(--gold)]">
                <Stars value={r.stars} />
              </span>
              {r.note && (
                <span className="text-[var(--dim)]">— {r.note}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <p className="text-sm font-medium">
          {myRating
            ? `Your rating: ${myRating.stars} of 5 — tap to change it`
            : "How was it? Tap a star to rate it"}
        </p>
        <div className="mt-1.5 flex items-center gap-1" role="radiogroup" aria-label={`Rate ${dish.title}`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={myRating?.stars === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => void onRate(n)}
              disabled={busy}
              className={`text-2xl leading-none disabled:opacity-40 ${
                myRating && n <= myRating.stars
                  ? "text-[var(--gold)]"
                  : "text-[var(--border)]"
              }`}
            >
              ★
            </button>
          ))}
          {myRating && (
            <span className="ml-2 text-sm text-[var(--dim)]">
              You gave it {myRating.stars}/5
            </span>
          )}
        </div>
        {error && <p className="mt-1.5 text-sm text-[var(--rose)]">{error}</p>}
      </div>

      <div className="mt-2 flex justify-end">
        {confirmingDelete ? (
          <span className="flex gap-1">
            <button
              type="button"
              aria-label={`Confirm delete cooked dish ${dish.title}`}
              onClick={() => void remove()}
              className="rounded-full bg-[var(--rose)] px-3 py-1.5 text-sm font-semibold text-white"
            >
              Delete
            </button>
            <button
              type="button"
              aria-label="Cancel delete cooked dish"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Delete cooked dish ${dish.title}`}
            onClick={() => setConfirmingDelete(true)}
            className="rounded-full px-2 py-1 text-xs text-[var(--dim)]"
          >
            Remove ✕
          </button>
        )}
      </div>
    </li>
  );
}
