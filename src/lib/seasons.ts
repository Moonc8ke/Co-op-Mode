import type { Season } from "./types";

export const SEASONS: Season[] = ["Spring", "Summer", "Fall", "Winter"];

export const SEASON_EMOJI: Record<Season, string> = {
  Spring: "🌸",
  Summer: "☀️",
  Fall: "🍂",
  Winter: "❄️",
};

export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function seasonFor(d: Date): Season {
  const m = d.getMonth();
  if (m >= 2 && m <= 4) return "Spring";
  if (m >= 5 && m <= 7) return "Summer";
  if (m >= 8 && m <= 10) return "Fall";
  return "Winter";
}

/** How far ahead `to` sits in the yearly cycle from `from`: 0 = this
 * season, 1 = up next, and so on around the year. */
export function seasonOffset(from: Season, to: Season): number {
  return (
    (SEASONS.indexOf(to) - SEASONS.indexOf(from) + SEASONS.length) %
    SEASONS.length
  );
}

export function fmtDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function fmtFull(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function relDay(ymd: string): string {
  const today = todayStr();
  if (ymd === today) return "Today";
  const t = new Date(`${today}T00:00:00`).getTime();
  const e = new Date(`${ymd}T00:00:00`).getTime();
  const diff = Math.round((e - t) / 86400000);
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff} days ago`;
  return "";
}

export function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (isToday) return `Today · ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${time}`;
}

export function otherPerson(p: "Andrew" | "Juliette"): "Andrew" | "Juliette" {
  return p === "Andrew" ? "Juliette" : "Andrew";
}
