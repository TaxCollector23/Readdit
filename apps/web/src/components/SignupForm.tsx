"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

function SignupFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/playground";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      router.push(callbackUrl);
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16 sm:px-6 sm:py-20">
      <div className="border border-border bg-surface p-6">
        <h1 className="text-xl font-semibold text-ink">Create your account</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Get instant AI-powered Reddit research. Free to start.
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-3 border border-border bg-canvas text-sm font-medium text-ink hover:border-accent hover:text-accent disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18Z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17Z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18L4.5 10.52Z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3Z"/>
            </svg>
            {loading ? "Creating account…" : "Continue with Google"}
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-negative">{error}</p>}

        <p className="mt-5 text-sm text-muted">
          Already have an account?{" "}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="text-accent hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export function SignupForm() {
  return (
    <Suspense>
      <SignupFormInner />
    </Suspense>
  );
}
