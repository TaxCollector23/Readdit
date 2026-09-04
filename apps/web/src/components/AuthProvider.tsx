"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContext {
  user: User | null;
  loading: boolean;
  idToken: () => Promise<string | null>;
}

const Ctx = createContext<AuthContext>({ user: null, loading: true, idToken: async () => null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const idToken = async () => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch {
      return null;
    }
  };

  return <Ctx.Provider value={{ user, loading, idToken }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
