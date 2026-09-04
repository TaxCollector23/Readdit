import Link from "next/link";
import { Header } from "@/components/Header";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "MCP - Readdit" };

const MCP_CONFIG = `{
  "mcpServers": {
    "readdit": {
      "command": "node",
      "args": ["/path/to/packages/mcp/dist/server.js"],
      "env": {
        "GEMINI_API_KEY": "your_api_key_here",
        "REDDIT_CLIENT_ID": "your_reddit_client_id",
        "REDDIT_CLIENT_SECRET": "your_reddit_client_secret"
      }
    }
  }
}`;

const NPX_CONFIG = `{
  "mcpServers": {
    "readdit": {
      "command": "npx",
      "args": ["readdit-mcp"],
      "env": {
        "GEMINI_API_KEY": "your_api_key_here",
        "REDDIT_CLIENT_ID": "your_reddit_client_id",
        "REDDIT_CLIENT_SECRET": "your_reddit_client_secret"
      }
    }
  }
}`;

const PROMPTS = [
  "What does Reddit think about Cursor?",
  "Compare Linear vs Notion for developers",
  "What are the main complaints about Vercel pricing?",
  "Search Reddit for switching from Jira to Linear",
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
          Use Readdit directly inside Claude, Cursor, or any editor that supports the Model Context
          Protocol. Ask Reddit questions in natural language — get cited reports back as context.
        </p>

        {/* What is MCP */}
        <section className="mt-8 border border-border bg-surface p-5">
          <h2 className="mb-2 text-sm font-semibold text-ink">What is MCP?</h2>
          <p className="text-sm leading-6 text-muted">
            MCP (Model Context Protocol) lets AI editors like Claude and Cursor call external tools.
            Once Readdit is configured, your AI assistant can search Reddit and synthesize reports
            without leaving the editor.
          </p>
        </section>

        {/* Setup */}
        <section className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-ink">1. Get credentials</h2>
          <ul className="space-y-2 text-sm leading-6 text-muted">
            <li>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                Get a free Gemini API key
              </a>{" "}
              from Google AI Studio
            </li>
            <li>
              <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                Create a free Reddit app
              </a>{" "}
              — choose &quot;Script&quot; type, get client_id + client_secret
            </li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-ink">2. Add to your editor config</h2>
          <p className="mb-3 text-sm text-muted">
            In Claude Desktop: Settings → Developer → Edit Config. In Cursor: Settings → MCP.
          </p>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">Via npx (easiest)</p>
          <div className="bg-[#111110] text-[#f3f3ee]">
            <pre className="overflow-x-auto p-5 font-mono text-xs leading-6">{NPX_CONFIG}</pre>
          </div>
          <p className="mt-4 mb-2 text-xs font-semibold uppercase text-muted">Or from source</p>
          <div className="bg-[#111110] text-[#f3f3ee]">
            <pre className="overflow-x-auto p-5 font-mono text-xs leading-6">{MCP_CONFIG}</pre>
          </div>
        </section>

        {/* Example prompts */}
        <section className="mt-8">
          <h2 className="mb-4 text-base font-semibold text-ink">3. Ask anything</h2>
          <p className="mb-4 text-sm text-muted">
            Once connected, just ask your AI assistant naturally:
          </p>
          <div className="space-y-2">
            {PROMPTS.map((prompt) => (
              <div key={prompt} className="border border-border bg-surface px-4 py-3 text-sm text-ink">
                &ldquo;{prompt}&rdquo;
              </div>
            ))}
          </div>
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
