import { Suspense } from "react";
import { checkConfig } from "@readdit/core";
import { Header } from "@/components/Header";
import { PlaygroundClient } from "@/components/PlaygroundClient";
import { RecentSearches } from "@/components/RecentSearches";
import { auth } from "@/lib/auth";
import { getSearchHistory } from "@/lib/db";

export const metadata = { title: "Playground - Readdit" };

export default async function PlaygroundPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const isAuthed = Boolean(userId);
  const history = userId ? getSearchHistory(userId, 8) : [];
  const aiConfigured = checkConfig({ requireAi: true }).ok;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="font-mono text-xs uppercase text-accent">Playground</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">What should Readdit read?</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Search sources without any AI key. Sign in and add a Gemini key for live analysis or
          comparisons.
        </p>

        <div className="mt-8">
          <Suspense>
            <PlaygroundClient isAuthed={isAuthed} aiConfigured={aiConfigured} />
          </Suspense>
        </div>

        <RecentSearches history={history} />
      </main>
    </>
  );
}
