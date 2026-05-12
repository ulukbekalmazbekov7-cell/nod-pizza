"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-neutral-950 text-white">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
