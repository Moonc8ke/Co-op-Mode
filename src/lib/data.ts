import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BackupPayload,
  CalEvent,
  Category,
  CookedDish,
  Craving,
  CravingKind,
  DinnerProposal,
  DishRating,
  GroceryItem,
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

/** A name from a backup row: any non-empty string (free-form since
 * migration 0009), trimmed, or null when the value isn't usable. */
const asName = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, 40) : null;

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

/** The signed-in user's space id, read from their profiles row and
 * cached once per session (keyed by auth user id, so signing in as
 * someone else re-reads it). Null when the account has no space yet.
 * Needs migration 0007_spaces.sql — before it ran, profiles has no
 * space_id column and this returns null. Reading the row works under
 * the new policies because the row's own space_id equals
 * my_space_id(). */
let cachedSpaceId: { userId: string; spaceId: string | null } | null = null;

export async function getMySpaceId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (cachedSpaceId?.userId === user.id) return cachedSpaceId.spaceId;
  const profile = await getMyProfile(supabase);
  const spaceId = profile?.space_id ?? null;
  cachedSpaceId = { userId: user.id, spaceId };
  return spaceId;
}

/** Friendly message shown when a name is already taken in the space.
 * Thrown by setMyProfile and surfaced verbatim by the identity
 * pickers (full modal and mini chooser), so the user can pick another
 * name instead of seeing a raw database error. */
export const NAME_TAKEN_MESSAGE =
  "That name's already taken in your space, try another one";

/** Shown when saving a name fails because the account isn't part of
 * a space yet (no profiles row, so no space_id). The profiles
 * upsert fails migration 0007's WITH CHECK — null never satisfies
 * it — so the account needs a space assigned in SQL first. */
export const NO_SPACE_MESSAGE =
  "This account isn't part of a space yet. Ask the person who shared the app with you to add it, then try again.";

/** True when another member of the signed-in user's space already
 * uses this name (compared case-insensitively, trimmed). The user's
 * own current name doesn't count — re-saving it is fine. Returns
 * false when the account has no space yet (nothing to compare
 * against) or the lookup fails; the unique index from migration
 * 0010 is the backstop in that case. */
export async function isNameTaken(
  supabase: SupabaseClient,
  candidate: string,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const spaceId = await getMySpaceId(supabase);
  if (!spaceId) return false;
  const wanted = candidate.trim().toLowerCase();
  if (!wanted) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("space_id", spaceId);
  if (error || !data) return false;
  return (data as Array<{ id: string; display_name: string }>).some(
    (p) => p.id !== user.id && p.display_name.toLowerCase() === wanted,
  );
}

/** Saves (or changes) the signed-in account's name. Upserts by the
 * auth user id, so changing names later just overwrites the one row.
 * Includes the user's space_id, or the upsert fails the new profiles
 * policy's WITH CHECK (space_id = my_space_id()) from migration 0007.
 * A brand-new account with no space yet cannot save a name — it needs
 * a space assigned in SQL first (an invite flow is still to come).
 * Names are free-form since migration 0009 — any name, any number of
 * people per space — and unique within a space since migration 0010:
 * a name another member already uses is rejected here, and the
 * unique index is the backstop if two people pick the same name at
 * the same moment. */
export async function setMyProfile(
  supabase: SupabaseClient,
  displayName: Person,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in.");
  const name = displayName.trim();
  if (!name) throw new Error("Please enter a name first.");
  if (await isNameTaken(supabase, name)) {
    throw new Error(NAME_TAKEN_MESSAGE);
  }
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: name,
    space_id: await getMySpaceId(supabase),
  });
  if (error) {
    // Race backstop: two people picking the same name at the same
    // moment both pass the check above, and the unique index rejects
    // the second save. Say so plainly instead of the raw error.
    if (
      error.code === "23505" ||
      /duplicate key value/i.test(error.message ?? "")
    ) {
      throw new Error(NAME_TAKEN_MESSAGE);
    }
    throw error;
  }
}

/** The signed-in user's space name (e.g. "Andrew & Juliette"), or
 * null when the account has no space yet. The spaces table's select
 * policy lets a member read their own space's row. */
export async function getMySpaceName(
  supabase: SupabaseClient,
): Promise<string | null> {
  const spaceId = await getMySpaceId(supabase);
  if (!spaceId) return null;
  const { data, error } = await supabase
    .from("spaces")
    .select("name")
    .eq("id", spaceId)
    .maybeSingle();
  if (error) throw error;
  return (data?.name as string | null) ?? null;
}

/* ---------------- Reads ---------------- */

export async function listItems(supabase: SupabaseClient): Promise<Item[]> {
  const spaceId = await getMySpaceId(supabase);
  // A spaceless account has no rows by definition. Return early:
  // `.eq("space_id", null)` sends `space_id=eq.null`, which
  // PostgREST rejects, so querying here would throw and the home
  // page would show its load-error banner.
  if (!spaceId) return [];
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("space_id", spaceId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data as Item[];
}

export async function listEvents(supabase: SupabaseClient): Promise<CalEvent[]> {
  const spaceId = await getMySpaceId(supabase);
  // A spaceless account has no rows by definition. Return early:
  // `.eq("space_id", null)` sends `space_id=eq.null`, which
  // PostgREST rejects, so querying here would throw and the home
  // page would show its load-error banner.
  if (!spaceId) return [];
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("space_id", spaceId)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true });
  if (error) throw error;
  return data as CalEvent[];
}

export async function listDinnerProposals(
  supabase: SupabaseClient,
): Promise<DinnerProposal[]> {
  const spaceId = await getMySpaceId(supabase);
  // A spaceless account has no rows by definition. Return early:
  // `.eq("space_id", null)` sends `space_id=eq.null`, which
  // PostgREST rejects, so querying here would throw and the home
  // page would show its load-error banner.
  if (!spaceId) return [];
  const { data, error } = await supabase
    .from("dinner_proposals")
    .select("*")
    .eq("space_id", spaceId)
    .order("dinner_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return data as DinnerProposal[];
}

/** How long a scrapbook signed URL stays valid, in seconds (1 hour).
 * The home page re-signs on every load, so a short life is fine and
 * limits how useful a copied link is after the fact. */
const SIGNED_PHOTO_URL_TTL_SECONDS = 3600;

/** Turns stored scrapbook paths into short-lived signed URLs for
 * display. The bucket is private (migration 0014), so public URLs no
 * longer work — signing needs the SELECT policy from that migration.
 * Paths that fail to sign (e.g. the file was removed) come back as
 * null and the photo renders as its caption-only placeholder. */
async function signPhotoUrls(
  supabase: SupabaseClient,
  paths: (string | null)[],
): Promise<(string | null)[]> {
  const toSign = [...new Set(paths.filter((p): p is string => p !== null))];
  if (toSign.length === 0) return paths.map(() => null);
  const { data, error } = await supabase.storage
    .from(SCRAPBOOK_BUCKET)
    .createSignedUrls(toSign, SIGNED_PHOTO_URL_TTL_SECONDS);
  if (error || !data) return paths.map(() => null);
  const byPath = new Map(
    data.map((entry) => [entry.path, entry.signedUrl ?? null]),
  );
  return paths.map((p) => (p === null ? null : (byPath.get(p) ?? null)));
}

function memoryFromRow(
  row: Record<string, unknown>,
  signedUrl: string | null,
): Memory {
  return {
    id: row.id as number,
    caption: (row.caption as string) ?? "",
    memory_date: row.memory_date as string,
    space_id: (row.space_id as string | null) ?? null,
    image_url: signedUrl,
    mime_type: (row.mime_type as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function listMemories(
  supabase: SupabaseClient,
): Promise<Memory[]> {
  const spaceId = await getMySpaceId(supabase);
  // A spaceless account has no rows by definition. Return early:
  // `.eq("space_id", null)` sends `space_id=eq.null`, which
  // PostgREST rejects, so querying here would throw and the home
  // page would show its load-error banner.
  if (!spaceId) return [];
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("space_id", spaceId)
    .order("memory_date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  const rows = data as Record<string, unknown>[];
  const signed = await signPhotoUrls(
    supabase,
    rows.map((row) => row.storage_path as string | null),
  );
  return rows.map((row, i) => memoryFromRow(row, signed[i] ?? null));
}

export async function listCravings(
  supabase: SupabaseClient,
): Promise<Craving[]> {
  const spaceId = await getMySpaceId(supabase);
  // A spaceless account has no rows by definition. Return early:
  // `.eq("space_id", null)` sends `space_id=eq.null`, which
  // PostgREST rejects, so querying here would throw and the home
  // page would show its load-error banner.
  if (!spaceId) return [];
  const { data, error } = await supabase
    .from("cravings")
    .select("*")
    .eq("space_id", spaceId)
    .order("id", { ascending: false });
  if (error) throw error;
  return data as Craving[];
}

export async function listTellYouLater(
  supabase: SupabaseClient,
): Promise<TellYouLater[]> {
  const spaceId = await getMySpaceId(supabase);
  // A spaceless account has no rows by definition. Return early:
  // `.eq("space_id", null)` sends `space_id=eq.null`, which
  // PostgREST rejects, so querying here would throw and the home
  // page would show its load-error banner.
  if (!spaceId) return [];
  const { data, error } = await supabase
    .from("tell_you_later")
    .select("*")
    .eq("space_id", spaceId)
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
      space_id: await getMySpaceId(supabase),
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
    /** Opt this event in to a countdown in Coming up. Needs
     * migration 0013_event_countdown.sql; the insert is retried
     * without it when the column doesn't exist yet. */
    show_countdown?: boolean;
  },
): Promise<number> {
  const base = {
    title: args.title.trim(),
    event_date: args.event_date,
    event_time: (args.event_time ?? "").trim(),
    location: (args.location ?? "").trim(),
    notes: (args.notes ?? "").trim(),
    space_id: await getMySpaceId(supabase),
  };
  let { data, error } = await supabase
    .from("events")
    .insert({ ...base, show_countdown: args.show_countdown ?? false })
    .select("id")
    .single();
  if (error && /show_countdown/i.test(error.message ?? "")) {
    ({ data, error } = await supabase
      .from("events")
      .insert(base)
      .select("id")
      .single());
  }
  if (error) throw error;
  if (!data) throw new Error("That didn't save. Please try again.");
  return data.id as number;
}

export async function deleteEvent(
  supabase: SupabaseClient,
  id: number,
): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

/** Updates a plan's details (title, date, time, location, notes,
 * countdown opt-in). Works without any migration — the columns
 * already exist. When show_countdown is left out it is left alone;
 * when migration 0013 hasn't run yet, an update that includes it is
 * retried without it instead of failing. */
export async function updateEvent(
  supabase: SupabaseClient,
  id: number,
  args: {
    title: string;
    event_date: string;
    event_time?: string;
    location?: string;
    notes?: string;
    show_countdown?: boolean;
  },
): Promise<void> {
  const base = {
    title: args.title.trim(),
    event_date: args.event_date,
    event_time: (args.event_time ?? "").trim(),
    location: (args.location ?? "").trim(),
    notes: (args.notes ?? "").trim(),
  };
  const withCountdown =
    args.show_countdown !== undefined
      ? { ...base, show_countdown: args.show_countdown }
      : base;
  let { error } = await supabase
    .from("events")
    .update(withCountdown)
    .eq("id", id);
  if (error && /show_countdown/i.test(error.message ?? "")) {
    ({ error } = await supabase.from("events").update(base).eq("id", id));
  }
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
    /** Space to tag the proposal with. Defaults to the signed-in
     * user's own space; the counter path passes the original
     * proposal's space instead. */
    space_id?: string | null;
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
      space_id: args.space_id ?? (await getMySpaceId(supabase)),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

/** Records the logged-in person's reply to a pending suggestion.
 * `me` is who is answering (the app knows this from their profile);
 * who suggested it is recorded on the proposal itself. */
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
    .select("status, dinner_date, space_id")
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
    space_id: (data.space_id as string | null) ?? null,
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
      space_id: await getMySpaceId(supabase),
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
      space_id: await getMySpaceId(supabase),
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

/* ---------------- Grocery list ---------------- */

export async function listGroceryItems(
  supabase: SupabaseClient,
): Promise<GroceryItem[]> {
  const spaceId = await getMySpaceId(supabase);
  // A spaceless account has no rows by definition. Return early:
  // `.eq("space_id", null)` sends `space_id=eq.null`, which
  // PostgREST rejects, so querying here would throw and the home
  // page would show its load-error banner.
  if (!spaceId) return [];
  const { data, error } = await supabase
    .from("grocery_items")
    .select("*")
    .eq("space_id", spaceId)
    .order("id", { ascending: false });
  if (error) throw error;
  return data as GroceryItem[];
}

export async function addGroceryItem(
  supabase: SupabaseClient,
  args: {
    title: string;
    note?: string;
    wanted_by: Person;
  },
): Promise<number> {
  const { data, error } = await supabase
    .from("grocery_items")
    .insert({
      title: args.title.trim(),
      note: (args.note ?? "").trim(),
      wanted_by: args.wanted_by,
      is_done: false,
      space_id: await getMySpaceId(supabase),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

/** Checks an item off as picked up (or puts it back). Checking off
 * stamps done_by and done_at; undoing clears both. */
export async function setGroceryItemDone(
  supabase: SupabaseClient,
  id: number,
  done: boolean,
  doneBy: Person | null,
): Promise<void> {
  const { error } = await supabase
    .from("grocery_items")
    .update({
      is_done: done,
      done_by: done ? doneBy : null,
      done_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteGroceryItem(
  supabase: SupabaseClient,
  id: number,
): Promise<void> {
  const { error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/* ---------------- Cooked dishes & ratings ---------------- */

export async function listCookedDishes(
  supabase: SupabaseClient,
): Promise<CookedDish[]> {
  const spaceId = await getMySpaceId(supabase);
  // A spaceless account has no rows by definition. Return early:
  // `.eq("space_id", null)` sends `space_id=eq.null`, which
  // PostgREST rejects, so querying here would throw and the home
  // page would show its load-error banner.
  if (!spaceId) return [];
  const { data, error } = await supabase
    .from("cooked_dishes")
    .select("*")
    .eq("space_id", spaceId)
    .order("cooked_date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return data as CookedDish[];
}

export async function listDishRatings(
  supabase: SupabaseClient,
): Promise<DishRating[]> {
  const spaceId = await getMySpaceId(supabase);
  // Same spaceless early return as the other list functions.
  if (!spaceId) return [];
  const { data, error } = await supabase
    .from("dish_ratings")
    .select("*")
    .eq("space_id", spaceId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data as DishRating[];
}

/** Records a dish the space cooked together — from a recipe idea
 * (pass its item id) or a standalone title. The date defaults to
 * today. Needs migration 0012_cooked_ratings.sql. */
export async function addCookedDish(
  supabase: SupabaseClient,
  args: {
    title: string;
    cooked_date?: string;
    item_id?: number | null;
    cooked_by?: Person | null;
  },
): Promise<number> {
  const { data, error } = await supabase
    .from("cooked_dishes")
    .insert({
      title: args.title.trim(),
      cooked_date: args.cooked_date ?? new Date().toISOString().slice(0, 10),
      item_id: args.item_id ?? null,
      cooked_by: args.cooked_by ?? null,
      space_id: await getMySpaceId(supabase),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

/** Sets (or changes) the signed-in person's star rating on a dish.
 * Each person has one rating per dish (migration 0012's unique
 * index), so rating again overwrites. The lookup is
 * case-insensitive on the name; the index is the backstop if two
 * ratings race and the second insert hits a 23505. */
export async function rateDish(
  supabase: SupabaseClient,
  args: {
    dish_id: number;
    rated_by: Person;
    stars: number;
    note?: string;
  },
): Promise<void> {
  const stars = Math.max(1, Math.min(5, Math.round(args.stars)));
  const name = args.rated_by.trim();
  if (!name) throw new Error("You need a name to rate a dish.");
  const { data: existing } = await supabase
    .from("dish_ratings")
    .select("id")
    .eq("dish_id", args.dish_id)
    .ilike("rated_by", name)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("dish_ratings")
      .update({ stars, note: (args.note ?? "").trim() })
      .eq("id", (existing as { id: number }).id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("dish_ratings").insert({
    dish_id: args.dish_id,
    rated_by: name,
    stars,
    note: (args.note ?? "").trim(),
    space_id: await getMySpaceId(supabase),
  });
  if (error) {
    // Race backstop: another rating for the same dish and name
    // landed first and the unique index rejected this insert.
    // Update the row that won instead of showing a raw error.
    if (
      error.code === "23505" ||
      /duplicate key value/i.test(error.message ?? "")
    ) {
      const { data: winner } = await supabase
        .from("dish_ratings")
        .select("id")
        .eq("dish_id", args.dish_id)
        .ilike("rated_by", name)
        .maybeSingle();
      if (winner) {
        const { error: updateError } = await supabase
          .from("dish_ratings")
          .update({ stars, note: (args.note ?? "").trim() })
          .eq("id", (winner as { id: number }).id);
        if (updateError) throw updateError;
        return;
      }
    }
    throw error;
  }
}

/** Deletes a cooked dish; its ratings go with it (on delete
 * cascade). */
export async function deleteCookedDish(
  supabase: SupabaseClient,
  id: number,
): Promise<void> {
  const { error } = await supabase
    .from("cooked_dishes")
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
  // Photos live under the space's own folder, so the storage rules in
  // migration 0014 can tell one space's photos from another's. A
  // spaceless account has no folder to upload to.
  const spaceId = await getMySpaceId(supabase);
  if (!spaceId) throw new Error(NO_SPACE_MESSAGE);
  const { blob, mimeType } = await preparePhoto(args.file);
  if (blob.size === 0) throw new Error("That photo looks empty.");
  if (blob.size > 12 * 1024 * 1024) {
    throw new Error("That photo is larger than 12 MB.");
  }
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const path = `${spaceId}/memories/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
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
      space_id: spaceId,
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
  groceryItems: GroceryItem[],
  cookedDishes: CookedDish[],
  dishRatings: DishRating[],
): BackupPayload {
  return {
    exported_at: new Date().toISOString(),
    items,
    events,
    dinner_proposals: proposals,
    cravings,
    tell_you_later: tellYouLater,
    grocery_items: groceryItems,
    cooked_dishes: cookedDishes,
    dish_ratings: dishRatings,
    memories: memories.map((m) => ({
      id: m.id,
      caption: m.caption,
      memory_date: m.memory_date,
      space_id: m.space_id,
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
  groceryItems: number;
  cookedDishes: number;
  dishRatings: number;
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
    groceryItems: 0,
    cookedDishes: 0,
    dishRatings: 0,
    memories: 0,
    skipped: 0,
  };
  if (!payload || typeof payload !== "object") {
    throw new Error("That file doesn't look like a couples-app backup.");
  }
  const raw = payload as Record<string, unknown>;

  // Restoring a backup always lands in the importer's own space
  // (migration 0007): every insert must carry space_id or it fails
  // the new WITH CHECK and is counted as skipped. A row's own
  // space_id is kept only when it already matches; anything else
  // (missing, or another space's) is replaced with the importer's.
  const mySpaceId = await getMySpaceId(supabase);
  const importSpaceId = (row: Record<string, unknown>): string | null =>
    typeof row.space_id === "string" && row.space_id === mySpaceId
      ? row.space_id
      : mySpaceId;

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
      space_id: importSpaceId(row),
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
      // Shared by both the primary insert and the no-is_done
      // fallback below, so the retry keeps the space tag too.
      space_id: importSpaceId(row),
    };
    // Carry the done state and the countdown opt-in when the backup
    // has them. If migration 0008 or 0013 hasn't run yet the is_done
    // or show_countdown column doesn't exist, so fall back to
    // importing the plan without those instead of dropping the whole
    // event.
    let { error } = await supabase.from("events").insert({
      ...eventBase,
      is_done: isDone,
      done_at:
        isDone && typeof row.done_at === "string" ? row.done_at : null,
      show_countdown: row.show_countdown === true,
    });
    if (error && /(is_done|show_countdown)/.test(error.message ?? "")) {
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
    const suggestedBy = asName(row.suggested_by);
    if (
      typeof row.title !== "string" ||
      !row.title.trim() ||
      !suggestedBy
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
        suggested_by: suggestedBy,
        status,
        responded_by: asName(row.responded_by),
        responded_at:
          typeof row.responded_at === "string" ? row.responded_at : null,
        dinner_date: isValidDate(row.dinner_date) ? row.dinner_date : null,
        space_id: importSpaceId(row),
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
      space_id: importSpaceId(row),
    });
    if (error) result.skipped += 1;
    else result.memories += 1;
  }

  // Cravings are new in migration 0002, so older backups may not have
  // them at all — that is fine, nothing is skipped for a missing list.
  const rawCravings = Array.isArray(raw.cravings) ? raw.cravings : [];
  for (const r of rawCravings) {
    const row = r as Record<string, unknown>;
    const wantedBy = asName(row.wanted_by);
    if (
      typeof row.title !== "string" ||
      !row.title.trim() ||
      (row.kind !== "craving" && row.kind !== "looking_for") ||
      !wantedBy
    ) {
      result.skipped += 1;
      continue;
    }
    const status = row.status === "fulfilled" ? "fulfilled" : "open";
    const { error } = await supabase.from("cravings").insert({
      title: row.title.trim().slice(0, 200),
      kind: row.kind,
      note: typeof row.note === "string" ? row.note.slice(0, 1000) : "",
      wanted_by: wantedBy,
      status,
      fulfilled_by: asName(row.fulfilled_by),
      fulfilled_note:
        typeof row.fulfilled_note === "string"
          ? row.fulfilled_note.slice(0, 1000)
          : "",
      fulfilled_at:
        status === "fulfilled" && typeof row.fulfilled_at === "string"
          ? row.fulfilled_at
          : null,
      space_id: importSpaceId(row),
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
    const wantedBy = asName(row.wanted_by);
    if (
      typeof row.text !== "string" ||
      !row.text.trim() ||
      (row.kind !== "tell" && row.kind !== "do" && row.kind !== "news") ||
      !wantedBy
    ) {
      result.skipped += 1;
      continue;
    }
    const isDone = row.is_done === true;
    const { error } = await supabase.from("tell_you_later").insert({
      kind: row.kind,
      text: row.text.trim().slice(0, 500),
      note: typeof row.note === "string" ? row.note.slice(0, 1000) : "",
      wanted_by: wantedBy,
      is_done: isDone,
      done_by: asName(row.done_by),
      done_at:
        isDone && typeof row.done_at === "string" ? row.done_at : null,
      space_id: importSpaceId(row),
    });
    if (error) result.skipped += 1;
    else result.tellYouLater += 1;
  }

  // Grocery items are new in migration 0011, so older backups may
  // not have them at all — that is fine, nothing is skipped for a
  // missing list.
  const rawGrocery = Array.isArray(raw.grocery_items)
    ? raw.grocery_items
    : [];
  for (const r of rawGrocery) {
    const row = r as Record<string, unknown>;
    const wantedBy = asName(row.wanted_by);
    if (typeof row.title !== "string" || !row.title.trim() || !wantedBy) {
      result.skipped += 1;
      continue;
    }
    const isDone = row.is_done === true;
    const { error } = await supabase.from("grocery_items").insert({
      title: row.title.trim().slice(0, 200),
      note: typeof row.note === "string" ? row.note.slice(0, 200) : "",
      wanted_by: wantedBy,
      is_done: isDone,
      done_by: asName(row.done_by),
      done_at:
        isDone && typeof row.done_at === "string" ? row.done_at : null,
      space_id: importSpaceId(row),
    });
    if (error) result.skipped += 1;
    else result.groceryItems += 1;
  }

  // Cooked dishes are new in migration 0012, so older backups may not
  // have them at all. Dishes are inserted in original order so the
  // ratings below can re-link to the new ids; the link back to the
  // recipe idea (item_id) is not preserved, since items get new ids
  // on import too.
  const dishIdMap = new Map<number, number>();
  const rawDishes = Array.isArray(raw.cooked_dishes)
    ? raw.cooked_dishes
    : [];
  for (const r of rawDishes) {
    const row = r as Record<string, unknown>;
    if (typeof row.title !== "string" || !row.title.trim()) {
      result.skipped += 1;
      continue;
    }
    if (!isValidDate(row.cooked_date)) {
      result.skipped += 1;
      continue;
    }
    const { data, error } = await supabase
      .from("cooked_dishes")
      .insert({
        title: row.title.trim().slice(0, 200),
        cooked_date: row.cooked_date,
        item_id: null,
        cooked_by: asName(row.cooked_by),
        space_id: importSpaceId(row),
      })
      .select("id")
      .single();
    if (error || !data) {
      result.skipped += 1;
      continue;
    }
    result.cookedDishes += 1;
    if (typeof row.id === "number") dishIdMap.set(row.id, data.id as number);
  }

  // Dish ratings are new in migration 0012. A rating whose dish
  // wasn't imported has nowhere to go, so it is skipped.
  const rawRatings = Array.isArray(raw.dish_ratings)
    ? raw.dish_ratings
    : [];
  for (const r of rawRatings) {
    const row = r as Record<string, unknown>;
    const ratedBy = asName(row.rated_by);
    const stars =
      typeof row.stars === "number" ? Math.round(row.stars) : 0;
    const newDishId =
      typeof row.dish_id === "number"
        ? dishIdMap.get(row.dish_id)
        : undefined;
    if (!ratedBy || stars < 1 || stars > 5 || newDishId === undefined) {
      result.skipped += 1;
      continue;
    }
    const { error } = await supabase.from("dish_ratings").insert({
      dish_id: newDishId,
      rated_by: ratedBy,
      stars,
      note: typeof row.note === "string" ? row.note.slice(0, 500) : "",
      space_id: importSpaceId(row),
    });
    if (error) result.skipped += 1;
    else result.dishRatings += 1;
  }

  return result;
}
