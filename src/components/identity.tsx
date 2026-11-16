"use client";

import type { Person } from "@/lib/types";
import { DetailDialog } from "./shared";

/** The one-time "Who are you?" picker. Shown the first time someone
 * signs in, before the app knows which of the two people the account
 * belongs to. The choice is saved to the profiles table, so after this
 * the dinner and cravings forms already know who is typing — silently,
 * with no identity UI on the forms themselves. The name shows up on
 * the posted item instead ("Andrew suggested…", "Juliette is
 * craving…"). */
export function IdentityPickerModal({
  saving,
  error,
  onPick,
  onDismiss,
}: {
  saving: boolean;
  error: string;
  onPick: (person: Person) => void;
  onDismiss: () => void;
}) {
  return (
    <DetailDialog label="Who are you?" onClose={onDismiss}>
      <div className="text-center">
        <span aria-hidden className="text-4xl">
          👋
        </span>
        <h2 className="font-display mt-2 text-3xl font-semibold leading-tight">
          Who are you?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
          Pick your name once and the app will remember it on your
          account, so the dinner and cravings forms already know who&apos;s
          typing. Your name shows up on the things you post, so the other
          can see who suggested what.
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {(["Andrew", "Juliette"] as Person[]).map((person) => (
          <button
            key={person}
            type="button"
            aria-label={`I am ${person}`}
            onClick={() => onPick(person)}
            disabled={saving}
            className="rounded-full bg-[var(--accent)] px-5 py-3 text-base font-semibold text-white disabled:opacity-40"
          >
            I&apos;m {person}
          </button>
        ))}
      </div>
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

/** Compact "Who's posting?" chooser shown inside a form when the
 * app doesn't know who is signed in yet (the first-run picker was
 * dismissed, or the profile hasn't been picked). Picking here saves
 * the name to the profile, same as the full picker. */
export function IdentityMiniPicker({
  saving,
  error,
  onPick,
  accent,
}: {
  saving: boolean;
  error: string;
  onPick: (person: Person) => void;
  accent: string;
}) {
  return (
    <div className="mt-2 rounded-xl bg-[var(--bg)] p-3">
      <p className="text-sm font-medium">Who&apos;s posting?</p>
      <p className="mt-0.5 text-sm text-[var(--dim)]">
        Pick once — the app remembers it on your account.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(["Andrew", "Juliette"] as Person[]).map((person) => (
          <button
            key={person}
            type="button"
            aria-label={`Post as ${person}`}
            onClick={() => onPick(person)}
            disabled={saving}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: accent }}
          >
            I&apos;m {person}
          </button>
        ))}
      </div>
      {saving && (
        <p className="mt-2 text-sm text-[var(--dim)]">Saving…</p>
      )}
      {error && (
        <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>
      )}
    </div>
  );
}
