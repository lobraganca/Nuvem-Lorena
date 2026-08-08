import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSession, onAuthStateChange } from "./auth";

export function useAuth(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSession().then((session) => {
      if (active) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });
    const unsubscribe = onAuthStateChange((u) => {
      if (active) setUser(u);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { user, loading };
}
