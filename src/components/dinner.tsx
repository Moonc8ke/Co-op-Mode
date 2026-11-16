"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  counterDinnerProposal,
  deleteDinnerProposal,
  proposeDinner,
  respondToDinnerProposal,
} from "@/lib/data";
import { fmtWhen, otherPerson } from "@/lib/seasons";
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
}) {
  const supabase = createClient();
  const pending = proposals.filter((p) => p.status === "pending");
  const accepted = proposals.filter((p) => p.status === "accepted");
  const history = proposals.filter(
    (p) => p.status === "declined" || p.status === "countered",
  );
  const latestAccepted = accepted[0] ?? null;

  const [title, setTitle] = useState("");
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
      aria-label="Dinner decisions"
      className={`${compact ? "mt-8" : "mt-6"} rounded-[1.4rem] border border-[var(--border)] p-4 shadow-sm sm:p-5`}
      style={sectionPanelStyle("var(--gold-soft)")}
    >
      <SectionHeader
        emoji="🍽️"
        label="Dinner tonight?"
        blurb="One of you suggests, the other can say yes, pass, or propose something else instead."
        color="var(--gold)"
        pill={
          pending.length > 0
            ? `${pending.length} waiting for a reply`
            : latestAccepted
              ? "Decided ✓"
              : undefined
        }
      />

      {latestAccepted && pending.length === 0 && (
        <div className="pop-in mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sage)]">
            ✓ It&apos;s decided
          </p>
          <p className="font-display mt-1 text-xl font-semibold leading-tight">
            {latestAccepted.title}
          </p>
          {latestAccepted.notes && (
            <p className="mt-1 text-sm text-[var(--dim)]">
              {latestAccepted.notes}
            </p>
          )}
          <p className="mt-1.5 text-sm text-[var(--dim)]">
            {latestAccepted.suggested_by} suggested it
            {latestAccepted.responded_by
              ? ` · ${latestAccepted.responded_by} said yes`
              : ""}
            {latestAccepted.responded_at
              ? ` · ${fmtWhen(latestAccepted.responded_at)}`
              : ""}
          </p>
        </div>
      )}

      {pending.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {pending.map((p) => (
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
      ) : (
        !latestAccepted && (
          <EmptyNote text="No dinner on the table yet. Suggest something below and let the other decide." />
        )
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

      {accepted.length > 0 &&
        !(pending.length === 0 && accepted.length === 1) && (
          <details className="mt-3">
            <summary className="cursor-pointer py-1 text-sm font-medium text-[var(--sage)]">
              ✓ Decided dinners ({accepted.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {accepted.map((p) => (
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
              />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function DinnerProposalCard({
  proposal,
  allProposals,
  refresh,
  me,
  onNeedIdentity,
}: {
  proposal: DinnerProposal;
  allProposals: DinnerProposal[];
  refresh: () => void;
  /** Who is signed in (null until they have picked a name). */
  me: Person | null;
  /** Open the first-run picker (when an action needs an identity). */
  onNeedIdentity: () => void;
}) {
  const supabase = createClient();
  const responder = otherPerson(proposal.suggested_by);
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
                ✕ Not tonight
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
