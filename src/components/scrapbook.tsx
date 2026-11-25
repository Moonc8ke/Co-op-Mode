"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { addMemory, deleteMemory } from "@/lib/data";
import { fmtFull, todayStr } from "@/lib/seasons";
import type { Memory } from "@/lib/types";
import { EmptyNote, SectionHeader, sectionPanelStyle } from "./shared";
import { useBackLayer } from "@/lib/back-nav";

const ROTATIONS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "rotate-0"];

/** A month's memories, in the order they arrived (newest first). */
interface MonthGroup {
  key: string;
  label: string;
  memories: Memory[];
}

/** Groups memories by the year-month of their date, newest month
 * first. A memory with no usable date lands in an "Undated" group at
 * the end instead of disappearing (memory_date is required, so this
 * should not happen, but backups can carry odd rows). */
function groupByMonth(memories: Memory[]): MonthGroup[] {
  const byKey = new Map<string, MonthGroup>();
  const undated: Memory[] = [];
  for (const m of memories) {
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(m.memory_date ?? "");
    if (!match) {
      undated.push(m);
      continue;
    }
    const key = `${match[1]}-${match[2]}`;
    let group = byKey.get(key);
    if (!group) {
      const label = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        1,
      ).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      group = { key, label, memories: [] };
      byKey.set(key, group);
    }
    group.memories.push(m);
  }
  const groups = [...byKey.values()];
  if (undated.length > 0) {
    groups.push({ key: "undated", label: "Undated", memories: undated });
  }
  return groups;
}

export function ScrapbookSection({
  memories,
  refresh,
}: {
  memories: Memory[];
  refresh: () => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState(todayStr());
  const [selected, setSelected] = useState<Memory | null>(null);
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Back navigation: the enlarged memory is a back step (see
  // src/lib/back-nav.ts).
  const viewerNav = useBackLayer("memory-view", selected !== null, () =>
    setSelected(null),
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setFormError("Choose a photo first.");
      return;
    }
    if (!date) {
      setFormError("Pick the date this memory happened.");
      return;
    }
    if (pending) return;
    setPending(true);
    setFormError("");
    try {
      await addMemory(supabase, {
        caption: caption.trim(),
        memory_date: date,
        file,
      });
      setFile(null);
      setPreview(null);
      setCaption("");
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "That photo didn't save. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  function onPick(f: File | null) {
    setFormError("");
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function removeSelected() {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteMemory(supabase, selected.id);
      viewerNav.closeViaUi();
      refresh();
    } finally {
      setDeleting(false);
    }
  }

  // Let the enlarged memory be dismissed with the keyboard, not just a tap.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") viewerNav.closeViaUi();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, viewerNav]);

  const rotations = useMemo(() => ROTATIONS, []);
  const monthGroups = useMemo(() => groupByMonth(memories), [memories]);

  return (
    <section
      aria-label="Scrapbook memories"
      className="mt-8 rounded-[1.4rem] border border-[var(--border)] p-4 shadow-sm sm:p-5"
      style={sectionPanelStyle("var(--berry-soft)")}
    >
      <SectionHeader
        emoji="📸"
        label="Scrapbook Memories"
        blurb="The days you've already lived together, kept like polaroids in a book. Tap a photo to see it big."
        color="var(--berry)"
        pill={
          memories.length > 0
            ? `${memories.length} ${memories.length === 1 ? "memory" : "memories"}`
            : undefined
        }
      />

      {memories.length === 0 ? (
        <EmptyNote text="No memories pasted in yet. Add your first photo below — a hike, a dinner, an ordinary Tuesday that felt good." />
      ) : (
        <div className="mt-5 space-y-7">
          {monthGroups.map((group) => (
            <div key={group.key}>
              <div className="flex items-baseline gap-2">
                <h3 className="font-display text-lg italic text-[var(--berry)]">
                  {group.label}
                </h3>
                <span className="text-xs text-[var(--dim)]">
                  {group.memories.length}{" "}
                  {group.memories.length === 1 ? "memory" : "memories"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {group.memories.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-label={`View memory: ${m.caption || fmtFull(m.memory_date)}`}
                    onClick={() => {
                      setSelected(m);
                      viewerNav.open();
                    }}
                    className={`tape relative bg-white p-2 pb-3 text-left shadow-md transition-transform ${rotations[idx % rotations.length] ?? ""}`}
                  >
                    {m.image_url ? (
                      <img
                        src={m.image_url}
                        alt={m.caption || `Memory from ${fmtFull(m.memory_date)}`}
                        className="aspect-square w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex aspect-square w-full flex-col items-center justify-center bg-stone-100 p-3 text-center">
                        <span aria-hidden className="text-3xl">
                          🖼️
                        </span>
                        <span className="mt-2 text-xs leading-snug text-stone-500">
                          Photo not in the backup — add it again if you have
                          it.
                        </span>
                      </div>
                    )}
                    <p className="font-display mt-2 line-clamp-2 px-1 text-sm italic leading-snug text-stone-700">
                      {m.caption || " "}
                    </p>
                    <p className="px-1 text-xs text-stone-500">
                      {fmtFull(m.memory_date)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3"
      >
        <p className="text-sm font-semibold">Paste in a new memory</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <div className="shrink-0">
            {preview ? (
              <img
                src={preview}
                alt="Photo you picked for this memory"
                className="h-28 w-28 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg)] text-3xl">
                🖼️
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              aria-label="Choose a photo for this memory"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 w-28 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium"
            >
              {file ? "Change photo" : "Choose photo"}
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <input
              aria-label="Caption for this memory"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption — what made this day worth keeping?"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label
                htmlFor="memory-date"
                className="text-sm text-[var(--dim)]"
              >
                Date it happened
              </label>
              <input
                id="memory-date"
                type="date"
                aria-label="Date this memory happened"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base"
              />
              <button
                type="submit"
                disabled={!file || pending}
                className="rounded-full bg-[var(--berry)] px-4 py-2 text-sm font-semibold text-[var(--bg)] disabled:opacity-40"
              >
                {pending ? "Pasting in…" : "Add to scrapbook"}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-[var(--dim)]">
              Big phone photos are shrunk a little so they save fast. JPG and
              PNG work best.
            </p>
          </div>
        </div>
        {formError && (
          <p className="mt-2 text-sm text-[var(--rose)]">{formError}</p>
        )}
      </form>

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Memory, enlarged"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => viewerNav.closeViaUi()}
        >
          <div
            className="tape relative max-h-full w-full max-w-md overflow-auto bg-white p-3 pb-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {selected.image_url ? (
              <img
                src={selected.image_url}
                alt={
                  selected.caption ||
                  `Memory from ${fmtFull(selected.memory_date)}`
                }
                className="w-full object-contain"
              />
            ) : (
              <div className="flex aspect-square w-full flex-col items-center justify-center bg-stone-100 p-3 text-center">
                <span aria-hidden className="text-4xl">
                  🖼️
                </span>
                <span className="mt-2 text-sm text-stone-500">
                  This memory came from a backup without its photo.
                </span>
              </div>
            )}
            <p className="font-display mt-3 px-1 text-lg italic leading-snug text-stone-800">
              {selected.caption || "Untitled memory"}
            </p>
            <p className="px-1 text-sm text-stone-500">
              {fmtFull(selected.memory_date)}
            </p>
            <div className="mt-3 flex gap-2 px-1">
              <button
                type="button"
                onClick={() => viewerNav.closeViaUi()}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
              >
                Close
              </button>
              <button
                type="button"
                aria-label="Delete this memory"
                onClick={() => void removeSelected()}
                disabled={deleting}
                className="rounded-full bg-[#be6a7a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {deleting ? "Removing…" : "Remove from scrapbook"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
