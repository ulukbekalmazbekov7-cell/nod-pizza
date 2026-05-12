"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Главная" },
  { href: "/shifts", label: "График смен" },
  { href: "/inspections", label: "Проверки" },
  { href: "/branches", label: "Филиалы" },
  { href: "/employees", label: "Сотрудники" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

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
        {links.map(({ href, label }) => {
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
    </aside>
  );
}
