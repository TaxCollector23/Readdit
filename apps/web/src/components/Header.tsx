"use client";

import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-sm font-semibold text-ink">
          <span className="grid h-7 w-7 place-items-center border border-ink bg-ink font-mono text-[11px] text-canvas">
            r/
          </span>
          <span>Readdit</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm text-muted sm:gap-x-5">
          <Link href="/playground" className="hover:text-ink">Playground</Link>
          <Link href="/cli" className="hover:text-ink">CLI</Link>
          <Link href="/mcp" className="hover:text-ink">MCP</Link>
          <Link href="/about" className="hover:text-ink">About</Link>
          <a
            href="https://github.com/TaxCollector23/Readdit"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink"
          >
            GitHub
          </a>
          {user ? (
            <button
              onClick={() => signOut(auth)}
              className="inline-flex items-center gap-1.5 hover:text-ink"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 border border-border bg-surface px-3 py-1.5 text-ink hover:border-accent hover:text-accent"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
