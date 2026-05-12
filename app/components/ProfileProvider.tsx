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
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { mapProfileRow, sessionUserDisplayName } from "@/lib/profileData";
import type { Profile } from "@/lib/types";

type ProfileContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

function mapProfile(row: Record<string, unknown>, sessionUser?: User | null): Profile {
  const profile = mapProfileRow(row);
  return {
    ...profile,
    full_name: profile.full_name ?? sessionUserDisplayName(sessionUser),
  };
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string, sessionUser?: User | null) => {
    const extended = await supabase
      .from("profiles")
      .select("id, role, full_name, branch_id, branch_ids, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (
      extended.error &&
      extended.error.code !== "42703" &&
      extended.error.code !== "PGRST204"
    ) {
      setError(extended.error.message);
      setProfile(null);
      return;
    }

    let row = extended.data as Record<string, unknown> | null;

    if (!row && (extended.error?.code === "42703" || extended.error?.code === "PGRST204")) {
      const base = await supabase
        .from("profiles")
        .select("id, role, branch_id")
        .eq("id", userId)
        .maybeSingle();

      if (base.error) {
        setError(base.error.message);
        setProfile(null);
        return;
      }

      row = base.data as Record<string, unknown> | null;
    }

    if (!row) {
      setProfile({
        id: userId,
        role: "operator",
        full_name: sessionUserDisplayName(sessionUser),
        branch_id: null,
        branch_ids: [],
      });
      return;
    }

    setProfile(mapProfile(row, sessionUser));
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

    await loadProfile(currentSession.user.id, currentSession.user);
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

      await loadProfile(currentSession.user.id, currentSession.user);
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
      void loadProfile(nextSession.user.id, nextSession.user).finally(() => {
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
