"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/app/components/ProfileProvider";
import { canAccessAudit, ROLE_LABELS } from "@/lib/auth/roles";
import { supabase } from "@/lib/supabase";

const links = [
  { href: "/", label: "Главная" },
  { href: "/shifts", label: "График смен" },
  { href: "/inspections", label: "Проверки" },
  { href: "/tasks", label: "Задачи" },
  { href: "/branches", label: "Филиалы" },
  { href: "/employees", label: "Сотрудники" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();

  const navLinks = canAccessAudit(profile)
    ? [...links, { href: "/audit", label: "Журнал аудита" } as const]
    : links;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-neutral-900/60 p-5 md:flex">
      <div className="mb-8">
        <Link href="/" className="group block">
          <h1 className="cursor-pointer text-2xl font-bold transition group-hover:text-blue-400">
            Нод Пицца
          </h1>
          <p className="mt-1 text-sm text-white/60">QC Портал</p>
        </Link>
      </div>

      <nav className="space-y-2 text-sm">
        {navLinks.map(({ href, label }) => {
          const active =
            href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={`block rounded-xl px-4 py-3 ${active ? "bg-white/10" : "hover:bg-white/5"}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t border-white/10 pt-5 text-sm">
        {profile ? (
          <div className="rounded-xl bg-white/5 px-4 py-3">
            <p className="font-medium">{profile.full_name || "Пользователь"}</p>
            <p className="mt-1 text-white/60">{ROLE_LABELS[profile.role]}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="w-full rounded-xl border border-white/10 px-4 py-2 text-left text-white/80 hover:bg-white/5"
        >
          Выйти
        </button>
      </div>
    </aside>
  );
}
