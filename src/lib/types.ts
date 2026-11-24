export type Season = "Spring" | "Summer" | "Fall" | "Winter";

export type Category =
  | "seasonal"
  | "longterm"
  | "date"
  | "dinner"
  | "recipe"
  | "craft"
  | "places";

export type Person = "Andrew" | "Juliette";

/** One row per signed-in account, saying which of the two people it is.
 * The app reads this on sign-in so the dinner and cravings forms already
 * know who is typing. */
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

/** The JSON backup format. Identical to the prototype's export so a backup
 * downloaded from the prototype can be imported here, and vice versa. */
export interface BackupPayload {
  exported_at: string;
  items: Item[];
  events: CalEvent[];
  dinner_proposals: DinnerProposal[];
  cravings: Craving[];
  tell_you_later: TellYouLater[];
  memories: Array<{
    id: number;
    caption: string;
    memory_date: string;
    space_id: string | null;
  }>;
}
