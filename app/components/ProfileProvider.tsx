"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type ProfileContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    role: row.role as Profile["role"],
    full_name: (row.full_name as string | null) ?? null,
    branch_id: row.branch_id != null ? Number(row.branch_id) : null,
    branch_ids: Array.isArray(row.branch_ids)
      ? row.branch_ids.map((id) => Number(id))
      : [],
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, full_name, branch_id, branch_ids, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      setProfile(null);
      return;
    }

    if (!data) {
      setProfile({
        id: userId,
        role: "qc",
        full_name: null,
        branch_id: null,
        branch_ids: [],
      });
      return;
    }

    setProfile(mapProfile(data as Record<string, unknown>));
    setError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    setSession(currentSession);

    if (!currentSession?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    await loadProfile(currentSession.user.id);
    setLoading(false);
  }, [loadProfile]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (cancelled) return;
      setSession(currentSession);

      if (!currentSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      await loadProfile(currentSession.user.id);
      if (!cancelled) setLoading(false);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      void loadProfile(nextSession.user.id).finally(() => {
        if (!cancelled) setLoading(false);
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      error,
      refreshProfile,
    }),
    [session, profile, loading, error, refreshProfile]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return ctx;
}
