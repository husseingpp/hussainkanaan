import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthResult = { error: string | null };

type AuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /**
   * True only once the signed-in user has a confirmed email. The database RLS
   * gates every write behind `is_email_verified()`, so guests and unconfirmed
   * accounts get a read-only experience.
   */
  canContribute: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(() => {
    const user = session?.user ?? null;
    return {
      session,
      user,
      loading,
      canContribute: !!user?.email_confirmed_at,
      async signInWithEmail(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      async signUpWithEmail(email, password, displayName) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: displayName } },
        });
        return { error: error?.message ?? null };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    };
  }, [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
