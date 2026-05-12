"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const applySession = (session: Session | null) => {
      if (cancelled) return;

      const user = session?.user;

      if (!user && pathname !== "/login") {
        setLoading(true);
        router.replace("/login");
        return;
      }

      if (user && pathname === "/login") {
        setLoading(true);
        router.replace("/");
        return;
      }

      setLoading(false);
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      applySession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-5 text-white">
        Загрузка…
      </div>
    );
  }

  return <>{children}</>;
}
