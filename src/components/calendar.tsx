"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { addEvent, deleteEvent } from "@/lib/data";
import { fmtDay, fmtFull, relDay, todayStr } from "@/lib/seasons";
import type { CalEvent } from "@/lib/types";
import { DetailDialog, EmptyNote, SectionHeader, sectionPanelStyle } from "./shared";

export function CalendarSection({
  events,
  refresh,
}: {
  events: CalEvent[];
  refresh: () => void;
}) {
  const today = todayStr();
  const upcoming = events.filter((e) => e.event_date >= today);
  const past = events.filter((e) => e.event_date < today);
  return (
    <section
      aria-label="Shared calendar"
      className="mt-8 rounded-[1.4rem] border border-[var(--border)] p-4 shadow-sm sm:p-5"
      style={sectionPanelStyle("var(--teal-soft)")}
    >
      <SectionHeader
        emoji="🗓️"
        label="Shared Calendar"
        blurb="Plans you're looking forward to, in one place you both check."
        color="var(--teal)"
        pill={upcoming.length > 0 ? `${upcoming.length} coming up` : undefined}
      />

      {upcoming.length === 0 ? (
        <EmptyNote text="No plans coming up. Add your next date, trip, or just a cozy night in." />
      ) : (
        <ul className="mt-3 space-y-2">
          {upcoming.map((e) => (
            <EventCard key={e.id} event={e} refresh={refresh} />
          ))}
        </ul>
      )}

      <AddEventForm refresh={refresh} />

      {past.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer py-1 text-sm font-medium text-[var(--dim)]">
            Past plans ({past.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {[...past].reverse().map((e) => (
              <EventCard key={e.id} event={e} past refresh={refresh} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function EventCard({
  event,
  past,
  refresh,
}: {
  event: CalEvent;
  past?: boolean;
  refresh: () => void;
}) {
  const supabase = createClient();
  const [confirming, setConfirming] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rel = relDay(event.event_date);

  useEffect(() => {
    if (!showDetail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDetail(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDetail]);

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await deleteEvent(supabase, event.id);
      setShowDetail(false);
      refresh();
    } catch {
      setError("That didn't delete. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <li
        className={`flex items-start gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm ${past ? "opacity-70" : ""}`}
      >
        <button
          type="button"
          onClick={() => setShowDetail(true)}
          aria-label={`View details for ${event.title}`}
          aria-haspopup="dialog"
          className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left"
        >
          <span className="w-14 shrink-0 rounded-lg bg-[var(--teal-soft)] px-1 py-1.5 text-center">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-[var(--teal)]">
              {new Date(`${event.event_date}T00:00:00`).toLocaleDateString(
                "en-US",
                { month: "short" },
              )}
            </span>
            <span className="font-display block text-xl font-bold leading-none text-[var(--teal)]">
              {Number(event.event_date.slice(8, 10))}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{event.title}</span>
            <span className="mt-0.5 block text-sm text-[var(--dim)]">
              {fmtDay(event.event_date)}
              {rel ? ` · ${rel}` : ""}
              {event.event_time ? ` · ${event.event_time}` : ""}
              {event.location ? ` · ${event.location}` : ""}
            </span>
            {event.notes && (
              <span className="mt-0.5 line-clamp-2 block text-sm text-[var(--dim)]">
                {event.notes}
              </span>
            )}
            <span className="mt-1 block text-xs font-semibold text-[var(--teal)]">
              Tap for details →
            </span>
          </span>
        </button>
        {confirming ? (
          <span className="flex shrink-0 gap-1">
            <button
              type="button"
              aria-label={`Confirm delete plan “${event.title}”`}
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
            aria-label={`Delete plan “${event.title}”`}
            onClick={() => setConfirming(true)}
            className="shrink-0 rounded-full px-2 py-1.5 text-[var(--dim)]"
          >
            ✕
          </button>
        )}
      </li>

      {showDetail && (
        <DetailDialog
          label={`Details for ${event.title}`}
          onClose={() => setShowDetail(false)}
        >
          <div className="flex items-start gap-3">
            <div className="w-16 shrink-0 rounded-xl bg-[var(--teal-soft)] px-1 py-2 text-center">
              <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--teal)]">
                {new Date(`${event.event_date}T00:00:00`).toLocaleDateString(
                  "en-US",
                  { month: "short" },
                )}
              </div>
              <div className="font-display text-2xl font-bold leading-none text-[var(--teal)]">
                {Number(event.event_date.slice(8, 10))}
              </div>
              <div className="mt-0.5 text-[11px] font-medium text-[var(--teal)]">
                {new Date(`${event.event_date}T00:00:00`).toLocaleDateString(
                  "en-US",
                  { weekday: "short" },
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--teal)]">
                🗓️ Calendar plan{rel ? ` · ${rel}` : ""}
              </p>
              <h3 className="font-display mt-1 text-2xl font-semibold leading-tight">
                {event.title}
              </h3>
              <p className="mt-1 text-sm text-[var(--dim)]">
                {fmtFull(event.event_date)}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close event details"
              onClick={() => setShowDetail(false)}
              className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm font-medium"
            >
              ✕
            </button>
          </div>

          <dl className="mt-4 space-y-3">
            <div className="rounded-xl bg-[var(--bg)] p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
                When
              </dt>
              <dd className="mt-0.5 text-base">
                {fmtDay(event.event_date)} — {fmtFull(event.event_date)}
                {rel ? (
                  <span className="text-[var(--dim)]"> ({rel})</span>
                ) : null}
              </dd>
              {event.event_time ? (
                <dd className="mt-0.5 text-sm text-[var(--dim)]">
                  Time: {event.event_time}
                </dd>
              ) : (
                <dd className="mt-0.5 text-sm text-[var(--dim)]">
                  No set time — an all-day plan
                </dd>
              )}
            </div>

            <div className="rounded-xl bg-[var(--bg)] p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
                Where
              </dt>
              <dd className="mt-0.5 text-base">
                {event.location ? (
                  event.location
                ) : (
                  <span className="text-[var(--dim)]">
                    No location added yet
                  </span>
                )}
              </dd>
            </div>

            <div className="rounded-xl bg-[var(--bg)] p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
                About this event
              </dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-base leading-relaxed">
                {event.notes ? (
                  event.notes
                ) : (
                  <span className="text-[var(--dim)]">
                    No extra details were added for this one. You can add
                    notes like tickets, what to bring, or who&apos;s driving
                    from the Add page.
                  </span>
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowDetail(false)}
              className="rounded-full bg-[var(--teal)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Close
            </button>
            {confirming ? (
              <>
                <button
                  type="button"
                  aria-label={`Confirm delete plan “${event.title}”`}
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
                aria-label={`Delete plan “${event.title}”`}
                onClick={() => setConfirming(true)}
                className="rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--rose)]"
              >
                Delete this plan
              </button>
            )}
          </div>
          {error && (
            <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>
          )}
        </DetailDialog>
      )}
    </>
  );
}

function AddEventForm({ refresh }: { refresh: () => void }) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || pending) return;
    setPending(true);
    setError("");
    try {
      await addEvent(supabase, {
        title: title.trim(),
        event_date: date,
        event_time: time.trim(),
        location: location.trim(),
        notes: notes.trim(),
      });
      setTitle("");
      setTime("");
      setLocation("");
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
          aria-label="New plan title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a plan — dinner out, a hike, a trip…"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
        />
        <input
          type="date"
          aria-label="Plan date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
        />
        <button
          type="submit"
          disabled={!title.trim() || !date || pending}
          className="rounded-full bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-[var(--bg)] disabled:opacity-40"
        >
          {pending ? "Adding…" : "Add plan"}
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="Plan time (optional)"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="Time (optional) — e.g. 7pm"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
        />
        <input
          aria-label="Plan location (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Where? (optional)"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
        />
      </div>
      <input
        aria-label="Plan notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional) — tickets, what to bring, who's driving"
        className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
      />
      {error && <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>}
    </form>
  );
}
