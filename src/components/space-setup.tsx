"use client";

import { useState } from "react";
import type { SpaceKind } from "@/lib/types";
import { DetailDialog } from "./shared";

/** The invite link a member shares: the app's own login page with
 * the code in the address, so the friend signs in and the app
 * already has the code waiting. Built from the current origin so it
 * works on the live site and any preview deploy. */
export function inviteLink(code: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/login?invite=${encodeURIComponent(code)}`;
}

/** "November 30, 2026" from an invite_expires_at timestamp, or the
 * raw value when it doesn't parse. */
function fmtExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "no expiry set";
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return expiresAt;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type SetupMode = "choose" | "create" | "join";

/** The setup flow for a signed-in account that isn't part of a
 * space yet. A name can't be saved on its own — the profiles row
 * needs a space — so the name is typed here first and saved
 * together with the space in one step: either create a space
 * (kind picker, family asks for a last name) or join one with an
 * invite code. The invite code from a shared link arrives
 * prefilled when the friend tapped it. */
export function SpaceSetupModal({
  initialName = "",
  prefilledCode = "",
  saving,
  error,
  onCreate,
  onJoin,
  onDismiss,
}: {
  initialName?: string;
  /** Invite code from a shared link (?invite=… on the login page),
   * already waiting when the friend signs in. */
  prefilledCode?: string;
  saving: boolean;
  error: string;
  onCreate: (args: {
    kind: SpaceKind;
    displayName: string;
    familyName?: string;
  }) => void;
  onJoin: (args: { code: string; displayName: string }) => void;
  onDismiss: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [mode, setMode] = useState<SetupMode>(
    prefilledCode ? "join" : "choose",
  );
  const [kind, setKind] = useState<SpaceKind>("relationship");
  const [familyName, setFamilyName] = useState("");
  const [code, setCode] = useState(prefilledCode);
  const trimmedName = name.trim();
  const trimmedCode = code.trim();
  const trimmedFamily = familyName.trim();

  const createReady =
    !!trimmedName && (kind === "relationship" || !!trimmedFamily);
  const joinReady = !!trimmedName && !!trimmedCode;

  return (
    <DetailDialog label="Set up your space" onClose={onDismiss}>
      <div className="text-center">
        <span aria-hidden className="text-4xl">
          🏠
        </span>
        <h2 className="font-display mt-2 text-3xl font-semibold leading-tight">
          Set up your space
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
          You&apos;re not part of a space yet. Create one for you and
          your people, or join one with a code someone shared. Your
          first name is how everyone in the space will know it&apos;s
          you — it shows up on the things you post, like ratings and
          cravings.
        </p>
      </div>

      <form
        className="mt-4 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (saving) return;
          if (mode === "create" && createReady) {
            onCreate({
              kind,
              displayName: trimmedName,
              familyName: kind === "family" ? trimmedFamily : undefined,
            });
          } else if (mode === "join" && joinReady) {
            onJoin({ code: trimmedCode, displayName: trimmedName });
          }
        }}
      >
        <label htmlFor="space-setup-name" className="text-sm font-medium">
          What&apos;s your first name?
        </label>
        <input
          id="space-setup-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your first name"
          autoComplete="given-name"
          maxLength={40}
          autoFocus
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base"
        />

        {mode === "choose" && (
          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setMode("create")}
              disabled={!trimmedName}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-base font-semibold text-white disabled:opacity-40"
            >
              Create a space
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              disabled={!trimmedName}
              className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-5 py-3 text-base font-medium"
            >
              Join a space with a code
            </button>
            {!trimmedName && (
              <p className="text-center text-sm text-[var(--dim)]">
                Type your first name above, then pick one.
              </p>
            )}
          </div>
        )}

        {mode === "create" && (
          <>
            <p className="mt-2 text-sm font-medium">
              Is this space for a relationship or a family?
            </p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Space kind">
              <button
                type="button"
                role="radio"
                aria-checked={kind === "relationship"}
                onClick={() => setKind("relationship")}
                className={`rounded-xl border p-3 text-left ${
                  kind === "relationship"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <span aria-hidden className="text-2xl">
                  💕
                </span>
                <span className="mt-1 block text-sm font-semibold">
                  Relationship
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--dim)]">
                  Named after the people in it, as they join.
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={kind === "family"}
                onClick={() => setKind("family")}
                className={`rounded-xl border p-3 text-left ${
                  kind === "family"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <span aria-hidden className="text-2xl">
                  👨‍👩‍👧‍👦
                </span>
                <span className="mt-1 block text-sm font-semibold">
                  Family
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--dim)]">
                  Named after your last name.
                </span>
              </button>
            </div>
            {kind === "family" && (
              <>
                <label
                  htmlFor="space-setup-family"
                  className="mt-1 text-sm font-medium"
                >
                  What&apos;s the family last name?
                </label>
                <input
                  id="space-setup-family"
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="e.g. Smith"
                  autoComplete="family-name"
                  maxLength={40}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base"
                />
                <p className="text-sm text-[var(--dim)]">
                  Your space will be called &ldquo;the {trimmedFamily || "…"} family
                  space&rdquo;.
                </p>
              </>
            )}
            <button
              type="submit"
              disabled={saving || !createReady}
              className="mt-1 rounded-full bg-[var(--accent)] px-5 py-3 text-base font-semibold text-white disabled:opacity-40"
            >
              Create my space
            </button>
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm font-medium"
            >
              ← Back
            </button>
          </>
        )}

        {mode === "join" && (
          <>
            <label htmlFor="space-setup-code" className="mt-2 text-sm font-medium">
              Invite code
            </label>
            <input
              id="space-setup-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste the code someone shared"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={40}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-base"
            />
            <p className="text-sm text-[var(--dim)]">
              Codes work for 7 days. If yours has expired, ask someone in
              the space to share a fresh one.
            </p>
            <button
              type="submit"
              disabled={saving || !joinReady}
              className="mt-1 rounded-full bg-[var(--accent)] px-5 py-3 text-base font-semibold text-white disabled:opacity-40"
            >
              Join the space
            </button>
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm font-medium"
            >
              ← Back
            </button>
          </>
        )}
      </form>

      {saving && (
        <p className="mt-3 text-center text-sm text-[var(--dim)]">Saving…</p>
      )}
      {error && (
        <p className="mt-3 text-center text-sm text-[var(--rose)]">{error}</p>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 w-full rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm font-medium"
      >
        Not right now
      </button>
    </DetailDialog>
  );
}

/** The invite card for someone already in a space: the current
 * code, a copyable link to share, when the code expires, and a way
 * to swap in a fresh code. Any member can share the code, and any
 * member can regenerate it — regenerating stops the old code
 * working at once, so the button asks twice. */
export function SpaceInviteCard({
  inviteCode,
  inviteExpiresAt,
  regenerating,
  regenError,
  onRegenerate,
}: {
  inviteCode: string | null;
  inviteExpiresAt: string | null;
  regenerating: boolean;
  regenError: string;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function copyLink() {
    if (!inviteCode) return;
    const link = inviteLink(inviteCode);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard access can be blocked; fall back to selecting a
      // plain text field the user can copy by hand.
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // Still nothing copied; the code itself is shown below.
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (!inviteCode) return null;
  return (
    <section
      aria-label="Invite someone to your space"
      className="mt-6 rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5"
    >
      <h2 className="font-display text-xl font-semibold leading-tight">
        Invite someone to your space
      </h2>
      <p className="mt-0.5 text-sm text-[var(--dim)]">
        Anyone with this link can join with their own account — the
        code works for 7 days, until {fmtExpiry(inviteExpiresAt)}.
      </p>
      <p className="mt-3 break-all rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm">
        {inviteCode}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
        >
          {copied ? "Copied!" : "Copy invite link"}
        </button>
        <button
          type="button"
          disabled={regenerating}
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            setConfirming(false);
            onRegenerate();
          }}
          className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {regenerating
            ? "Making a new code…"
            : confirming
              ? "Tap again — the old code stops working"
              : "New code"}
        </button>
        {confirming && !regenerating && (
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm font-medium"
          >
            Keep this one
          </button>
        )}
      </div>
      {regenError && (
        <p className="mt-2 text-sm text-[var(--rose)]">{regenError}</p>
      )}
    </section>
  );
}
