"use client";

import { useEffect } from "react";

/** Registers the push-only service worker (public/sw.js) on every
 * visit, when the browser supports it. The worker handles push
 * notifications only — it never intercepts requests or caches
 * anything, so the app still always loads fresh. Registration is
 * idempotent; re-registering the same worker is a no-op. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Push just won't be available on this device; the app works
      // exactly as before without it.
    });
  }, []);
  return null;
}
