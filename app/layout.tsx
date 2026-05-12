import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "./components/AuthGuard";
import AppShell from "./components/AppShell";
import { ProfileProvider } from "./components/ProfileProvider";
import { ToastProvider } from "./components/ToastProvider";

export const metadata: Metadata = {
  title: "Нод Пицца — QC Портал",
  description: "Портал контроля качества: проверки, филиалы, сотрудники",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <AuthGuard>
          <ProfileProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </ProfileProvider>
        </AuthGuard>
      </body>
    </html>
  );
}
