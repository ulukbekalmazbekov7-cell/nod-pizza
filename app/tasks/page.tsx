"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/app/components/EmptyState";
import LoadingState from "@/app/components/LoadingState";
import { useProfile } from "@/app/components/ProfileProvider";
import { useToast } from "@/app/components/ToastProvider";
import { canAccessTasksDashboard } from "@/lib/auth/roles";
import {
  complaintLevelLabel,
  complaintRequestTypeLabel,
  complaintStatusLabel,
  formatComplaintDate,
  jiraSyncBadgeClass,
  jiraSyncStatusLabel,
} from "@/lib/complaints";
import { fetchComplaints } from "@/lib/complaintsData";
import { getErrorMessage } from "@/lib/errors";
import { fetchBranches } from "@/lib/inspectionData";
import { supabase } from "@/lib/supabase";
import type { Branch, Complaint } from "@/lib/types";

function complaintBranchName(complaint: Complaint, branchList: Branch[]) {
  const branch = branchList.find((item) => item.id === complaint.branch_id);
  return branch?.name ?? `Филиал #${complaint.branch_id}`;
}

export default function TasksPage() {
  const { profile } = useProfile();
  const { pushToast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const canView = canAccessTasksDashboard(profile);

  const loadData = async () => {
    setLoading(true);
    try {
      const [branchesData, complaintsData] = await Promise.all([
        fetchBranches(supabase),
        fetchComplaints(supabase),
      ]);
      setBranches(branchesData);
      setComplaints(complaintsData);
    } catch (error) {
      pushToast(getErrorMessage(error, "Не удалось загрузить задачи"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadData();
  }, [canView, profile?.id]);

  const filteredComplaints = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("ru");
    return complaints.filter((complaint) => {
      if (!query) return true;
      const haystack = [
        complaint.complaint_text,
        complaint.customer_phone,
        complaint.invoice_number,
        complaint.jira_issue_key,
        complaintBranchName(complaint, branches),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ru");
      return haystack.includes(query);
    });
  }, [branches, complaints, searchQuery]);

  const syncComplaintWithJira = async (complaintId: string) => {
    const response = await fetch("/api/jira/create-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complaintId }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; jira_sync_status?: Complaint["jira_sync_status"] }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error || "Не удалось синхронизировать с Jira");
    }

    await loadData();
    if (payload?.jira_sync_status === "success") {
      pushToast("Jira обновлена", "success");
    } else {
      pushToast("Синхронизация Jira завершилась с ошибкой", "error");
    }
  };

  if (!canView) {
    return (
      <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-6">
        <EmptyState
          title="Раздел для QC и администраторов"
          description="Операторы оформляют заявки во вкладке «Заявки». Проверки QC ведутся в разделе «Проверки»."
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/applications" className="rounded-xl bg-blue-600 px-4 py-2 text-sm">
            Перейти к заявкам
          </Link>
          <Link href="/inspections" className="rounded-xl border border-white/10 px-4 py-2 text-sm">
            Перейти к проверкам
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-6">
        <LoadingState label="Загрузка задач Jira…" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Задачи</h1>
        <p className="mt-1 text-white/60">
          Jira/QC dashboard: статусы синхронизации заявок с Jira. Операторы оформляют заявки в разделе
          «Заявки», рассмотрение — в «Проверках».
        </p>
      </div>

      <input
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Поиск по заявке, клиенту, Jira key"
        className="mb-6 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
      />

      {filteredComplaints.length === 0 ? (
        <EmptyState
          title="Задач не найдено"
          description="Заявки появятся после оформления во вкладке «Заявки»."
        />
      ) : (
        <div className="grid gap-4">
          {filteredComplaints.map((complaint) => (
            <article
              key={complaint.id}
              className="rounded-2xl border border-white/10 bg-neutral-950/50 p-4 md:p-5"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{complaintBranchName(complaint, branches)}</h2>
                  <p className="mt-2 text-sm text-white/80">{complaint.complaint_text}</p>
                  <p className="mt-2 text-xs text-white/50">
                    {formatComplaintDate(complaint.created_at)} · {complaintRequestTypeLabel(complaint.request_type)} ·{" "}
                    {complaintStatusLabel(complaint.status)} · приоритет {complaintLevelLabel(complaint.priority)}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${jiraSyncBadgeClass(complaint.jira_sync_status)}`}
                >
                  {jiraSyncStatusLabel(complaint.jira_sync_status)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                {complaint.jira_issue_url ? (
                  <Link
                    href={complaint.jira_issue_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-300 hover:text-blue-200"
                  >
                    Jira: {complaint.jira_issue_key}
                  </Link>
                ) : (
                  <span className="text-white/50">Jira: не создана</span>
                )}

                {complaint.inspection_id ? (
                  <Link href="/inspections" className="text-emerald-300 hover:text-emerald-200">
                    Проверка #{complaint.inspection_id}
                  </Link>
                ) : null}

                {complaint.jira_sync_status === "failed" ? (
                  <button
                    type="button"
                    onClick={() => void syncComplaintWithJira(complaint.id).catch((error) => {
                      pushToast(getErrorMessage(error, "Повторная синхронизация не удалась"), "error");
                    })}
                    className="rounded-lg border border-white/10 px-3 py-1 text-xs hover:bg-white/5"
                  >
                    Повторить синхронизацию
                  </button>
                ) : null}
              </div>

              {complaint.jira_sync_error ? (
                <p className="mt-3 rounded-xl border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-200">
                  {complaint.jira_sync_error}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
