"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const OPTIONS = [
  { label: "Use it in the playground", href: "/playground" },
  { label: "Use the MCP", href: "/mcp" },
  { label: "Download the CLI", href: "/cli" },
];

export function HeroButton() {
  const [open, setOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setOpen(true);
  }
  function scheduleHide() {
    hideTimer.current = setTimeout(() => setOpen(false), 180);
  }

  return (
    <div className="relative inline-block" onMouseEnter={show} onMouseLeave={scheduleHide}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 bg-ink px-5 py-3 text-sm font-semibold text-canvas hover:bg-accent"
      >
        Test it out
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-50 min-w-[220px] border border-border bg-surface shadow-md"
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
        >
          {OPTIONS.map((opt, i) => (
            <Link
              key={opt.href}
              href={opt.href}
              className={`block px-4 py-3 text-sm text-ink hover:bg-canvas hover:text-accent ${
                i < OPTIONS.length - 1 ? "border-b border-border" : ""
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
