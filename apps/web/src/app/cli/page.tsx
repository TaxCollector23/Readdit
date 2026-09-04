import Link from "next/link";
import { Header } from "@/components/Header";
import { ArrowLeft, Terminal } from "lucide-react";

export const metadata = { title: "CLI - Readdit" };

const CODE_BLOCKS = [
  { label: "Install", code: "npm install -g readdit-cli" },
  { label: "Analyze a product", code: 'readdit analyze "Cursor"' },
  { label: "Compare two products", code: 'readdit compare "Cursor" "Claude Code"' },
  { label: "Find complaints", code: 'readdit complaints "Vercel" --json' },
  { label: "Search sources only", code: 'readdit search "Linear app"' },
];

const ENV_BLOCK = `# Add to your shell profile or .env file
export GEMINI_API_KEY="your_api_key_here"
export REDDIT_CLIENT_ID="your_reddit_client_id"
export REDDIT_CLIENT_SECRET="your_reddit_client_secret"`;

export default function CliPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>

        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-accent" aria-hidden="true" />
          <p className="font-mono text-xs uppercase tracking-widest text-accent">CLI</p>
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-ink">Readdit CLI</h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
          Run Reddit research from the terminal. Get full reports, find complaints, or compare
          products — all from the command line.
        </p>

        {/* Install */}
        <section className="mt-10">
          <h2 className="mb-4 text-base font-semibold text-ink">Install</h2>
          <div className="bg-[#111110] text-[#f3f3ee]">
            <pre className="overflow-x-auto p-5 font-mono text-sm leading-6">npm install -g readdit-cli</pre>
          </div>
        </section>

        {/* Setup */}
        <section className="mt-8">
          <h2 className="mb-1 text-base font-semibold text-ink">Setup</h2>
          <p className="mb-4 text-sm text-muted">
            Get a free{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Gemini API key from Google AI Studio
            </a>{" "}
            and a{" "}
            <a
              href="https://www.reddit.com/prefs/apps"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Reddit app
            </a>{" "}
            (Script type, free). Then set:
          </p>
          <div className="bg-[#111110] text-[#f3f3ee]">
            <pre className="overflow-x-auto p-5 font-mono text-xs leading-6">{ENV_BLOCK}</pre>
          </div>
        </section>

        {/* Commands */}
        <section className="mt-8">
          <h2 className="mb-4 text-base font-semibold text-ink">Commands</h2>
          <div className="space-y-3">
            {CODE_BLOCKS.slice(1).map(({ label, code }) => (
              <div key={label}>
                <p className="mb-1.5 text-xs font-medium uppercase text-muted">{label}</p>
                <div className="bg-[#111110] text-[#f3f3ee]">
                  <pre className="overflow-x-auto p-4 font-mono text-sm">{code}</pre>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Output */}
        <section className="mt-8 border border-border bg-surface p-5">
          <h2 className="mb-2 text-sm font-semibold text-ink">What you get</h2>
          <ul className="space-y-1.5 text-sm leading-6 text-muted">
            <li>Cited report with real Reddit threads linked</li>
            <li>Sentiment breakdown — what people love, hate, and ask for</li>
            <li>JSON output with <code className="text-accent">--json</code> flag for scripting</li>
            <li>Works offline against cached results</li>
          </ul>
        </section>

        <div className="mt-8 flex gap-4">
          <Link
            href="/playground"
            className="inline-flex items-center gap-2 border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:border-accent hover:text-accent"
          >
            Try it in the browser instead
          </Link>
          <Link
            href="/mcp"
            className="text-sm text-muted hover:text-ink"
          >
            MCP for AI editors →
          </Link>
        </div>
      </main>
    </>
  );
}
