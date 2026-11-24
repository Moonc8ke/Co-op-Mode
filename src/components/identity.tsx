"use client";

import { useState } from "react";
import type { Person } from "@/lib/types";
import { DetailDialog } from "./shared";

/** The one-time "Who are you?" picker. Shown the first time someone
 * signs in, before the app knows who the account belongs to. The
 * name is typed in — any name, and a space can hold any number of
 * people — and saved to the profiles table, so after this the dinner,
 * cravings, and tell-you-later forms already know who's typing —
 * silently, with no identity UI on the forms themselves. The name
 * shows up on the posted item instead ("Maya suggested…",
 * "Sam is craving…"). Opening it again from the header lets a
 * signed-in person change their saved name. */
export function IdentityPickerModal({
  saving,
  error,
  initialName = "",
  onPick,
  onDismiss,
}: {
  saving: boolean;
  error: string;
  /** Prefilled when the picker is opened to change a saved name. */
  initialName?: string;
  onPick: (person: Person) => void;
  onDismiss: () => void;
}) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();
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
          Type your name once and the app will remember it on your
          account, so the dinner, cravings, and tell-you-later forms
          already know who&apos;s typing. Your name shows up on the things
          you post, so everyone else in your space can see who suggested
          what.
        </p>
      </div>
      <form
        className="mt-4 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed && !saving) onPick(trimmed);
        }}
      >
        <label htmlFor="identity-name" className="text-sm font-medium">
          What&apos;s your name?
        </label>
        <input
          id="identity-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your first name"
          autoComplete="given-name"
          maxLength={40}
          autoFocus
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base"
        />
        <button
          type="submit"
          disabled={saving || !trimmed}
          className="rounded-full bg-[var(--accent)] px-5 py-3 text-base font-semibold text-white disabled:opacity-40"
        >
          Save my name
        </button>
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

/** Compact "Who's posting?" chooser shown inside a form when the
 * app doesn't know who is signed in yet (the first-run picker was
 * dismissed, or the profile hasn't been picked). Typing a name here
 * saves it to the profile, same as the full picker. */
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
  const [name, setName] = useState("");
  const trimmed = name.trim();
  return (
    <div className="mt-2 rounded-xl bg-[var(--bg)] p-3">
      <p className="text-sm font-medium">Who&apos;s posting?</p>
      <p className="mt-0.5 text-sm text-[var(--dim)]">
        Type your name once — the app remembers it on your account.
      </p>
      <form
        className="mt-2 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed && !saving) onPick(trimmed);
        }}
      >
        <input
          aria-label="Your name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your first name"
          autoComplete="given-name"
          maxLength={40}
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base"
        />
        <button
          type="submit"
          disabled={saving || !trimmed}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: accent }}
        >
          Save my name
        </button>
      </form>
      {saving && (
        <p className="mt-2 text-sm text-[var(--dim)]">Saving…</p>
      )}
      {error && (
        <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>
      )}
    </div>
  );
}
