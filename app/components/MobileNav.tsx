"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfile } from "@/app/components/ProfileProvider";
import { canAccessAudit } from "@/lib/auth/roles";

const links = [
  { href: "/", label: "Главная" },
  { href: "/shifts", label: "Смены" },
  { href: "/inspections", label: "Проверки" },
  { href: "/branches", label: "Филиалы" },
  { href: "/employees", label: "Сотрудники" },
] as const;

export default function MobileNav() {
  const pathname = usePathname();
  const { profile } = useProfile();

  const navLinks = canAccessAudit(profile)
    ? [...links, { href: "/audit", label: "Аудит" } as const]
    : links;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-950/95 backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        {navLinks.slice(0, 5).map(({ href, label }) => {
          const active =
            href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={`rounded-xl px-1 py-2 text-center text-[11px] leading-tight ${
                active ? "bg-white/10 text-white" : "text-white/60"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
