"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  counterDinnerProposal,
  deleteDinnerProposal,
  proposeDinner,
  respondToDinnerProposal,
} from "@/lib/data";
import { fmtDay, fmtWhen, relDay, todayStr } from "@/lib/seasons";
import type { DinnerProposal, Item, Person } from "@/lib/types";
import { IdentityMiniPicker } from "./identity";
import { EmptyNote, SectionHeader, sectionPanelStyle } from "./shared";

export function DinnerDecisionsSection({
  proposals,
  dinnerIdeas,
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
  proposals: DinnerProposal[];
  dinnerIdeas: Item[];
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
  const today = todayStr();
  // "This week" means today onward. Suggestions from before dates were
  // added have no dinner_date and stay visible under "No day picked yet";
  // suggestions for nights that have already passed move to Past dinners.
  const current = proposals.filter(
    (p) => p.dinner_date == null || p.dinner_date >= today,
  );
  const past = proposals.filter(
    (p) => p.dinner_date != null && p.dinner_date < today,
  );
  const pending = current.filter((p) => p.status === "pending");
  const accepted = current.filter((p) => p.status === "accepted");
  const history = current.filter(
    (p) => p.status === "declined" || p.status === "countered",
  );

  // Lay the week's suggestions out by day, soonest first, like the
  // calendar does. Undated suggestions go last.
  type DayGroup = {
    key: string;
    date: string | null;
    pending: DinnerProposal[];
    decided: DinnerProposal[];
  };
  const groups: DayGroup[] = [];
  const byKey = new Map<string, DayGroup>();
  for (const p of [...pending, ...accepted]) {
    const key = p.dinner_date ?? "undated";
    let g = byKey.get(key);
    if (!g) {
      g = { key, date: p.dinner_date, pending: [], decided: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    if (p.status === "pending") g.pending.push(p);
    else g.decided.push(p);
  }
  groups.sort((a, b) => {
    if (a.date == null) return 1;
    if (b.date == null) return -1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [error, setError] = useState("");

  async function onPropose(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || pendingSubmit || !me) return;
    setPendingSubmit(true);
    setError("");
    try {
      await proposeDinner(supabase, {
        title: title.trim(),
        notes: notes.trim(),
        suggested_by: me,
        dinner_date: date || null,
      });
      setTitle("");
      setNotes("");
      refresh();
    } catch {
      setError("That suggestion didn't send. Please try again.");
    } finally {
      setPendingSubmit(false);
    }
  }

  return (
    <section
      aria-label="Dinner this week"
      className={`${compact ? "mt-8" : "mt-6"} rounded-[1.4rem] border border-[var(--border)] p-4 shadow-sm sm:p-5`}
      style={sectionPanelStyle("var(--gold-soft)")}
    >
      <SectionHeader
        emoji="🍽️"
        label="Dinner this week"
        blurb="Suggest a dinner for a night this week — anyone else can say yes, pass, or propose something else instead."
        color="var(--gold)"
        pill={
          pending.length > 0
            ? `${pending.length} waiting for a reply`
            : accepted.length > 0
              ? "Decided ✓"
              : undefined
        }
        collapsed={collapsed}
        onToggle={onToggleCollapsed}
      />

      {!collapsed && (
        <>
      {groups.length > 0 ? (
        groups.map((g) => (
          <div key={g.key} className="mt-4">
            <p className="text-sm font-semibold">
              {g.date ? (
                <>
                  {fmtDay(g.date)}
                  {relDay(g.date) ? (
                    <span className="font-normal text-[var(--dim)]">
                      {" "}
                      · {relDay(g.date)}
                    </span>
                  ) : null}
                </>
              ) : (
                "No day picked yet"
              )}
            </p>
            {g.decided.map((p) => (
              <DecidedBanner key={p.id} proposal={p} day={g.date} />
            ))}
            {g.pending.length > 0 && (
              <ul className="mt-2 space-y-3">
                {g.pending.map((p) => (
                  <DinnerProposalCard
                    key={p.id}
                    proposal={p}
                    allProposals={proposals}
                    refresh={refresh}
                    me={me}
                    onNeedIdentity={onNeedIdentity}
                  />
                ))}
              </ul>
            )}
          </div>
        ))
      ) : (
        <EmptyNote text="No dinners on the table this week yet. Suggest something below and let everyone else decide." />
      )}

      {/* Suggest a dinner — posted as whoever is signed in. */}
      {me === null ? (
        <div className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-sm font-semibold">Suggest a dinner</p>
          <IdentityMiniPicker
            saving={identitySaving}
            error={identityError}
            onPick={onPickIdentity}
            accent="var(--gold)"
          />
        </div>
      ) : (
        <form
          onSubmit={onPropose}
          className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3"
        >
          <p className="text-sm font-semibold">Suggest a dinner</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              aria-label="Dinner idea to suggest"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you thinking? Tacos, that chili, takeout…"
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
            />
            <input
              type="date"
              aria-label="Night for this dinner"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
            />
            <button
              type="submit"
              disabled={!title.trim() || pendingSubmit}
              className="rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {pendingSubmit ? "Sending…" : "Suggest dinner →"}
            </button>
          </div>
          <input
            aria-label="Notes for this dinner suggestion (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional) — we have the ingredients, 30 mins, cozy night in…"
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          />
          {dinnerIdeas.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
                Or pick from your dinner ideas
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {dinnerIdeas.slice(0, 6).map((idea) => (
                  <button
                    key={idea.id}
                    type="button"
                    aria-label={`Suggest dinner idea: ${idea.title}`}
                    onClick={() => {
                      setTitle(idea.title);
                      if (idea.notes) setNotes(idea.notes);
                    }}
                    className="rounded-full border px-3 py-1.5 text-sm font-medium"
                    style={{
                      background: "var(--surface)",
                      borderColor: "var(--gold)",
                      color: "var(--gold)",
                    }}
                  >
                    {idea.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>}
        </form>
      )}

      {past.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer py-1 text-sm font-medium text-[var(--dim)]">
            Past dinners ({past.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {[...past].reverse().map((p) => (
              <DinnerProposalCard
                key={p.id}
                proposal={p}
                allProposals={proposals}
                refresh={refresh}
                me={me}
                onNeedIdentity={onNeedIdentity}
                showDay
              />
            ))}
          </ul>
        </details>
      )}

      {history.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer py-1 text-sm font-medium text-[var(--dim)]">
            Earlier suggestions ({history.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {history.map((p) => (
              <DinnerProposalCard
                key={p.id}
                proposal={p}
                allProposals={proposals}
                refresh={refresh}
                me={me}
                onNeedIdentity={onNeedIdentity}
                showDay
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

/** The green "It's decided" banner for one night's accepted dinner. */
function DecidedBanner({
  proposal,
  day,
}: {
  proposal: DinnerProposal;
  day: string | null;
}) {
  return (
    <div className="pop-in mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sage)]">
        ✓ It&apos;s decided
        {day ? ` — ${fmtDay(day)}` : ""}
      </p>
      <p className="font-display mt-1 text-xl font-semibold leading-tight">
        {proposal.title}
      </p>
      {proposal.notes && (
        <p className="mt-1 text-sm text-[var(--dim)]">{proposal.notes}</p>
      )}
      <p className="mt-1.5 text-sm text-[var(--dim)]">
        {proposal.suggested_by} suggested it
        {proposal.responded_by
          ? ` · ${proposal.responded_by} said yes`
          : ""}
        {proposal.responded_at
          ? ` · ${fmtWhen(proposal.responded_at)}`
          : ""}
      </p>
    </div>
  );
}

function DinnerProposalCard({
  proposal,
  allProposals,
  refresh,
  me,
  onNeedIdentity,
  showDay,
}: {
  proposal: DinnerProposal;
  allProposals: DinnerProposal[];
  refresh: () => void;
  /** Who is signed in (null until they have picked a name). */
  me: Person | null;
  /** Open the first-run picker (when an action needs an identity). */
  onNeedIdentity: () => void;
  /** Show which night this is for (cards outside a day group). */
  showDay?: boolean;
}) {
  const supabase = createClient();
  // The person answering is whoever is signed in — the buttons below
  // act as them. (It used to be "the other partner"; a space can hold
  // any number of people now.)
  const responder = me ?? "You";
  const counterOf =
    proposal.counter_of_id != null
      ? (allProposals.find((p) => p.id === proposal.counter_of_id) ?? null)
      : null;

  const [showCounter, setShowCounter] = useState(false);
  const [counterTitle, setCounterTitle] = useState("");
  const [counterNotes, setCounterNotes] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function respond(response: "accepted" | "declined") {
    if (!me) {
      onNeedIdentity();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await respondToDinnerProposal(supabase, proposal.id, response, me);
      refresh();
    } catch {
      setError("That didn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onCounter(e: FormEvent) {
    e.preventDefault();
    if (!counterTitle.trim() || busy) return;
    if (!me) {
      onNeedIdentity();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await counterDinnerProposal(
        supabase,
        proposal.id,
        {
          title: counterTitle.trim(),
          notes: counterNotes.trim(),
        },
        me,
      );
      setShowCounter(false);
      setCounterTitle("");
      setCounterNotes("");
      refresh();
    } catch {
      setError("That counter didn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteDinnerProposal(supabase, proposal.id);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  const isPending = proposal.status === "pending";
  const isAccepted = proposal.status === "accepted";

  return (
    <li
      className={`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-sm ${!isPending && !isAccepted ? "opacity-80" : ""}`}
      style={{ borderLeft: "5px solid var(--gold)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
          style={{ background: "var(--gold)" }}
        >
          {proposal.suggested_by} suggested
        </span>
        {counterOf && (
          <span className="rounded-full bg-[var(--gold-soft)] px-2.5 py-1 text-xs font-medium text-[var(--gold)]">
            Instead of: {counterOf.title}
          </span>
        )}
        <span className="text-xs text-[var(--dim)]">
          {fmtWhen(proposal.created_at)}
          {showDay
            ? proposal.dinner_date
              ? ` · ${fmtDay(proposal.dinner_date)}`
              : " · No day picked"
            : ""}
        </span>
        {!isPending && (
          <span
            className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${
              isAccepted
                ? "bg-[var(--sage-soft)] text-[var(--sage)]"
                : proposal.status === "countered"
                  ? "bg-[var(--gold-soft)] text-[var(--gold)]"
                  : "bg-[var(--rose-soft)] text-[var(--rose)]"
            }`}
          >
            {isAccepted
              ? "✓ Accepted"
              : proposal.status === "countered"
                ? "↩ Countered"
                : "✕ Declined"}
          </span>
        )}
      </div>

      <p className="font-display mt-2 text-xl font-semibold leading-tight">
        {proposal.title}
      </p>
      {proposal.notes && (
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          {proposal.notes}
        </p>
      )}

      {!isPending && proposal.responded_by && (
        <p className="mt-1.5 text-sm text-[var(--dim)]">
          {isAccepted
            ? `${proposal.responded_by} said yes`
            : proposal.status === "countered"
              ? `${proposal.responded_by} proposed something else instead`
              : `${proposal.responded_by} passed on this one`}
          {proposal.responded_at
            ? ` · ${fmtWhen(proposal.responded_at)}`
            : ""}
        </p>
      )}

      {isPending && (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <p className="text-sm font-medium">
            {responder}, what do you think?
          </p>
          {!showCounter ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                aria-label={`${responder} accepts dinner: ${proposal.title}`}
                onClick={() => void respond("accepted")}
                disabled={busy}
                className="rounded-full bg-[var(--sage)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "…" : "✓ Sounds good"}
              </button>
              <button
                type="button"
                aria-label={`${responder} declines dinner: ${proposal.title}`}
                onClick={() => void respond("declined")}
                disabled={busy}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                ✕ Not this one
              </button>
              <button
                type="button"
                aria-label={`${responder} proposes something else instead of ${proposal.title}`}
                onClick={() => setShowCounter(true)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                style={{ background: "var(--gold)" }}
              >
                💡 Propose something else
              </button>
              {confirmingDelete ? (
                <span className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Confirm delete suggestion ${proposal.title}`}
                    onClick={() => void remove()}
                    className="rounded-full bg-[var(--rose)] px-3 py-2 text-sm font-semibold text-white"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel delete suggestion"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-full border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={`Delete suggestion ${proposal.title}`}
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-full px-2 py-2 text-sm text-[var(--dim)]"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            <form
              onSubmit={onCounter}
              className="mt-2 rounded-xl bg-[var(--bg)] p-3"
            >
              <p className="text-sm font-medium">
                {responder}&apos;s counter-suggestion
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label={`${responder}'s counter dinner idea`}
                  value={counterTitle}
                  onChange={(e) => setCounterTitle(e.target.value)}
                  placeholder="How about instead…"
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base"
                />
                <button
                  type="submit"
                  disabled={!counterTitle.trim() || busy}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "var(--gold)" }}
                >
                  {busy ? "Sending…" : "Send counter →"}
                </button>
              </div>
              <input
                aria-label="Notes for counter suggestion (optional)"
                value={counterNotes}
                onChange={(e) => setCounterNotes(e.target.value)}
                placeholder="Notes (optional) — why this one, or what you fancy instead"
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowCounter(false)}
                className="mt-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium"
              >
                Never mind, back to deciding
              </button>
              {error && (
                <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>
              )}
            </form>
          )}
          {error && !showCounter && (
            <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>
          )}
        </div>
      )}

      {!isPending && (
        <div className="mt-2 flex justify-end">
          {confirmingDelete ? (
            <span className="flex gap-1">
              <button
                type="button"
                aria-label={`Confirm delete suggestion ${proposal.title}`}
                onClick={() => void remove()}
                className="rounded-full bg-[var(--rose)] px-3 py-1.5 text-sm font-semibold text-white"
              >
                Delete
              </button>
              <button
                type="button"
                aria-label="Cancel delete suggestion"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Delete suggestion ${proposal.title}`}
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
