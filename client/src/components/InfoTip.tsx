"use client";

import { useId, useState } from "react";
import { GLOSSARY } from "@/lib/glossary";

interface Props {
  /** Key into the glossary. */
  term: string;
  /** Optional visible text; defaults to the term itself. */
  children?: React.ReactNode;
  /** Render as a bare "?" badge rather than underlining inline text. */
  badge?: boolean;
}

/**
 * Explains a term in plain English on hover or focus.
 *
 * Keyboard and touch users get the same content as mouse users — the tooltip
 * opens on focus, not just hover, and the definition is also exposed to screen
 * readers, so it is never information available only by pointing at something.
 */
export default function InfoTip({ term, children, badge = false }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const entry = GLOSSARY[term];

  if (!entry) return <>{children ?? term}</>;

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => setOpen((v) => !v)}
        className={
          badge
            ? "grid h-4 w-4 place-items-center rounded-full bg-surface-2 text-[10px] font-medium text-ink-muted ring-1 ring-hairline transition-colors hover:text-ink-primary"
            : "cursor-help text-left underline decoration-dotted decoration-from-font underline-offset-[3px]"
        }
      >
        {badge ? "?" : (children ?? term)}
        <span className="sr-only"> — {entry.plain}</span>
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl bg-surface-1 p-3 text-left shadow-xl ring-1 ring-hairline"
        >
          <span className="label-mono mb-1.5 block text-brand">{term}</span>
          <span className="caption block font-normal normal-case tracking-normal text-ink-secondary">
            {entry.plain}
          </span>
          {entry.technical && (
            <span className="caption mt-1.5 block border-t border-grid pt-1.5 text-ink-muted">
              {entry.technical}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
