"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ApplicationCard from "@/app/components/applications/ApplicationCard";
import EmptyState from "@/app/components/EmptyState";
import LoadingState from "@/app/components/LoadingState";
import { useProfile } from "@/app/components/ProfileProvider";
import { useToast } from "@/app/components/ToastProvider";
import {
  canCreateApplication,
  canCreateManualComplaintInspection,
  canReviewComplaintApplication,
  canViewAllApplications,
  filterAccessibleBranches,
  selectableBranchesForApplication,
} from "@/lib/auth/roles";
import { writeAuditLog } from "@/lib/audit";
import {
  COMPLAINT_LEVEL_OPTIONS,
  COMPLAINT_REQUEST_TYPE_OPTIONS,
  COMPLAINT_STATUS_OPTIONS,
  complaintLevelLabel,
  complaintStatusLabel,
} from "@/lib/complaints";
import { createLinkedInspection } from "@/lib/complaintInspections";
import { buildInspectionPageHref } from "@/lib/inspectionPaths";
import { resolveLinkedInspection } from "@/lib/complaintWorkflow";
import { createComplaint, fetchComplaints } from "@/lib/complaintsData";
import { getErrorMessage } from "@/lib/errors";
import { fetchBranches } from "@/lib/inspectionData";
import { supabase } from "@/lib/supabase";
import type { Branch, Complaint, ComplaintLevel, ComplaintRequestType, ComplaintStatus } from "@/lib/types";

type ComplaintForm = {
  branch_id: number;
  customer_phone: string;
  invoice_number: string;
  request_type: ComplaintRequestType;
  table_number: string;
  floor: string;
  complaint_text: string;
  has_media: boolean;
  operator_comment: string;
  priority: ComplaintLevel;
};

const initialForm: ComplaintForm = {
  branch_id: 0,
  customer_phone: "",
  invoice_number: "",
  request_type: "delivery",
  table_number: "",
  floor: "",
  complaint_text: "",
  has_media: false,
  operator_comment: "",
  priority: "medium",
};

function complaintBranchName(complaint: Complaint, branchList: Branch[]) {
  if (complaint.branches?.name) return complaint.branches.name;
  const branch = branchList.find((item) => item.id === complaint.branch_id);
  return branch?.name ?? `Филиал #${complaint.branch_id}`;
}

function withBranchNames(items: Complaint[], branchList: Branch[]) {
  return items.map((item) => ({
    ...item,
    branches: { name: complaintBranchName(item, branchList) },
  }));
}

function complaintSearchHaystack(complaint: Complaint, branches: Branch[]) {
  return [
    complaint.complaint_text,
    complaint.customer_phone,
    complaint.invoice_number,
    complaint.operator_comment,
    complaint.jira_issue_key,
    complaintBranchName(complaint, branches),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ru");
}

export default function ApplicationsPage() {
  const router = useRouter();
  const { profile, session, loading: profileLoading } = useProfile();
  const { pushToast } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<ComplaintForm>(initialForm);

  const [filterBranchId, setFilterBranchId] = useState<number | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ComplaintStatus | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<ComplaintLevel | "all">("all");
  const [filterPriority, setFilterPriority] = useState<ComplaintLevel | "all">("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [creatingInspectionForId, setCreatingInspectionForId] = useState<string | null>(null);
  const [reviewingComplaintId, setReviewingComplaintId] = useState<string | null>(null);

  const selectableBranches = useMemo(
    () => selectableBranchesForApplication(profile, branches),
    [branches, profile]
  );

  const canCreate = canCreateApplication(profile);
  const seesAllApplications = canViewAllApplications(profile);
  const canReview = canReviewComplaintApplication(profile);
  const canManualCreate = canCreateManualComplaintInspection(profile);
  const isOperator = profile?.role === "operator";

  const loadData = async () => {
    setLoading(true);

    try {
      const [branchesData, complaintsData] = await Promise.all([
        fetchBranches(supabase).catch((error) => {
          const message = error instanceof Error ? error.message : "Не удалось загрузить филиалы";
          pushToast(message, "error");
          return [] as Branch[];
        }),
        fetchComplaints(supabase).catch((error) => {
          const message = getErrorMessage(error, "Не удалось загрузить задачи");
          pushToast(message, "error");
          return [] as Complaint[];
        }),
      ]);

      setBranches(branchesData);
      setComplaints(withBranchNames(complaintsData, branchesData));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [profile?.id]);

  useEffect(() => {
    if (!showForm || form.branch_id) return;
    if (selectableBranches.length === 1 && selectableBranches[0].id != null) {
      setForm((prev) => ({ ...prev, branch_id: selectableBranches[0].id as number }));
    }
  }, [form.branch_id, selectableBranches, showForm]);

  const filteredComplaints = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("ru");

    return complaints.filter((complaint) => {
      if (filterBranchId !== "all" && complaint.branch_id !== filterBranchId) return false;
      if (filterStatus !== "all" && complaint.status !== filterStatus) return false;
      if (filterSeverity !== "all" && complaint.severity !== filterSeverity) return false;
      if (filterPriority !== "all" && complaint.priority !== filterPriority) return false;

      const createdAt = complaint.created_at;
      if (filterDateFrom && createdAt && createdAt < `${filterDateFrom}T00:00:00`) return false;
      if (filterDateTo && createdAt && createdAt > `${filterDateTo}T23:59:59`) return false;
      if (query && !complaintSearchHaystack(complaint, branches).includes(query)) return false;

      return true;
    });
  }, [
    complaints,
    filterBranchId,
    filterDateFrom,
    filterDateTo,
    filterPriority,
    filterSeverity,
    filterStatus,
    searchQuery,
    branches,
  ]);

  const syncComplaintWithJira = async (complaintId: string) => {
    const response = await fetch("/api/jira/create-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complaintId }),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          complaint?: Complaint;
          jira_sync_status?: Complaint["jira_sync_status"];
          jira_sync_error?: string | null;
          error?: string;
        }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error || "Не удалось синхронизировать задачу с Jira");
    }

    if (payload?.complaint) {
      setComplaints((prev) =>
        withBranchNames(
          prev.map((item) => (item.id === payload.complaint?.id ? payload.complaint : item)),
          branches
        )
      );
    }

    if (payload?.jira_sync_status === "success") {
      pushToast("Задача создана в Jira", "success");
      return payload.complaint ?? null;
    }

    pushToast(payload?.jira_sync_error || "Jira недоступна, задача сохранена в NOD", "error");
    return payload?.complaint ?? null;
  };

  const handleCreateManualInspection = async (complaint: Complaint) => {
    setCreatingInspectionForId(complaint.id);
    try {
      const inspectionId = await createLinkedInspection(supabase, complaint, session?.user?.id);
      await loadData();
      pushToast(`Создана проверка #${inspectionId}`, "success");
    } catch (error) {
      pushToast(getErrorMessage(error, "Не удалось создать проверку"), "error");
    } finally {
      setCreatingInspectionForId(null);
    }
  };

  const handleReviewApplication = async (complaint: Complaint) => {
    setReviewingComplaintId(complaint.id);
    try {
      let inspectionId =
        resolveLinkedInspection(complaint)?.id ?? complaint.inspection_id ?? null;

      if (!inspectionId) {
        inspectionId = await createLinkedInspection(supabase, complaint, session?.user?.id ?? null);
        await loadData();
      }

      router.push(buildInspectionPageHref(inspectionId));
    } catch (error) {
      pushToast(getErrorMessage(error, "Не удалось открыть проверку"), "error");
    } finally {
      setReviewingComplaintId(null);
    }
  };

  const handleCreate = async () => {
    setSaveError(null);

    if (!form.branch_id) {
      setSaveError("Выбери филиал");
      return;
    }

    if (!form.complaint_text.trim()) {
      setSaveError("Опиши суть жалобы");
      return;
    }

    if (!form.customer_phone.trim() && !form.invoice_number.trim()) {
      setSaveError("Укажи номер клиента или номер накладной");
      return;
    }

    setSaving(true);

    try {
      const created = await createComplaint(supabase, {
        branch_id: form.branch_id,
        request_type: form.request_type,
        priority: form.priority,
        complaint_text: form.complaint_text,
        customer_phone: form.customer_phone,
        invoice_number: form.invoice_number,
        table_number: form.table_number,
        floor: form.floor,
        has_media: form.has_media,
        operator_comment: form.operator_comment,
        created_by: session?.user.id ?? null,
      });

      const createdWithBranch = withBranchNames([created], branches)[0];
      setComplaints((prev) => [createdWithBranch, ...prev]);
      await writeAuditLog(supabase, "complaint_created", "complaint", created.id, {
        branch_id: created.branch_id,
        priority: created.priority,
      });

      try {
        const inspectionId = await createLinkedInspection(supabase, created, session?.user.id ?? null);
        setComplaints((prev) =>
          prev.map((item) =>
            item.id === created.id ? { ...item, inspection_id: inspectionId, status: "assigned" } : item
          )
        );
      } catch (inspectionError) {
        const message = getErrorMessage(inspectionError, "Не удалось создать проверку QC");
        pushToast(message, "error");
      }

      try {
        await syncComplaintWithJira(created.id);
      } catch (syncError) {
        const message = getErrorMessage(syncError, "Jira недоступна, заявка сохранена в NOD");
        pushToast(message, "error");
        await loadData();
      }

      setForm(initialForm);
      setShowForm(false);
    } catch (error) {
      const message = getErrorMessage(error, "Не удалось создать заявку");
      setSaveError(message);
      pushToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-6">
        <LoadingState label="Загрузка заявок…" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Заявки</h1>
          <p className="mt-1 text-white/60">
            {seesAllApplications
              ? "Все заявки операторов, Jira и связанные проверки QC"
              : "Ваши заявки, Jira и связанные проверки QC"}
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => {
              setSaveError(null);
              setShowForm((prev) => !prev);
            }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium"
          >
            {showForm ? "Скрыть форму" : "Создать заявку"}
          </button>
        ) : !profileLoading ? (
          <p className="max-w-md text-sm text-amber-200/90">
            Создание доступно ролям operator, manager и admin. В Supabase → profiles укажите role =
            operator для этой учётной записи.
          </p>
        ) : null}
      </div>

      <section className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-neutral-950/50 p-4 md:grid-cols-2 xl:grid-cols-4">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Поиск по тексту, номеру, Jira key"
          className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm xl:col-span-2"
        />

        <select
          value={filterBranchId}
          onChange={(event) =>
            setFilterBranchId(event.target.value === "all" ? "all" : Number(event.target.value))
          }
          className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
        >
          <option value="all">Все филиалы</option>
          {filterAccessibleBranches(profile, branches).map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value as ComplaintStatus | "all")}
          className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
        >
          <option value="all">Все статусы</option>
          {COMPLAINT_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {complaintStatusLabel(status)}
            </option>
          ))}
        </select>

        <select
          value={filterSeverity}
          onChange={(event) => setFilterSeverity(event.target.value as ComplaintLevel | "all")}
          className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
        >
          <option value="all">Любая severity</option>
          {COMPLAINT_LEVEL_OPTIONS.map((level) => (
            <option key={level} value={level}>
              {complaintLevelLabel(level)}
            </option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(event) => setFilterPriority(event.target.value as ComplaintLevel | "all")}
          className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
        >
          <option value="all">Любой приоритет</option>
          {COMPLAINT_LEVEL_OPTIONS.map((level) => (
            <option key={level} value={level}>
              {complaintLevelLabel(level)}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={filterDateFrom}
          onChange={(event) => setFilterDateFrom(event.target.value)}
          className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
        />

        <input
          type="date"
          value={filterDateTo}
          onChange={(event) => setFilterDateTo(event.target.value)}
          className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
        />
      </section>

      {showForm && canCreate ? (
        <section className="mb-6 space-y-4 rounded-2xl border border-white/10 bg-neutral-950/50 p-4 md:p-5">
          <h2 className="text-xl font-semibold">Новая заявка</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={form.branch_id || ""}
              onChange={(event) => setForm({ ...form, branch_id: Number(event.target.value) })}
              className="rounded-xl bg-neutral-800 px-3 py-2"
            >
              <option value="">Филиал</option>
              {selectableBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>

            <select
              value={form.request_type}
              onChange={(event) =>
                setForm({ ...form, request_type: event.target.value as ComplaintRequestType })
              }
              className="rounded-xl bg-neutral-800 px-3 py-2"
            >
              {COMPLAINT_REQUEST_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              placeholder="Номер клиента"
              value={form.customer_phone}
              onChange={(event) => setForm({ ...form, customer_phone: event.target.value })}
              className="rounded-xl bg-neutral-800 px-3 py-2"
            />

            <input
              placeholder="Номер накладной"
              value={form.invoice_number}
              onChange={(event) => setForm({ ...form, invoice_number: event.target.value })}
              className="rounded-xl bg-neutral-800 px-3 py-2"
            />

            {form.request_type === "hall" ? (
              <>
                <input
                  placeholder="Номер столика"
                  value={form.table_number}
                  onChange={(event) => setForm({ ...form, table_number: event.target.value })}
                  className="rounded-xl bg-neutral-800 px-3 py-2"
                />
                <input
                  placeholder="Этаж"
                  value={form.floor}
                  onChange={(event) => setForm({ ...form, floor: event.target.value })}
                  className="rounded-xl bg-neutral-800 px-3 py-2"
                />
              </>
            ) : null}

            <select
              value={form.priority}
              onChange={(event) =>
                setForm({ ...form, priority: event.target.value as ComplaintLevel })
              }
              className="rounded-xl bg-neutral-800 px-3 py-2"
            >
              {COMPLAINT_LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  Приоритет: {complaintLevelLabel(level)}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 rounded-xl bg-neutral-800 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.has_media}
                onChange={(event) => setForm({ ...form, has_media: event.target.checked })}
              />
              Есть фото или видео
            </label>

            <textarea
              placeholder="Суть жалобы"
              value={form.complaint_text}
              onChange={(event) => setForm({ ...form, complaint_text: event.target.value })}
              className="min-h-28 rounded-xl bg-neutral-800 px-3 py-2 md:col-span-2"
            />

            <textarea
              placeholder="Комментарий оператора"
              value={form.operator_comment}
              onChange={(event) => setForm({ ...form, operator_comment: event.target.value })}
              className="min-h-24 rounded-xl bg-neutral-800 px-3 py-2 md:col-span-2"
            />
          </div>

          {saveError ? <p className="text-sm text-red-300">{saveError}</p> : null}

          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-4 py-2 disabled:opacity-50"
          >
            {saving ? "Сохранение…" : "Сохранить заявку"}
          </button>
        </section>
      ) : null}

      {filteredComplaints.length === 0 ? (
        <EmptyState
          title="Заявок не найдено"
          description="Измени фильтры или создай новую заявку."
        />
      ) : (
        <div className="grid gap-4">
          {filteredComplaints.map((complaint) => (
            <ApplicationCard
              key={complaint.id}
              complaint={complaint}
              branchName={complaintBranchName(complaint, branches)}
              isOperator={isOperator}
              canReview={canReview}
              canManualCreate={canManualCreate}
              reviewing={reviewingComplaintId === complaint.id}
              creatingInspection={creatingInspectionForId === complaint.id}
              onSyncJira={(complaintId) => {
                void syncComplaintWithJira(complaintId).catch((error) => {
                  const message =
                    error instanceof Error ? error.message : "Повторная синхронизация не удалась";
                  pushToast(message, "error");
                });
              }}
              onCreateManualInspection={(item) => {
                void handleCreateManualInspection(item);
              }}
              onReview={(item) => {
                void handleReviewApplication(item);
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
