import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";

export const metadata = {
  title: "About - Readdit",
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="font-mono text-xs uppercase text-accent">About Readdit</p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight text-ink sm:text-4xl">
          It started as a joke about someone&apos;s &ldquo;rep.&rdquo;
        </h1>

        <div className="mt-8 space-y-5 text-base leading-8 text-muted">
          <p>
            I have a friend who is a little older than me, and every couple of weeks
            he would ask some version of the same question: what was his reputation
            for something? Eventually it became a running joke. When we saw him, we
            would bring up his weather rep, teacher rep, greeting rep, or food rep
            just to keep the bit alive.
          </p>
          <p>
            That got me thinking about the version of &ldquo;rep&rdquo; that already exists on
            Reddit. People are constantly comparing tools, complaining about products,
            describing weird edge cases, and leaving little firsthand notes about
            what worked and what did not.
          </p>
          <p>
            Readdit is a way to search through those conversations and understand
            what people are actually saying about a business, website, product, brand,
            or technical tool. It can look at historical Reddit discussions too, so
            the answer is not limited to whatever happened to be posted today.
          </p>
          <p>
            You can use it through the MCP server, the CLI, or the web playground.
            The goal is simple: make Reddit&apos;s scattered signal easier to read without
            pretending it is more representative than it is.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/playground"
            className="inline-flex items-center gap-2 bg-ink px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-accent"
          >
            Open playground
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:border-accent hover:text-accent"
          >
            View example report
          </Link>
        </div>
      </main>
    </>
  );
}
