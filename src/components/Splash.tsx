// NOTE: currently UNUSED — removed from the root layout on Nov 17, 2026
// at Andrew's request (he preferred the phone's own splash only, and
// having both felt redundant). Kept so it can be re-enabled later by
// rendering <Splash /> in src/app/layout.tsx. Do not delete.
"use client";

import { useEffect, useRef, useState } from "react";
import { Press_Start_2P } from "next/font/google";

const pixelFont = Press_Start_2P({ weight: "400", subsets: ["latin"] });

// Minimum time the splash stays up, so it reads instead of flashing by.
const MIN_SHOW_MS = 1000;
// How long the fade-out takes (matches the duration-500 transition below).
const FADE_MS = 500;
// Safety net: never trap the user behind the splash if load stalls.
const MAX_WAIT_MS = 3000;

// Branded loading screen shown once per fresh app start, right after the
// phone's own system splash. The root layout stays mounted across in-app
// navigation, so this only appears on initial mount, never between pages.
export default function Splash() {
  const [gone, setGone] = useState(false);
  const [fading, setFading] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const start = Date.now();

    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const elapsed = Date.now() - start;
      const wait = reduced ? 0 : Math.max(0, MIN_SHOW_MS - elapsed);
      window.setTimeout(() => {
        if (reduced) {
          setGone(true);
        } else {
          setFading(true);
          window.setTimeout(() => setGone(true), FADE_MS);
        }
      }, wait);
    };

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish);
    }
    const safety = window.setTimeout(finish, MAX_WAIT_MS);

    return () => {
      window.removeEventListener("load", finish);
      window.clearTimeout(safety);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 transition-opacity duration-500 ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ backgroundColor: "#fff7ed" }}
    >
      <img
        src="/icon-192.png"
        alt=""
        width={96}
        height={96}
        style={{ imageRendering: "pixelated" }}
      />
      <p
        className={`${pixelFont.className} text-center text-base text-[#4a1942] sm:text-lg`}
      >
        Co-op Mode
      </p>
    </div>
  );
}
