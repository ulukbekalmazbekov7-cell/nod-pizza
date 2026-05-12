"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useProfile } from "@/app/components/ProfileProvider";
import type { UserRole } from "@/lib/types";

type RoleGuardProps = {
  allow: UserRole[] | "authenticated";
  children: React.ReactNode;
  fallbackPath?: string;
};

export default function RoleGuard({
  allow,
  children,
  fallbackPath = "/",
}: RoleGuardProps) {
  const router = useRouter();
  const { profile, loading } = useProfile();

  useEffect(() => {
    if (loading) return;
    if (allow === "authenticated") return;
    if (!profile || !allow.includes(profile.role)) {
      router.replace(fallbackPath);
    }
  }, [allow, fallbackPath, loading, profile, router]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white/70">
        Проверка доступа…
      </div>
    );
  }

  if (allow !== "authenticated" && (!profile || !allow.includes(profile.role))) {
    return null;
  }

  return <>{children}</>;
}
