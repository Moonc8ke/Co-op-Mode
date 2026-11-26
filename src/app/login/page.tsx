"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { INVITE_CODE_STORAGE_KEY } from "@/lib/data";

type Mode = "sign-in" | "sign-up";

/** Supabase's own error wording, made plain where it needs it. Anything
 * not listed here is shown verbatim — no invented password rules. */
function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "That email or password doesn't match. Check both and try again.";
  }
  if (/user already registered/i.test(message)) {
    return "An account with that email already exists — try signing in instead.";
  }
  if (/signups not allowed/i.test(message)) {
    return "New sign-ups aren't switched on for this app yet.";
  }
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // After a sign-up that needs email confirmation: the account exists,
  // but the user isn't signed in until they click the link.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resent, setResent] = useState(false);

  // A shared invite link lands here with ?invite=… — stash the code
  // so the app can prefill the join step after sign-in or sign-up.
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("invite");
      if (code && code.trim()) {
        window.localStorage.setItem(
          INVITE_CODE_STORAGE_KEY,
          code.trim(),
        );
      }
    } catch {
      // localStorage unavailable; the code just won't prefill.
    }
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setPassword("");
    setConfirmPassword("");
    setAwaitingConfirmation(false);
    setResent(false);
  }

  async function onSignIn(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || pending) return;
    setPending(true);
    setError("");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(friendlyAuthError(signInError.message));
      setPending(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function onSignUp(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || !confirmPassword || pending) return;
    if (password !== confirmPassword) {
      setError("The two passwords don't match. Try again.");
      return;
    }
    setPending(true);
    setError("");
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // The confirmation email comes back to the app's own callback
        // route, which signs the user in and sends them to the setup
        // flow (first name, then create or join a space).
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (signUpError) {
      setError(friendlyAuthError(signUpError.message));
      setPending(false);
      return;
    }
    setPending(false);
    if (data.session) {
      // Email confirmation is off in this project, so the account is
      // already signed in — straight into the setup flow.
      router.push("/");
      router.refresh();
      return;
    }
    setAwaitingConfirmation(true);
  }

  async function resendConfirmation() {
    if (!email.trim() || pending) return;
    setPending(true);
    setError("");
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setPending(false);
    if (resendError) {
      setError(friendlyAuthError(resendError.message));
      return;
    }
    setResent(true);
  }

  const isSignUp = mode === "sign-up";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 text-[var(--text)]">
      <main className="w-full max-w-sm rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <img
          src="/icon-192.png"
          alt="Co-op Mode logo"
          width={84}
          height={84}
          style={{ imageRendering: "pixelated" }}
          className="mx-auto block"
        />
        <h1 className="font-display mt-1 text-3xl font-semibold leading-tight">
          Our book, together
        </h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
          Co-op Mode
        </p>
        <p className="mt-2 text-sm text-[var(--dim)]">
          Sign in to see your shared bucket lists, calendar, dinner decisions,
          and scrapbook.
        </p>
        {awaitingConfirmation ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm">
              You&apos;re almost in. We sent a confirmation link to{" "}
              <span className="font-semibold">{email.trim()}</span> — click
              it and you&apos;ll land straight in the app to set up your
              space.
            </p>
            <p className="text-sm text-[var(--dim)]">
              No email yet? Check spam, then try resending it.
            </p>
            {error && <p className="text-sm text-[var(--rose)]">{error}</p>}
            <button
              type="button"
              onClick={resendConfirmation}
              disabled={pending}
              className="w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {pending
                ? "Sending…"
                : resent
                  ? "Sent again — check your inbox"
                  : "Resend the confirmation email"}
            </button>
            <p className="text-center text-xs text-[var(--dim)]">
              <button
                type="button"
                onClick={() => switchMode("sign-in")}
                className="font-semibold text-[var(--accent)] underline"
              >
                Back to sign in
              </button>
            </p>
          </div>
        ) : (
          <>
            <form
              onSubmit={isSignUp ? onSignUp : onSignIn}
              className="mt-5 space-y-3"
            >
              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-[var(--dim)]"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-[var(--dim)]"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={
                    isSignUp ? "new-password" : "current-password"
                  }
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    isSignUp ? "Choose a password" : "Your password"
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
                />
              </div>
              {isSignUp && (
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="text-sm font-medium text-[var(--dim)]"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Type it again"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
                  />
                </div>
              )}
              {error && (
                <p className="text-sm text-[var(--rose)]">{error}</p>
              )}
              <button
                type="submit"
                disabled={
                  !email.trim() ||
                  !password ||
                  (isSignUp && !confirmPassword) ||
                  pending
                }
                className="w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {pending
                  ? isSignUp
                    ? "Creating your account…"
                    : "Signing in…"
                  : isSignUp
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-[var(--dim)]">
              {isSignUp ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("sign-in")}
                    className="font-semibold text-[var(--accent)] underline"
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("sign-up")}
                    className="font-semibold text-[var(--accent)] underline"
                  >
                    Create one
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
