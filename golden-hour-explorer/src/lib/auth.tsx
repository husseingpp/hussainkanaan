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
  /**
   * True when the signed-in user is a moderator. Resolved against the DB via the
   * `is_admin()` RPC — the exact same check the RLS policies use — so the UI can
   * never show admin controls the database would then reject.
   */
  isAdmin: boolean;
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
  const [isAdmin, setIsAdmin] = useState(false);

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

  // Resolve admin status against the DB. is_admin() is the same predicate the
  // spots UPDATE/DELETE policies use, so UI gating and RLS can never disagree.
  useEffect(() => {
    let cancelled = false;
    const userId = session?.user?.id;
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    supabase
      .rpc("is_admin")
      .then(({ data, error }) => {
        if (!cancelled) setIsAdmin(!error && data === true);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthValue>(() => {
    const user = session?.user ?? null;
    return {
      session,
      user,
      loading,
      canContribute: !!user?.email_confirmed_at,
      isAdmin,
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
  }, [session, loading, isAdmin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
