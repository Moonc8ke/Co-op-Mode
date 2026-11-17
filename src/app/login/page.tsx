"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
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
      setError(
        signInError.message === "Invalid login credentials"
          ? "That email or password doesn't match. Check both and try again."
          : signInError.message,
      );
      setPending(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

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
        <p className="mt-4 text-sm font-medium tracking-wide text-[var(--accent)]">
          Andrew &amp; Juliette
        </p>
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
        <form onSubmit={onSubmit} className="mt-5 space-y-3">
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
            />
          </div>
          {error && <p className="text-sm text-[var(--rose)]">{error}</p>}
          <button
            type="submit"
            disabled={!email.trim() || !password || pending}
            className="w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-[var(--dim)]">
          No account yet? Ask Andrew to create one for you in the Supabase
          dashboard — see the README.
        </p>
      </main>
    </div>
  );
}
