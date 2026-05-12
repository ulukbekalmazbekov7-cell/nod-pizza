import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "./components/AuthGuard";
import AppShell from "./components/AppShell";

export const metadata: Metadata = {
  title: "Нод Пицца — QC Портал",
  description: "Портал контроля качества: проверки, филиалы, сотрудники",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <AuthGuard>
          <AppShell>{children}</AppShell>
        </AuthGuard>
      </body>
    </html>
  );
}
