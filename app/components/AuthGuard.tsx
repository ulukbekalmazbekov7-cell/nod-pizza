"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();

      const user = data.session?.user;

      if (!user && pathname !== "/login") {
        router.push("/login");
      }

      if (user && pathname === "/login") {
        router.push("/");
      }

      setLoading(false);
    };

    checkUser();
  }, [pathname, router]);

  if (loading) {
    return (
      <div style={{ color: "white", padding: 20 }}>
        Загрузка...
      </div>
    );
  }

  return <>{children}</>;
}