"use client";

import { useEffect, useState } from "react";
import RoleGuard from "@/app/components/RoleGuard";
import LoadingState from "@/app/components/LoadingState";
import EmptyState from "@/app/components/EmptyState";
import { supabase } from "@/lib/supabase";
import type { AuditLog } from "@/lib/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU");
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("audit_logs")
        .select("id, actor_id, action, entity_type, entity_id, details, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (fetchError) {
        setError(fetchError.message);
        setRows([]);
      } else {
        setRows((data ?? []) as AuditLog[]);
      }

      setLoading(false);
    };

    void load();
  }, []);

  return (
    <RoleGuard allow={["admin"]}>
      <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Журнал аудита</h1>
          <p className="mt-2 text-white/60">
            Действия пользователей: проверки, графики смен и удаления записей.
          </p>
        </div>

        {loading ? <LoadingState label="Загрузка журнала…" /> : null}
        {error ? <MotionAuditError>{error}</MotionAuditError> : null}

        {!loading && !error && rows.length === 0 ? (
          <EmptyState
            title="Записей пока нет"
            description="После создания проверок и сохранения графиков здесь появятся события."
          />
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-900 text-white/70">
                <tr>
                  <th className="px-4 py-3 font-medium">Дата</th>
                  <th className="px-4 py-3 font-medium">Действие</th>
                  <th className="px-4 py-3 font-medium">Сущность</th>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Пользователь</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-white/10 bg-neutral-950/60">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3">{row.action}</td>
                    <td className="px-4 py-3">{row.entity_type}</td>
                    <td className="px-4 py-3">{row.entity_id ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/70">
                      {row.actor_id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </RoleGuard>
  );
}

function MotionAuditError({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-red-500/40 bg-red-950/40 p-4 text-red-100">
      {children}
    </div>
  );
}
