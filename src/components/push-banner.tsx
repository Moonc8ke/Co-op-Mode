"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getExistingSubscription,
  isPushSupported,
  subscribeForPush,
} from "@/lib/push";
import type { Person } from "@/lib/types";

const DISMISSED_KEY = "couples-app-push-banner-dismissed";

/** A small, dismissible banner at the top of the home page, shown only
 * when push notifications could work on this phone and the person
 * hasn't decided yet. Tapping "Enable notifications" asks the browser
 * for permission once; if they say no, the banner hides and never
 * nags. Each phone opts in separately. */
export function PushBanner({ me }: { me: Person | null }) {
  const supabase = createClient();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (me === null) return;
    let cancelled = false;
    (async () => {
      try {
        if (!isPushSupported()) return;
        if (Notification.permission !== "default") return;
        if (
          window.localStorage.getItem(DISMISSED_KEY) === "1"
        ) {
          return;
        }
        // Already subscribed on this phone — nothing to offer.
        const existing = await getExistingSubscription();
        if (!cancelled && !existing) setVisible(true);
      } catch {
        // Push just isn't available here; the app works as before.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once when the signed-in name becomes known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  async function onEnable() {
    setBusy(true);
    setError("");
    const result = await subscribeForPush(supabase);
    setBusy(false);
    if (result === "subscribed" || result === "denied") {
      // Denied is a decision too — hide and don't ask again.
      setVisible(false);
    } else if (result === "unsupported") {
      setVisible(false);
    } else {
      setError("That didn't turn on. You can try again later.");
    }
  }

  if (!visible || me === null) return null;

  return (
    <div
      role="region"
      aria-label="Enable notifications"
      className="mt-6 flex items-start gap-3 rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
    >
      <span aria-hidden className="text-2xl leading-none">
        🔔
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">
          Get notified when everyone else in your space posts something
        </p>
        <p className="mt-0.5 text-sm text-[var(--dim)]">
          A gentle ping when they post a craving, suggest a dinner, or
          leave you a note — never anything else.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onEnable()}
            disabled={busy}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Turning on…" : "Enable notifications"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
          >
            Not now
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>
        )}
      </div>
    </div>
  );
}
