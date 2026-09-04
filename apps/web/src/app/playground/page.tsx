import { Suspense } from "react";
import { Header } from "@/components/Header";
import { PlaygroundClient } from "@/components/PlaygroundClient";
import { RecentSearches } from "@/components/RecentSearches";
import { auth } from "@/lib/auth";
import { getSearchHistory } from "@/lib/db";

export const metadata = { title: "Playground — Readdit" };

export default async function PlaygroundPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const isAuthed = Boolean(userId);
  const history = userId ? getSearchHistory(userId, 8) : [];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Playground</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">What should I read for you?</h1>
        <p className="mt-2 text-sm text-muted">
          Ask a question or name a product. Live research needs a free account — you can type
          your question first and sign in only when you hit Analyze.
        </p>

        <div className="mt-8">
          <Suspense>
            <PlaygroundClient isAuthed={isAuthed} />
          </Suspense>
        </div>

        <RecentSearches history={history} />
      </main>
    </>
  );
}
