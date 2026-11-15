import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BackupPayload,
  CalEvent,
  Category,
  DinnerProposal,
  Item,
  ItemStatus,
  Memory,
  Person,
  Season,
} from "./types";

export const SCRAPBOOK_BUCKET = "scrapbook-photos";

const isValidDate = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

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

/* ---------------- Dinner proposals ---------------- */

export async function proposeDinner(
  supabase: SupabaseClient,
  args: { title: string; notes?: string; suggested_by: Person },
): Promise<number> {
  const { data, error } = await supabase
    .from("dinner_proposals")
    .insert({
      title: args.title.trim(),
      notes: (args.notes ?? "").trim(),
      suggested_by: args.suggested_by,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

export async function respondToDinnerProposal(
  supabase: SupabaseClient,
  id: number,
  response: "accepted" | "declined",
): Promise<void> {
  const { data, error } = await supabase
    .from("dinner_proposals")
    .select("suggested_by, status")
    .eq("id", id)
    .single();
  if (error) throw error;
  if (data.status !== "pending") {
    throw new Error("That suggestion is no longer waiting for a reply.");
  }
  const other: Person = data.suggested_by === "Andrew" ? "Juliette" : "Andrew";
  const { error: updateError } = await supabase
    .from("dinner_proposals")
    .update({
      status: response,
      responded_by: other,
      responded_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) throw updateError;
}

export async function counterDinnerProposal(
  supabase: SupabaseClient,
  id: number,
  args: { title: string; notes?: string },
): Promise<number> {
  const { data, error } = await supabase
    .from("dinner_proposals")
    .select("suggested_by, status")
    .eq("id", id)
    .single();
  if (error) throw error;
  if (data.status !== "pending") {
    throw new Error("That suggestion is no longer waiting for a reply.");
  }
  const other: Person = data.suggested_by === "Andrew" ? "Juliette" : "Andrew";
  const { error: updateError } = await supabase
    .from("dinner_proposals")
    .update({
      status: "countered",
      responded_by: other,
      responded_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) throw updateError;
  return proposeDinner(supabase, {
    title: args.title,
    notes: args.notes,
    suggested_by: other,
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
  memories: Memory[],
): BackupPayload {
  return {
    exported_at: new Date().toISOString(),
    items,
    events,
    dinner_proposals: proposals,
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
    const { error } = await supabase.from("events").insert({
      title: row.title.trim().slice(0, 200),
      event_date: row.event_date,
      event_time: typeof row.event_time === "string" ? row.event_time.slice(0, 10) : "",
      location: typeof row.location === "string" ? row.location.slice(0, 200) : "",
      notes: typeof row.notes === "string" ? row.notes.slice(0, 1000) : "",
    });
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

  return result;
}
