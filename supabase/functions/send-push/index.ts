// Co-op Mode — send-push Edge Function
//
// Sends a Web Push notification to the OTHER partner when one of you
// posts something. It is triggered by a Supabase Database Webhook on
// INSERT into cravings, dinner_proposals, or tell_you_later (see the
// README "Push notifications" section for the webhook setup).
//
// How it works:
//   1. The webhook posts the new row. The poster is the row's
//      wanted_by / suggested_by display name ("Andrew" / "Juliette").
//   2. The function looks up both profiles (service role key, so it
//      can read across accounts) and finds the OTHER partner's user id.
//   3. It reads that person's rows from push_subscriptions and sends
//      a push to each device with the web-push library, using the
//      VAPID keys from Supabase secrets.
//   4. A device that answers 410/404 (uninstalled, subscription gone)
//      has its row deleted so it is never tried again.
//
// Environment (set as Supabase secrets — never in the repo):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — provided automatically
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY — the VAPID key pair; the
//     public key must match the one hardcoded in src/lib/push.ts
//   VAPID_SUBJECT — e.g. mailto:rabe.andrew@yahoo.com
//
// Scope (v1): only cravings, dinner_proposals, and tell_you_later.
// Nothing is sent for bucket-list items, calendar events, or
// scrapbook memories.

import { createClient } from "npm:@supabase/supabase-js@2";
// @deno-types="npm:@types/web-push"
import webpush from "npm:web-push@3.6.7";

interface WebhookPayload {
  type: string;
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

const NOTIFY_TABLES = ["cravings", "dinner_proposals", "tell_you_later"];

function fmtDinnerDay(ymd: string | null): string {
  if (!ymd) return "";
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Short, plain notification text for the new row. Never includes
 * anything sensitive — just who posted and what kind of thing it is. */
function messageFor(table: string, record: Record<string, unknown>): string | null {
  const poster = (
    table === "dinner_proposals" ? record.suggested_by : record.wanted_by
  ) as string | undefined;
  if (poster !== "Andrew" && poster !== "Juliette") return null;

  if (table === "cravings") {
    const title = String(record.title ?? "").trim();
    if (!title) return null;
    return record.kind === "looking_for"
      ? `${poster} is looking for ${title}`
      : `${poster} is craving ${title}`;
  }

  if (table === "dinner_proposals") {
    const title = String(record.title ?? "").trim();
    if (!title) return null;
    const day = fmtDinnerDay((record.dinner_date as string | null) ?? null);
    return `${poster} suggested dinner${day ? ` for ${day}` : ""}: ${title}`;
  }

  // tell_you_later
  const kind = record.kind as string | undefined;
  if (kind === "news") return `${poster} has good news for you`;
  if (kind === "do") {
    const text = String(record.text ?? "").trim();
    return text ? `${poster} added a reminder: ${text}` : null;
  }
  return `${poster} wants to tell you something`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  if (payload.type !== "INSERT") {
    return Response.json({ ok: true, skipped: "not an insert" });
  }
  if (!NOTIFY_TABLES.includes(payload.table)) {
    return Response.json({ ok: true, skipped: "table out of scope" });
  }

  const record = payload.record ?? {};
  const body = messageFor(payload.table, record);
  if (!body) {
    return Response.json({ ok: true, skipped: "no message for this row" });
  }
  const poster = (
    payload.table === "dinner_proposals"
      ? record.suggested_by
      : record.wanted_by
  ) as "Andrew" | "Juliette";
  const other = poster === "Andrew" ? "Juliette" : "Andrew";

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return Response.json(
      { ok: false, error: "Supabase credentials missing" },
      { status: 500 },
    );
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // Map display names to user ids so the notification goes to the
  // other partner, never back to the person who posted.
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name");
  if (profilesError || !profiles) {
    return Response.json(
      { ok: false, error: "profiles lookup failed" },
      { status: 500 },
    );
  }
  const otherProfile = profiles.find(
    (p: { display_name: string }) => p.display_name === other,
  ) as { id: string; display_name: string } | undefined;
  if (!otherProfile) {
    return Response.json({
      ok: true,
      skipped: "other partner has no profile yet",
    });
  }

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", otherProfile.id);
  if (subsError || !subs) {
    return Response.json(
      { ok: false, error: "subscriptions lookup failed" },
      { status: 500 },
    );
  }
  if (subs.length === 0) {
    return Response.json({ ok: true, sent: 0, note: "no devices subscribed" });
  }

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject =
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:rabe.andrew@yahoo.com";
  if (!vapidPublic || !vapidPrivate) {
    return Response.json(
      { ok: false, error: "VAPID keys not configured" },
      { status: 500 },
    );
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const pushPayload = JSON.stringify({ title: "Co-op Mode", body });
  let sent = 0;
  let failed = 0;
  let deleted = 0;
  for (const sub of subs) {
    const pushSubscription = {
      endpoint: sub.endpoint as string,
      keys: {
        p256dh: sub.p256dh as string,
        auth: sub.auth as string,
      },
    };
    try {
      await webpush.sendNotification(pushSubscription, pushPayload);
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        // The device uninstalled the app or the subscription is gone.
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint as string);
        deleted += 1;
      } else {
        failed += 1;
      }
    }
  }
  return Response.json({ ok: true, sent, failed, deleted });
});
