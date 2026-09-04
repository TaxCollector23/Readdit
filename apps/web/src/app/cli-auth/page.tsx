"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

function CliAuthInner() {
  const searchParams = useSearchParams();
  const port = searchParams.get("port");

  const [status, setStatus] = useState<"idle" | "signing_in" | "sending" | "done" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  const handleSignIn = useCallback(async () => {
    if (!port) {
      setErrorMsg("Missing callback port. Please re-run `readdit login`.");
      setStatus("error");
      return;
    }

    setStatus("signing_in");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const { user } = result;
      const refreshToken = user.refreshToken;
      const email = user.email ?? "";

      setStatus("sending");

      // Send credentials back to the CLI's local server
      const callbackUrl = `http://127.0.0.1:${port}/callback?refresh_token=${encodeURIComponent(refreshToken)}&email=${encodeURIComponent(email)}`;
      await fetch(callbackUrl, { mode: "no-cors" });

      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Sign-in failed. Try again.");
      setStatus("error");
    }
  }, [port]);

  useEffect(() => {
    if (port && status === "idle") {
      // Auto-kick off sign-in — no need to make the user click twice
    }
  }, [port, status]);

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 420,
        margin: "80px auto",
        padding: "0 24px",
        textAlign: "center",
        color: "#111",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 8 }}>r/</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Connect Readdit CLI</h1>

      {status === "idle" && (
        <>
          <p style={{ color: "#666", fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
            Sign in with Google to connect your terminal. No API keys — just your account.
          </p>
          <button
            onClick={handleSignIn}
            style={{
              background: "#ff4500",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "12px 28px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.616z"
                fill="#fff"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                fill="#fff"
              />
              <path
                d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
                fill="#fff"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#fff"
              />
            </svg>
            Sign in with Google
          </button>
        </>
      )}

      {status === "signing_in" && (
        <p style={{ color: "#666", fontSize: 14 }}>Waiting for Google sign-in…</p>
      )}

      {status === "sending" && (
        <p style={{ color: "#666", fontSize: 14 }}>Connecting to your terminal…</p>
      )}

      {status === "done" && (
        <>
          <div
            style={{
              fontSize: 48,
              marginBottom: 16,
              color: "#ff4500",
            }}
          >
            ✓
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>You&apos;re connected</h2>
          <p style={{ color: "#666", fontSize: 14 }}>
            Return to your terminal. This tab will close automatically.
          </p>
          <script
            dangerouslySetInnerHTML={{ __html: "setTimeout(()=>window.close(),1500)" }}
          />
        </>
      )}

      {status === "error" && (
        <>
          <p style={{ color: "#c00", fontSize: 14, marginBottom: 20 }}>{errorMsg}</p>
          <button
            onClick={() => setStatus("idle")}
            style={{
              background: "transparent",
              color: "#ff4500",
              border: "1px solid #ff4500",
              borderRadius: 4,
              padding: "10px 24px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </>
      )}

      <p style={{ marginTop: 40, fontSize: 12, color: "#999" }}>
        This page is only used by the Readdit CLI to securely sign you in.
      </p>
    </div>
  );
}

export default function CliAuthPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            maxWidth: 420,
            margin: "80px auto",
            textAlign: "center",
            color: "#666",
          }}
        >
          Loading…
        </div>
      }
    >
      <CliAuthInner />
    </Suspense>
  );
}
