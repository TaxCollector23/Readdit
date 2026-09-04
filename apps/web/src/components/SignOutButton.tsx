"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="inline-flex items-center gap-1.5 hover:text-ink"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
      Sign out
    </button>
  );
}
