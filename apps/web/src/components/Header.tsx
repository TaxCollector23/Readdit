"use client";

import Link from "next/link";
import { LogIn, LogOut, Search } from "lucide-react";
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
          <Link href="/playground" className="inline-flex items-center gap-1.5 hover:text-ink">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            Playground
          </Link>
          <Link href="/about" className="hover:text-ink">
            About
          </Link>
          <Link href="/demo" className="hover:text-ink">
            Demo
          </Link>
          <a
            href="https://github.com/TaxCollector23/Readdit"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-ink"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
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
