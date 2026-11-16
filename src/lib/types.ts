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

export type ItemStatus = "idea" | "done";

export interface Item {
  id: number;
  category: Category;
  title: string;
  notes: string;
  season: Season | null;
  status: ItemStatus;
  done_at: string | null;
  created_at: string;
}

export interface CalEvent {
  id: number;
  title: string;
  event_date: string; // YYYY-MM-DD
  event_time: string;
  location: string;
  notes: string;
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
  created_at: string;
  responded_at: string | null;
}

export interface Memory {
  id: number;
  caption: string;
  memory_date: string; // YYYY-MM-DD
  /** Public URL of the photo, or null when the memory was imported from a
   * backup that had no photo (the prototype's export has no photo bytes). */
  image_url: string | null;
  mime_type: string | null;
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
}

/** The JSON backup format. Identical to the prototype's export so a backup
 * downloaded from the prototype can be imported here, and vice versa. */
export interface BackupPayload {
  exported_at: string;
  items: Item[];
  events: CalEvent[];
  dinner_proposals: DinnerProposal[];
  cravings: Craving[];
  memories: Array<{
    id: number;
    caption: string;
    memory_date: string;
  }>;
}
