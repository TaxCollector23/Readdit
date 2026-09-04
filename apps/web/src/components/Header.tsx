import Link from "next/link";
import { auth } from "@/lib/auth";
import { SignOutButton } from "./SignOutButton";

export async function Header() {
  const session = await auth();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-mono text-sm font-bold text-ink">
          <span className="text-accent">●</span> readdit
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <Link href="/playground" className="hover:text-ink">
            Playground
          </Link>
          <Link href="/demo" className="hover:text-ink">
            Demo
          </Link>
          <a
            href="https://github.com/readdit"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink"
          >
            GitHub
          </a>
          {session?.user ? (
            <SignOutButton />
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-border px-3 py-1.5 text-ink hover:border-accent hover:text-accent"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
