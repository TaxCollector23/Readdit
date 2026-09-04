import { homedir } from "os";
import { join } from "path";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";

// Public Firebase web API key (safe to embed in client code)
const FIREBASE_API_KEY = "AIzaSyCPWPaJ_rWMpSlxCSrWRJKnhHvwvnJMY4g";
const TOKEN_URL = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;
const AUTH_PAGE = "https://readdit-sigma.vercel.app/cli-auth";
const CALLBACK_PORT = 47473;

export interface Credentials {
  refreshToken: string;
  email?: string;
}

function credPath(): string {
  return join(homedir(), ".config", "readdit", "credentials.json");
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  const dir = join(homedir(), ".config", "readdit");
  await mkdir(dir, { recursive: true });
  await writeFile(credPath(), JSON.stringify(creds, null, 2), { mode: 0o600 });
}

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const raw = await readFile(credPath(), "utf8");
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  try {
    await unlink(credPath());
  } catch {
    // already gone
  }
}

/** Exchange a Firebase refresh token for a fresh ID token (1-hour expiry). */
export async function getIdToken(
  creds: Credentials
): Promise<{ idToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(creds.refreshToken)}`,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id_token: string; refresh_token: string };
    return { idToken: data.id_token, refreshToken: data.refresh_token };
  } catch {
    return null;
  }
}

/** Opens the browser to the Readdit auth page and waits for the OAuth callback. */
export async function runLoginFlow(): Promise<Credentials> {
  const { createServer } = await import("http");
  const { exec } = await import("child_process");

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url) return;
      try {
        const url = new URL(req.url, `http://127.0.0.1:${CALLBACK_PORT}`);
        const refreshToken = url.searchParams.get("refresh_token");
        const email = url.searchParams.get("email") ?? undefined;

        if (url.pathname !== "/callback" || !refreshToken) {
          res.writeHead(400);
          res.end("Missing token");
          return;
        }

        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(
          `<!DOCTYPE html><html><head><title>Readdit CLI</title></head>` +
            `<body style="font-family:sans-serif;max-width:440px;margin:80px auto;text-align:center;color:#111">` +
            `<p style="font-size:32px">r/</p><h2>You're logged in</h2>` +
            `<p style="color:#666">You can close this tab and return to your terminal.</p>` +
            `<script>setTimeout(()=>window.close(),1200)</script>` +
            `</body></html>`
        );

        server.close();
        resolve({ refreshToken, email });
      } catch (err) {
        res.writeHead(500);
        res.end("Internal error");
        server.close();
        reject(err);
      }
    });

    server.on("error", reject);

    server.listen(CALLBACK_PORT, "127.0.0.1", () => {
      const url = `${AUTH_PAGE}?port=${CALLBACK_PORT}`;
      const cmd =
        process.platform === "darwin"
          ? `open "${url}"`
          : process.platform === "win32"
            ? `start "" "${url}"`
            : `xdg-open "${url}"`;
      exec(cmd, (err) => {
        if (err) {
          // Fallback: print the URL for the user to open manually
          process.stderr.write(`\nOpen this URL in your browser:\n${url}\n\n`);
        }
      });
    });

    // Timeout after 5 minutes
    setTimeout(
      () => {
        server.close();
        reject(
          new Error("Login timed out. Run `readdit login` to try again.")
        );
      },
      5 * 60 * 1000
    ).unref();
  });
}
