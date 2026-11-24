// Co-op Mode — send-push Edge Function
//
// Sends a Web Push notification when someone in a space posts something
// new, and when someone answers or finishes something another member
// posted. It is triggered by a Supabase Database Webhook on INSERT or
// UPDATE into cravings, dinner_proposals, or tell_you_later (see the
// README "Push notifications" section for the webhook setup).
//
// New posts (INSERT) notify EVERY OTHER member of the poster's space.
// Replies and finishes (UPDATE) notify the ORIGINAL POSTER instead:
//   cravings         — "Got it" (fulfilled_by goes from null to set)
//   dinner_proposals — accepted / declined (status leaves "pending").
//     A counter is NOT notified here: the counter itself is a new
//     row, so its INSERT already pings the suggester about the new
//     suggestion, and a second ping for the "countered" update would
//     be a duplicate.
//   tell_you_later   — marked done (is_done goes from false to true)
//
// Only the real transition notifies. The function compares the old
// row (old_record) with the new row, so text edits, re-saves, and
// repeat updates after the transition already happened send nothing.
//
// How it works:
//   1. The webhook posts the changed row (and, for UPDATEs, the row
//      as it was before). The poster / responder is a display name
//      from the row itself — names are free-form since migration
//      0009, unique within a space since migration 0010, and a space
//      can hold any number of people.
//   2. The function reads the row's space_id and looks up that
//      space's profiles (service role key, so it can read across
//      accounts). For a new post the recipients are all members
//      except the poster; for a reply the recipient is the original
//      poster. The actor never gets a notification about their own
//      action.
//   3. It reads those people's rows from push_subscriptions and sends
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

/** A display name is any non-empty string (free-form since migration
 * 0009 — no longer just "Andrew" or "Juliette"). */
function isName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

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
  if (!isName(poster)) return null;

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

/**
 * Notification for a reply or a finish (UPDATE), or null when this
 * update is not a notifiable transition. Returns the text plus who
 * should receive it — the ORIGINAL POSTER, not the other members.
 *
 * A transition only counts when the old row shows it had not happened
 * yet, so edits and repeat updates stay silent. An actor marking
 * their own post done is also skipped — there is nobody to tell.
 */
function messageForUpdate(
  table: string,
  record: Record<string, unknown>,
  oldRecord: Record<string, unknown> | null,
): { body: string; recipientName: string } | null {
  if (!oldRecord) return null;

  if (table === "cravings") {
    // "Got it": fulfilled_by goes from empty to set, status to fulfilled.
    const actor = record.fulfilled_by;
    const poster = record.wanted_by;
    if (!isName(actor) || !isName(poster)) return null;
    if (actor === poster) return null;
    if (oldRecord.fulfilled_by) return null;
    if (record.status !== "fulfilled") return null;
    const title = String(record.title ?? "").trim();
    if (!title) return null;
    const body =
      record.kind === "looking_for"
        ? `${actor} found the ${title} you were looking for`
        : `${actor} got your craving for ${title}`;
    return { body, recipientName: poster };
  }

  if (table === "dinner_proposals") {
    // Accepted or declined: status leaves "pending" and responded_by
    // is set. "Countered" is deliberately left out: the counter is a
    // new row, so its INSERT already pings the suggester about the
    // new suggestion.
    const actor = record.responded_by;
    const suggester = record.suggested_by;
    if (!isName(actor) || !isName(suggester)) return null;
    if (actor === suggester) return null;
    if (oldRecord.status !== "pending") return null;
    const status = record.status;
    if (status !== "accepted" && status !== "declined") return null;
    const title = String(record.title ?? "").trim();
    if (!title) return null;
    const day = fmtDinnerDay((record.dinner_date as string | null) ?? null);
    const when = day ? ` for ${day}` : "";
    const verb = status === "accepted" ? "accepted" : "declined";
    return {
      body: `${actor} ${verb} your dinner${when}: ${title}`,
      recipientName: suggester,
    };
  }

  // tell_you_later: marked done — is_done goes from false to true.
  const actor = record.done_by;
  const poster = record.wanted_by;
  if (!isName(actor) || !isName(poster)) return null;
  if (actor === poster) return null;
  if (oldRecord.is_done) return null;
  if (record.is_done !== true) return null;
  const kind = record.kind as string | undefined;
  let body: string;
  if (kind === "do") {
    const text = String(record.text ?? "").trim();
    body = text
      ? `${actor} took care of: ${text}`
      : `${actor} took care of your reminder`;
  } else if (kind === "news") {
    body = `${actor} celebrated your good news`;
  } else {
    body = `${actor} heard what you wanted to say`;
  }
  return { body, recipientName: poster };
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

  if (payload.type !== "INSERT" && payload.type !== "UPDATE") {
    return Response.json({ ok: true, skipped: "not an insert or update" });
  }
  if (!NOTIFY_TABLES.includes(payload.table)) {
    return Response.json({ ok: true, skipped: "table out of scope" });
  }

  const record = payload.record ?? {};
  let body: string | null = null;
  /** INSERT only: the poster's name — every other member of the space
   * is notified, never the poster. */
  let excludeName: string | null = null;
  /** UPDATE only: the original poster's name — the one member who is
   * notified about the reply. */
  let recipientNames: string[] | null = null;

  if (payload.type === "INSERT") {
    // New post: notify EVERY OTHER member of the poster's space.
    body = messageFor(payload.table, record);
    if (!body) {
      return Response.json({ ok: true, skipped: "no message for this row" });
    }
    const poster = (
      payload.table === "dinner_proposals"
        ? record.suggested_by
        : record.wanted_by
    ) as string | undefined;
    if (!isName(poster)) {
      return Response.json({ ok: true, skipped: "no message for this row" });
    }
    excludeName = poster;
  } else {
    // Reply or finish: notify the ORIGINAL POSTER.
    const update = messageForUpdate(payload.table, record, payload.old_record);
    if (!update) {
      return Response.json({
        ok: true,
        skipped: "update is not a notifiable transition",
      });
    }
    body = update.body;
    recipientNames = [update.recipientName];
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return Response.json(
      { ok: false, error: "Supabase credentials missing" },
      { status: 500 },
    );
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // The row's space_id scopes the lookup: only members of that space
  // are notified, never another space. (Rows written before migration
  // 0007 have no space_id; those fall back to every profile, which
  // was the pre-spaces behavior.)
  const spaceId =
    typeof record.space_id === "string" && record.space_id
      ? record.space_id
      : null;
  let profilesQuery = supabase.from("profiles").select("id, display_name");
  if (spaceId) profilesQuery = profilesQuery.eq("space_id", spaceId);
  const { data: profiles, error: profilesError } = await profilesQuery;
  if (profilesError || !profiles) {
    return Response.json(
      { ok: false, error: "profiles lookup failed" },
      { status: 500 },
    );
  }

  // Map display names to user ids. For a new post, everyone in the
  // space except the poster; for a reply, the original poster only.
  // A member who hasn't picked a name yet has no profile row and
  // simply isn't notified. Matching is by name, and names are unique
  // within a space since migration 0010, so each name maps to exactly
  // one member and the ping is unambiguous.
  const isInsert = payload.type === "INSERT";
  const recipientIds = (
    profiles as Array<{ id: string; display_name: string }>
  )
    .filter((p) => {
      if (isInsert) return p.display_name !== excludeName;
      return recipientNames!.includes(p.display_name);
    })
    .map((p) => p.id);
  if (recipientIds.length === 0) {
    return Response.json({
      ok: true,
      skipped: "no recipients with profiles in this space",
    });
  }

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", recipientIds);
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
