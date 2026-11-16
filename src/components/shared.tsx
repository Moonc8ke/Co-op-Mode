import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** Every section gets its own tinted panel, a filled icon chip in the
 * section's color, and a count pill, so sections read as distinct places
 * instead of one long undifferentiated list. */
export function sectionPanelStyle(soft: string): { background: string } {
  return {
    background: `color-mix(in srgb, ${soft} 60%, var(--surface))`,
  };
}

const COLLAPSED_SECTIONS_KEY = "couples-app-collapsed-sections";

/** Which home-page sections are tucked away, kept in localStorage so the
 * choice sticks on this device. Every section starts open; the saved set
 * is read once on mount (localStorage isn't there during the server
 * render, so the first paint is all-open, then this applies). */
export function useCollapsedSections() {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSED_SECTIONS_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const ids = parsed.filter(
            (v): v is string => typeof v === "string",
          );
          if (ids.length > 0) setCollapsed(new Set(ids));
        }
      }
    } catch {
      // localStorage unavailable or corrupt; everything just stays open.
    }
  }, []);

  const toggle = useCallback((id: string) => {
    const next = new Set(collapsedRef.current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsedRef.current = next;
    setCollapsed(next);
    try {
      window.localStorage.setItem(
        COLLAPSED_SECTIONS_KEY,
        JSON.stringify([...next]),
      );
    } catch {
      // ignore
    }
  }, []);

  const isCollapsed = useCallback(
    (id: string) => collapsed.has(id),
    [collapsed],
  );

  return { isCollapsed, toggle };
}

export function SectionHeader({
  emoji,
  label,
  blurb,
  color,
  pill,
  // When onToggle is given, the header gets a little chevron that tucks
  // the section's contents away (down arrow) or brings them back (up
  // arrow). Tapping the header does the same. No words, just the arrow;
  // the aria-label carries the meaning for screen readers.
  collapsed,
  onToggle,
}: {
  emoji: string;
  label: string;
  blurb: string;
  color: string;
  pill?: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 ${onToggle ? "cursor-pointer select-none" : ""}`}
      onClick={onToggle}
    >
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[22px] shadow-sm"
        style={{ background: color }}
      >
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-2xl font-semibold leading-tight">
          {label}
        </h2>
        <p className="mt-0.5 text-sm text-[var(--dim)]">{blurb}</p>
      </div>
      {pill && (
        <span
          className="mt-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: color, color: "var(--bg)" }}
        >
          {pill}
        </span>
      )}
      {onToggle && (
        <button
          type="button"
          aria-label={collapsed ? `Show ${label}` : `Hide ${label}`}
          aria-expanded={!collapsed}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="mt-1 shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--dim)]"
        >
          <svg
            aria-hidden
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={`transition-transform ${collapsed ? "" : "rotate-180"}`}
          >
            <path
              d="M3 5.5 8 10.5 13 5.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export function EmptyNote({ text }: { text: string }) {
  return (
    <p className="mt-3 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--dim)]">
      {text}
    </p>
  );
}

/** Shared bottom-sheet / centered dialog shell used by the detail pop-outs. */
export function DetailDialog({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="pop-in max-h-[92vh] w-full max-w-md overflow-auto rounded-t-[1.4rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl sm:rounded-[1.4rem]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
