import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BackupPayload,
  CalEvent,
  Category,
  Craving,
  CravingKind,
  DinnerProposal,
  Item,
  ItemStatus,
  Memory,
  Person,
  Profile,
  Season,
  TellYouLater,
  TellYouLaterKind,
} from "./types";

export const SCRAPBOOK_BUCKET = "scrapbook-photos";

const isValidDate = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/* ---------------- Profile (who is signed in) ---------------- */

/** Reads the signed-in account's profile row, or null when they have not
 * picked a name yet. Throws when the profiles table is missing (run
 * migration 0003) or the request fails. */
export async function getMyProfile(
  supabase: SupabaseClient,
): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

/** Saves (or changes) the signed-in account's name. Upserts by the
 * auth user id, so switching names later just overwrites the one row. */
export async function setMyProfile(
  supabase: SupabaseClient,
  displayName: Person,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in.");
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: displayName,
  });
  if (error) throw error;
}

/* ---------------- Reads ---------------- */

export async function listItems(supabase: SupabaseClient): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("id", { ascending: true });
  if (error) throw error;
  return data as Item[];
}

export async function listEvents(supabase: SupabaseClient): Promise<CalEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true });
  if (error) throw error;
  return data as CalEvent[];
}

export async function listDinnerProposals(
  supabase: SupabaseClient,
): Promise<DinnerProposal[]> {
  const { data, error } = await supabase
    .from("dinner_proposals")
    .select("*")
    .order("dinner_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return data as DinnerProposal[];
}

function memoryFromRow(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Memory {
  const path = row.storage_path as string | null;
  return {
    id: row.id as number,
    caption: (row.caption as string) ?? "",
    memory_date: row.memory_date as string,
    image_url: path
      ? supabase.storage.from(SCRAPBOOK_BUCKET).getPublicUrl(path).data.publicUrl
      : null,
    mime_type: (row.mime_type as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function listMemories(
  supabase: SupabaseClient,
): Promise<Memory[]> {
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .order("memory_date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map((row) =>
    memoryFromRow(supabase, row),
  );
}

export async function listCravings(
  supabase: SupabaseClient,
): Promise<Craving[]> {
  const { data, error } = await supabase
    .from("cravings")
    .select("*")
    .order("id", { ascending: false });
  if (error) throw error;
  return data as Craving[];
}

export async function listTellYouLater(
  supabase: SupabaseClient,
): Promise<TellYouLater[]> {
  const { data, error } = await supabase
    .from("tell_you_later")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as TellYouLater[];
}

/* ---------------- Items ---------------- */

export async function addItem(
  supabase: SupabaseClient,
  args: {
    category: Category;
    title: string;
    notes?: string;
    season?: Season | null;
  },
): Promise<number> {
  const { data, error } = await supabase
    .from("items")
    .insert({
      category: args.category,
      title: args.title.trim(),
      notes: (args.notes ?? "").trim(),
      season: args.category === "seasonal" ? (args.season ?? null) : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

export async function setItemStatus(
  supabase: SupabaseClient,
  id: number,
  status: ItemStatus,
): Promise<void> {
  const { error } = await supabase
    .from("items")
    .update({
      status,
      done_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteItem(
  supabase: SupabaseClient,
  id: number,
): Promise<void> {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}

/** Moves unfinished seasonal items into another season (the season-change
 * carry-over). Only open seasonal items are moved. */
export async function carryOverItems(
  supabase: SupabaseClient,
  ids: number[],
  toSeason: Season,
): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await supabase
    .from("items")
    .update({ season: toSeason })
    .eq("category", "seasonal")
    .eq("status", "idea")
    .in("id", ids)
    .select("id");
  if (error) throw error;
  return data.length;
}

/* ---------------- Events ---------------- */

export async function addEvent(
  supabase: SupabaseClient,
  args: {
    title: string;
    event_date: string;
    event_time?: string;
    location?: string;
    notes?: string;
  },
): Promise<number> {
  const { data, error } = await supabase
    .from("events")
    .insert({
      title: args.title.trim(),
      event_date: args.event_date,
      event_time: (args.event_time ?? "").trim(),
      location: (args.location ?? "").trim(),
      notes: (args.notes ?? "").trim(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

export async function deleteEvent(
  supabase: SupabaseClient,
  id: number,
): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

/** Updates a plan's details (title, date, time, location, notes).
 * Works without any migration — the columns already exist. */
export async function updateEvent(
  supabase: SupabaseClient,
  id: number,
  args: {
    title: string;
    event_date: string;
    event_time?: string;
    location?: string;
    notes?: string;
  },
): Promise<void> {
  const { error } = await supabase
    .from("events")
    .update({
      title: args.title.trim(),
      event_date: args.event_date,
      event_time: (args.event_time ?? "").trim(),
      location: (args.location ?? "").trim(),
      notes: (args.notes ?? "").trim(),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Marks a plan done (or moves it back to upcoming). Marking done
 * stamps done_at with now; undoing clears it. Needs migration
 * 0008_event_done.sql — without it the update fails because the
 * is_done column does not exist yet. */
export async function setEventDone(
  supabase: SupabaseClient,
  id: number,
  done: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("events")
    .update({
      is_done: done,
      done_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
}

/* ---------------- Dinner proposals ---------------- */

export async function proposeDinner(
  supabase: SupabaseClient,
  args: {
    title: string;
    notes?: string;
    suggested_by: Person;
    /** The night this dinner is for (YYYY-MM-DD), or null for no day. */
    dinner_date?: string | null;
  },
): Promise<number> {
  const { data, error } = await supabase
    .from("dinner_proposals")
    .insert({
      title: args.title.trim(),
      notes: (args.notes ?? "").trim(),
      suggested_by: args.suggested_by,
      status: "pending",
      dinner_date: args.dinner_date ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

/** Records the logged-in person's reply to a pending suggestion.
 * `me` is who is answering (the app knows this from their profile);
 * the other person is the one who suggested it. */
export async function respondToDinnerProposal(
  supabase: SupabaseClient,
  id: number,
  response: "accepted" | "declined",
  me: Person,
): Promise<void> {
  const { data, error } = await supabase
    .from("dinner_proposals")
    .select("status")
    .eq("id", id)
    .single();
  if (error) throw error;
  if (data.status !== "pending") {
    throw new Error("That suggestion is no longer waiting for a reply.");
  }
  const { error: updateError } = await supabase
    .from("dinner_proposals")
    .update({
      status: response,
      responded_by: me,
      responded_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) throw updateError;
}

/** Counters a pending suggestion with a new one from the logged-in
 * person. The original is marked countered, answered by the same
 * person. The counter is for the same night as the original. */
export async function counterDinnerProposal(
  supabase: SupabaseClient,
  id: number,
  args: { title: string; notes?: string },
  me: Person,
): Promise<number> {
  const { data, error } = await supabase
    .from("dinner_proposals")
    .select("status, dinner_date")
    .eq("id", id)
    .single();
  if (error) throw error;
  if (data.status !== "pending") {
    throw new Error("That suggestion is no longer waiting for a reply.");
  }
  const { error: updateError } = await supabase
    .from("dinner_proposals")
    .update({
      status: "countered",
      responded_by: me,
      responded_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) throw updateError;
  return proposeDinner(supabase, {
    title: args.title,
    notes: args.notes,
    suggested_by: me,
    dinner_date: (data.dinner_date as string | null) ?? null,
  }).then(async (newId) => {
    const { error: linkError } = await supabase
      .from("dinner_proposals")
      .update({ counter_of_id: id })
      .eq("id", newId);
    if (linkError) throw linkError;
    return newId;
  });
}

export async function deleteDinnerProposal(
  supabase: SupabaseClient,
  id: number,
): Promise<void> {
  const { error } = await supabase
    .from("dinner_proposals")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/* ---------------- Cravings ---------------- */

export async function addCraving(
  supabase: SupabaseClient,
  args: {
    title: string;
    kind: CravingKind;
    note?: string;
    wanted_by: Person;
  },
): Promise<number> {
  const { data, error } = await supabase
    .from("cravings")
    .insert({
      title: args.title.trim(),
      kind: args.kind,
      note: (args.note ?? "").trim(),
      wanted_by: args.wanted_by,
      status: "open",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

/** Marks an open craving as fulfilled, recording who got it and an
 * optional note (e.g. where they found it). Throws when the craving is
 * no longer open. */
export async function fulfillCraving(
  supabase: SupabaseClient,
  id: number,
  args: { fulfilled_by: Person; fulfilled_note?: string },
): Promise<void> {
  const { data, error } = await supabase
    .from("cravings")
    .select("status")
    .eq("id", id)
    .single();
  if (error) throw error;
  if (data.status !== "open") {
    throw new Error("That craving was already taken care of.");
  }
  const { error: updateError } = await supabase
    .from("cravings")
    .update({
      status: "fulfilled",
      fulfilled_by: args.fulfilled_by,
      fulfilled_note: (args.fulfilled_note ?? "").trim(),
      fulfilled_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) throw updateError;
}

export async function deleteCraving(
  supabase: SupabaseClient,
  id: number,
): Promise<void> {
  const { error } = await supabase.from("cravings").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Tell you later ---------------- */

export async function addTellYouLater(
  supabase: SupabaseClient,
  args: {
    text: string;
    kind: TellYouLaterKind;
    note?: string;
    wanted_by: Person;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from("tell_you_later")
    .insert({
      text: args.text.trim(),
      kind: args.kind,
      note: (args.note ?? "").trim(),
      wanted_by: args.wanted_by,
      is_done: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Marks an open note as told / done / celebrated, recording who did
 * it. Throws when the note is already done. */
export async function markTellYouLaterDone(
  supabase: SupabaseClient,
  id: string,
  args: { done_by: Person },
): Promise<void> {
  const { data, error } = await supabase
    .from("tell_you_later")
    .select("is_done")
    .eq("id", id)
    .single();
  if (error) throw error;
  if (data.is_done) {
    throw new Error("That one was already taken care of.");
  }
  const { error: updateError } = await supabase
    .from("tell_you_later")
    .update({
      is_done: true,
      done_by: args.done_by,
      done_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) throw updateError;
}

export async function deleteTellYouLater(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("tell_you_later")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/* ---------------- Scrapbook memories ---------------- */

/** Shrinks big phone photos before upload so they save fast. Same rule as
 * the prototype: files under ~1.5 MB go up as-is; larger ones are resized
 * to at most 1600 px on the long edge and re-encoded as JPEG. */
export async function preparePhoto(
  file: File,
): Promise<{ blob: Blob; mimeType: string }> {
  if (file.size <= 1_500_000) return { blob: file, mimeType: file.type };
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: file, mimeType: file.type };
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) return { blob: file, mimeType: file.type };
    return { blob, mimeType: "image/jpeg" };
  } catch {
    return { blob: file, mimeType: file.type };
  }
}

export async function addMemory(
  supabase: SupabaseClient,
  args: { caption: string; memory_date: string; file: File },
): Promise<number> {
  if (!args.file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported.");
  }
  const { blob, mimeType } = await preparePhoto(args.file);
  if (blob.size === 0) throw new Error("That photo looks empty.");
  if (blob.size > 12 * 1024 * 1024) {
    throw new Error("That photo is larger than 12 MB.");
  }
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const path = `memories/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(SCRAPBOOK_BUCKET)
    .upload(path, blob, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await supabase
    .from("memories")
    .insert({
      caption: args.caption.trim(),
      memory_date: args.memory_date,
      storage_path: path,
      mime_type: mimeType,
    })
    .select("id")
    .single();
  if (error) {
    // Don't leave an orphaned file behind if the row didn't save.
    await supabase.storage.from(SCRAPBOOK_BUCKET).remove([path]);
    throw error;
  }
  return data.id as number;
}

export async function deleteMemory(
  supabase: SupabaseClient,
  id: number,
): Promise<void> {
  const { data } = await supabase
    .from("memories")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (data?.storage_path) {
    await supabase.storage
      .from(SCRAPBOOK_BUCKET)
      .remove([data.storage_path as string]);
  }
  const { error } = await supabase.from("memories").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Backup: export / import ---------------- */

/** The export format is identical to the prototype's, so backups move
 * between the prototype and this app. Note: scrapbook photos are NOT in
 * the file, only each memory's caption and date — photos have to be
 * re-added after an import. */
export function buildBackup(
  items: Item[],
  events: CalEvent[],
  proposals: DinnerProposal[],
  cravings: Craving[],
  tellYouLater: TellYouLater[],
  memories: Memory[],
): BackupPayload {
  return {
    exported_at: new Date().toISOString(),
    items,
    events,
    dinner_proposals: proposals,
    cravings,
    tell_you_later: tellYouLater,
    memories: memories.map((m) => ({
      id: m.id,
      caption: m.caption,
      memory_date: m.memory_date,
    })),
  };
}

export function downloadBackup(payload: BackupPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "couples-app-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  items: number;
  events: number;
  proposals: number;
  cravings: number;
  tellYouLater: number;
  memories: number;
  skipped: number;
}

const VALID_CATEGORIES = new Set([
  "seasonal",
  "longterm",
  "date",
  "dinner",
  "recipe",
  "craft",
  "places",
]);
const VALID_SEASONS = new Set(["Spring", "Summer", "Fall", "Winter"]);

/** Imports a backup file in the prototype's export format. Rows are
 * inserted fresh (old ids are ignored); dinner counters are re-linked to
 * the new ids. Memories come in without photos, since the backup file
 * carries no photo bytes — they show as caption-only entries until a
 * photo is added. Returns a count of what was added and skipped. */
export async function importBackup(
  supabase: SupabaseClient,
  payload: unknown,
): Promise<ImportResult> {
  const result: ImportResult = {
    items: 0,
    events: 0,
    proposals: 0,
    cravings: 0,
    tellYouLater: 0,
    memories: 0,
    skipped: 0,
  };
  if (!payload || typeof payload !== "object") {
    throw new Error("That file doesn't look like a couples-app backup.");
  }
  const raw = payload as Record<string, unknown>;

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  for (const r of rawItems) {
    const row = r as Record<string, unknown>;
    if (
      typeof row.title !== "string" ||
      !row.title.trim() ||
      typeof row.category !== "string" ||
      !VALID_CATEGORIES.has(row.category)
    ) {
      result.skipped += 1;
      continue;
    }
    const season =
      typeof row.season === "string" && VALID_SEASONS.has(row.season)
        ? row.season
        : null;
    const status = row.status === "done" ? "done" : "idea";
    const { error } = await supabase.from("items").insert({
      category: row.category,
      title: row.title.trim().slice(0, 200),
      notes: typeof row.notes === "string" ? row.notes.slice(0, 1000) : "",
      season: row.category === "seasonal" ? season : null,
      status,
      done_at:
        status === "done" && typeof row.done_at === "string"
          ? row.done_at
          : null,
    });
    if (error) result.skipped += 1;
    else result.items += 1;
  }

  const rawEvents = Array.isArray(raw.events) ? raw.events : [];
  for (const r of rawEvents) {
    const row = r as Record<string, unknown>;
    if (typeof row.title !== "string" || !row.title.trim() || !isValidDate(row.event_date)) {
      result.skipped += 1;
      continue;
    }
    const isDone = row.is_done === true;
    const eventBase = {
      title: row.title.trim().slice(0, 200),
      event_date: row.event_date,
      event_time: typeof row.event_time === "string" ? row.event_time.slice(0, 10) : "",
      location: typeof row.location === "string" ? row.location.slice(0, 200) : "",
      notes: typeof row.notes === "string" ? row.notes.slice(0, 1000) : "",
    };
    // Carry the done state when the backup has one. If migration
    // 0008 hasn't run yet the is_done column doesn't exist, so fall
    // back to importing the plan without its done state instead of
    // dropping the whole event.
    let { error } = await supabase.from("events").insert({
      ...eventBase,
      is_done: isDone,
      done_at:
        isDone && typeof row.done_at === "string" ? row.done_at : null,
    });
    if (error && /is_done/.test(error.message ?? "")) {
      ({ error } = await supabase.from("events").insert(eventBase));
    }
    if (error) result.skipped += 1;
    else result.events += 1;
  }

  const rawProposals = Array.isArray(raw.dinner_proposals)
    ? raw.dinner_proposals
    : [];
  // Insert in original order so counter links resolve in a second pass.
  const idMap = new Map<number, number>();
  const pendingLinks: Array<{ newId: number; oldCounterOf: number }> = [];
  for (const r of rawProposals) {
    const row = r as Record<string, unknown>;
    if (
      typeof row.title !== "string" ||
      !row.title.trim() ||
      (row.suggested_by !== "Andrew" && row.suggested_by !== "Juliette")
    ) {
      result.skipped += 1;
      continue;
    }
    const status =
      row.status === "accepted" ||
      row.status === "declined" ||
      row.status === "countered"
        ? row.status
        : "pending";
    const { data, error } = await supabase
      .from("dinner_proposals")
      .insert({
        title: row.title.trim().slice(0, 200),
        notes: typeof row.notes === "string" ? row.notes.slice(0, 1000) : "",
        suggested_by: row.suggested_by,
        status,
        responded_by:
          row.responded_by === "Andrew" || row.responded_by === "Juliette"
            ? row.responded_by
            : null,
        responded_at:
          typeof row.responded_at === "string" ? row.responded_at : null,
        dinner_date: isValidDate(row.dinner_date) ? row.dinner_date : null,
      })
      .select("id")
      .single();
    if (error || !data) {
      result.skipped += 1;
      continue;
    }
    result.proposals += 1;
    if (typeof row.id === "number") idMap.set(row.id, data.id as number);
    if (typeof row.counter_of_id === "number") {
      pendingLinks.push({
        newId: data.id as number,
        oldCounterOf: row.counter_of_id,
      });
    }
  }
  for (const link of pendingLinks) {
    const target = idMap.get(link.oldCounterOf);
    if (!target) continue;
    await supabase
      .from("dinner_proposals")
      .update({ counter_of_id: target })
      .eq("id", link.newId);
  }

  const rawMemories = Array.isArray(raw.memories) ? raw.memories : [];
  for (const r of rawMemories) {
    const row = r as Record<string, unknown>;
    if (typeof row.caption !== "string" && !isValidDate(row.memory_date)) {
      result.skipped += 1;
      continue;
    }
    if (!isValidDate(row.memory_date)) {
      result.skipped += 1;
      continue;
    }
    const { error } = await supabase.from("memories").insert({
      caption: typeof row.caption === "string" ? row.caption.slice(0, 300) : "",
      memory_date: row.memory_date,
      storage_path: null,
      mime_type: null,
    });
    if (error) result.skipped += 1;
    else result.memories += 1;
  }

  // Cravings are new in migration 0002, so older backups may not have
  // them at all — that is fine, nothing is skipped for a missing list.
  const rawCravings = Array.isArray(raw.cravings) ? raw.cravings : [];
  for (const r of rawCravings) {
    const row = r as Record<string, unknown>;
    if (
      typeof row.title !== "string" ||
      !row.title.trim() ||
      (row.kind !== "craving" && row.kind !== "looking_for") ||
      (row.wanted_by !== "Andrew" && row.wanted_by !== "Juliette")
    ) {
      result.skipped += 1;
      continue;
    }
    const status = row.status === "fulfilled" ? "fulfilled" : "open";
    const { error } = await supabase.from("cravings").insert({
      title: row.title.trim().slice(0, 200),
      kind: row.kind,
      note: typeof row.note === "string" ? row.note.slice(0, 1000) : "",
      wanted_by: row.wanted_by,
      status,
      fulfilled_by:
        row.fulfilled_by === "Andrew" || row.fulfilled_by === "Juliette"
          ? row.fulfilled_by
          : null,
      fulfilled_note:
        typeof row.fulfilled_note === "string"
          ? row.fulfilled_note.slice(0, 1000)
          : "",
      fulfilled_at:
        status === "fulfilled" && typeof row.fulfilled_at === "string"
          ? row.fulfilled_at
          : null,
    });
    if (error) result.skipped += 1;
    else result.cravings += 1;
  }

  // "Tell you later" notes are new in migration 0005, so older backups
  // may not have them at all — that is fine, nothing is skipped for a
  // missing list.
  const rawTellYouLater = Array.isArray(raw.tell_you_later)
    ? raw.tell_you_later
    : [];
  for (const r of rawTellYouLater) {
    const row = r as Record<string, unknown>;
    if (
      typeof row.text !== "string" ||
      !row.text.trim() ||
      (row.kind !== "tell" && row.kind !== "do" && row.kind !== "news") ||
      (row.wanted_by !== "Andrew" && row.wanted_by !== "Juliette")
    ) {
      result.skipped += 1;
      continue;
    }
    const isDone = row.is_done === true;
    const { error } = await supabase.from("tell_you_later").insert({
      kind: row.kind,
      text: row.text.trim().slice(0, 500),
      note: typeof row.note === "string" ? row.note.slice(0, 1000) : "",
      wanted_by: row.wanted_by,
      is_done: isDone,
      done_by:
        row.done_by === "Andrew" || row.done_by === "Juliette"
          ? row.done_by
          : null,
      done_at:
        isDone && typeof row.done_at === "string" ? row.done_at : null,
    });
    if (error) result.skipped += 1;
    else result.tellYouLater += 1;
  }

  return result;
}
