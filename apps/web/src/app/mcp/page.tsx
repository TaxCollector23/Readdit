import Link from "next/link";
import { Header } from "@/components/Header";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "MCP - Readdit" };

const REMOTE_MCP_URL = "https://readdit-sigma.vercel.app/api/mcp";

const NPX_CONFIG = `{
  "mcpServers": {
    "readdit": {
      "command": "npx",
      "args": ["readdit-mcp"],
      "env": {
        "GEMINI_API_KEY": "your_gemini_api_key_here"
      }
    }
  }
}`;

const PROMPTS = [
  "What does Reddit think about Cursor?",
  "Compare Linear vs Notion for developers",
  "What are the main complaints about Vercel pricing?",
  "Search Reddit for honest reviews of Raycast",
];

export default function McpPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>

        <p className="font-mono text-xs uppercase tracking-widest text-accent">MCP</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">Readdit MCP Server</h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
          Use Readdit directly inside Claude. Ask Reddit questions in natural language —
          get cited research back as context. No install, no API keys.
        </p>

        {/* Seamless remote URL — the main path */}
        <section className="mt-8 border border-accent/30 bg-accent/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Easiest — no setup</p>
          <h2 className="mt-2 text-base font-semibold text-ink">Add via URL in Claude.ai</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Open Claude.ai → click your name → <strong className="text-ink">Integrations</strong> → <strong className="text-ink">Add integration</strong>.
            Paste the URL below and save. That&apos;s it.
          </p>
          <div className="mt-4 flex items-center gap-3 bg-[#111110] px-4 py-3">
            <code className="flex-1 font-mono text-xs text-[#f3f3ee]">{REMOTE_MCP_URL}</code>
            <span className="text-xs text-muted">← copy this</span>
          </div>
          <p className="mt-3 text-xs text-muted">
            The server runs on Readdit&apos;s infrastructure — no local process, no API key needed.
            Rate limited to keep it free for everyone.
          </p>
        </section>

        {/* Example prompts */}
        <section className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-ink">Then just ask</h2>
          <p className="mb-4 text-sm text-muted">
            Once connected, ask Claude naturally — it will call Readdit automatically:
          </p>
          <div className="space-y-2">
            {PROMPTS.map((prompt) => (
              <div key={prompt} className="border border-border bg-surface px-4 py-3 text-sm text-ink">
                &ldquo;{prompt}&rdquo;
              </div>
            ))}
          </div>
        </section>

        {/* Local / self-hosted option */}
        <section className="mt-10 border-t border-border pt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Self-host option</p>
          <h2 className="mt-2 text-base font-semibold text-ink">Run it locally (Claude Desktop / Cursor)</h2>
          <p className="mb-4 mt-2 text-sm text-muted">
            If you want your own Gemini API key or higher limits, run the MCP server locally.
            Add this to your Claude Desktop or Cursor config:
          </p>
          <div className="bg-[#111110] text-[#f3f3ee]">
            <pre className="overflow-x-auto p-5 font-mono text-xs leading-6">{NPX_CONFIG}</pre>
          </div>
          <p className="mt-3 text-sm text-muted">
            Get a free Gemini key at{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              aistudio.google.com/apikey
            </a>.
          </p>
        </section>

        <div className="mt-8 flex gap-4">
          <Link
            href="/playground"
            className="inline-flex items-center gap-2 border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:border-accent hover:text-accent"
          >
            Try it in the browser instead
          </Link>
          <Link href="/cli" className="text-sm text-muted hover:text-ink">
            CLI instead →
          </Link>
        </div>
      </main>
    </>
  );
}
