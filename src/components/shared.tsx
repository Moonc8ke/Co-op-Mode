import type { ReactNode } from "react";

/** Every section gets its own tinted panel, a filled icon chip in the
 * section's color, and a count pill, so sections read as distinct places
 * instead of one long undifferentiated list. */
export function sectionPanelStyle(soft: string): { background: string } {
  return {
    background: `color-mix(in srgb, ${soft} 60%, var(--surface))`,
  };
}

export function SectionHeader({
  emoji,
  label,
  blurb,
  color,
  pill,
}: {
  emoji: string;
  label: string;
  blurb: string;
  color: string;
  pill?: string;
}) {
  return (
    <div className="flex items-start gap-3">
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
