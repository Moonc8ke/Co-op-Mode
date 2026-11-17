import type { SupabaseClient } from "@supabase/supabase-js";

/** The PUBLIC half of the VAPID key pair used for Web Push. Public by
 * design: it identifies this app to the push services (Apple, Google)
 * and is safe to ship in the client — it cannot be used to send a
 * notification on its own. The private half lives only as a Supabase
 * secret (VAPID_PRIVATE_KEY) for the send-push Edge Function and must
 * never appear in this repo. */
export const VAPID_PUBLIC_KEY =
  "BMN_UsjtfIlrdK4-qgkyDQvumv-lxWdh0_N10L3UjvKFNPu9wbZynKYl1NipTnU3qzogDRlZ7SshzA5Hm95l9JU";

/** True when this browser can do Web Push at all. iPhone Safari only
 * supports it for apps installed on the Home Screen (iOS 16.4+); the
 * banner checks that separately by asking for permission. */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** The browser's current push subscription for this app, if any. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** Asks for notification permission, subscribes this phone/browser,
 * and saves the subscription to the push_subscriptions table so the
 * Edge Function can notify this device. Returns what happened so the
 * caller can decide whether to hide the banner. */
export async function subscribeForPush(
  supabase: SupabaseClient,
): Promise<"subscribed" | "denied" | "unsupported" | "error"> {
  if (!isPushSupported()) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "error";

    const json = subscription.toJSON();
    const endpoint = subscription.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) return "error";

    // The endpoint is unique, so the same phone can never be saved
    // twice — if this device is already registered, leave it alone.
    const { data: existing } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", endpoint)
      .maybeSingle();
    if (existing) return "subscribed";

    const { error } = await supabase.from("push_subscriptions").insert({
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
    });
    if (error) return "error";
    return "subscribed";
  } catch {
    return "error";
  }
}
