export type Season = "Spring" | "Summer" | "Fall" | "Winter";

export type Category =
  | "seasonal"
  | "longterm"
  | "date"
  | "dinner"
  | "recipe"
  | "craft"
  | "places";

/** A person's name in the space. Free-form since migration 0009
 * (it used to be exactly "Andrew" | "Juliette") — any member types
 * their own name in the "Who are you?" picker, and a space can hold
 * any number of people. */
export type Person = string;

/** A space is a relationship (named after its members) or a family
 * (named after a last name). Kind picker at creation, migration 0015. */
export type SpaceKind = "relationship" | "family";

/** What the app needs to know about the signed-in user's space:
 * its kind and invite code (migration 0015), plus the member names
 * the display name is derived from (see deriveSpaceName in data.ts).
 * `stored_name` is the creation-time label in the spaces table,
 * used only as a fallback when a relationship space has no member
 * names to derive from yet. */
export interface SpaceInfo {
  id: string;
  kind: SpaceKind;
  family_name: string | null;
  invite_code: string | null;
  invite_expires_at: string | null;
  member_names: string[];
  stored_name: string | null;
}

/** One row per signed-in account, saying which person in the space
 * it is. The app reads this on sign-in so the dinner and cravings
 * forms already know who is typing. */
export interface Profile {
  id: string;
  display_name: Person;
  /** The Relationship Space this account belongs to. Null until the
   * account is assigned a space (migration 0007). */
  space_id: string | null;
  created_at: string;
}

export type ItemStatus = "idea" | "done";

export interface Item {
  id: number;
  category: Category;
  title: string;
  notes: string;
  season: Season | null;
  status: ItemStatus;
  done_at: string | null;
  /** The Relationship Space this row belongs to (migration 0007). */
  space_id: string | null;
  created_at: string;
}

export interface CalEvent {
  id: number;
  title: string;
  event_date: string; // YYYY-MM-DD
  event_time: string;
  location: string;
  notes: string;
  /** True once the plan has happened and been marked done. Needs
   * migration 0008_event_done.sql; rows read before it ran have this
   * field missing, which the UI treats as not done. */
  is_done: boolean;
  done_at: string | null;
  /** True when this event counts down in Coming up and its detail
   * pop-out. Opt-in per event in the event form; off by default.
   * Needs migration 0013_event_countdown.sql; rows read before it
   * ran have this field missing, which the UI treats as off. */
  show_countdown: boolean;
  /** The Relationship Space this row belongs to (migration 0007). */
  space_id: string | null;
  created_at: string;
}

export type ProposalStatus = "pending" | "accepted" | "declined" | "countered";

export interface DinnerProposal {
  id: number;
  title: string;
  notes: string;
  suggested_by: Person;
  status: ProposalStatus;
  responded_by: Person | null;
  counter_of_id: number | null;
  /** The night this dinner is for, YYYY-MM-DD. Null for suggestions
   * saved before dates were added — those show under "No day picked yet". */
  dinner_date: string | null;
  created_at: string;
  responded_at: string | null;
  /** The Relationship Space this row belongs to (migration 0007). */
  space_id: string | null;
}

export interface Memory {
  id: number;
  caption: string;
  memory_date: string; // YYYY-MM-DD
  /** Public URL of the photo, or null when the memory was imported from a
   * backup that had no photo (the prototype's export has no photo bytes). */
  image_url: string | null;
  mime_type: string | null;
  /** The Relationship Space this row belongs to (migration 0007). */
  space_id: string | null;
  created_at: string;
}

export type CravingKind = "craving" | "looking_for";

export type CravingStatus = "open" | "fulfilled";

export interface Craving {
  id: number;
  title: string;
  kind: CravingKind;
  note: string;
  wanted_by: Person;
  status: CravingStatus;
  fulfilled_by: Person | null;
  fulfilled_note: string;
  created_at: string;
  fulfilled_at: string | null;
  /** The Relationship Space this row belongs to (migration 0007). */
  space_id: string | null;
}

export type TellYouLaterKind = "tell" | "do" | "news";

export interface TellYouLater {
  id: string;
  kind: TellYouLaterKind;
  text: string;
  note: string;
  wanted_by: Person;
  is_done: boolean;
  done_by: Person | null;
  created_at: string;
  done_at: string | null;
  /** The Relationship Space this row belongs to (migration 0007). */
  space_id: string | null;
}

/** One thing to pick up at the shop (migration 0011). The note is
 * the quantity or detail ("2 lbs", "the good kind"). Done items
 * stay in the table so the app can show them in "Picked up" history;
 * unchecking brings an item back. */
export interface GroceryItem {
  id: number;
  title: string;
  note: string;
  wanted_by: Person;
  is_done: boolean;
  done_by: Person | null;
  done_at: string | null;
  /** The Relationship Space this row belongs to (migration 0007). */
  space_id: string | null;
  created_at: string;
}

/** One dish the space cooked together (migration 0012). item_id
 * links back to the recipe idea it came from, or null for a
 * standalone dish (and null if that idea is deleted). */
export interface CookedDish {
  id: number;
  title: string;
  cooked_date: string; // YYYY-MM-DD
  item_id: number | null;
  cooked_by: Person | null;
  /** The Relationship Space this row belongs to (migration 0007). */
  space_id: string | null;
  created_at: string;
}

/** One person's star rating on a cooked dish (migration 0012).
 * Each person has exactly one rating per dish — rating again
 * overwrites it. */
export interface DishRating {
  id: number;
  dish_id: number;
  rated_by: Person;
  stars: number; // 1-5
  note: string;
  /** The Relationship Space this row belongs to (migration 0007). */
  space_id: string | null;
  created_at: string;
}

/** The JSON backup format. Identical to the prototype's export so a backup
 * downloaded from the prototype can be imported here, and vice versa.
 * The grocery, cooked-dish, and rating lists are newer than the
 * prototype, so older backups simply don't have them. */
export interface BackupPayload {
  exported_at: string;
  items: Item[];
  events: CalEvent[];
  dinner_proposals: DinnerProposal[];
  cravings: Craving[];
  tell_you_later: TellYouLater[];
  grocery_items: GroceryItem[];
  cooked_dishes: CookedDish[];
  dish_ratings: DishRating[];
  memories: Array<{
    id: number;
    caption: string;
    memory_date: string;
    space_id: string | null;
  }>;
}
