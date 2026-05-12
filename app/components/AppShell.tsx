"use client";

import { usePathname } from "next/navigation";
import MobileNav from "./MobileNav";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-neutral-950 text-white">
      <Sidebar />
      <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>
      <MobileNav />
    </div>
  );
}
