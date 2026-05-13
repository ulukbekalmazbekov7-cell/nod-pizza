"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/app/components/EmptyState";
import LoadingState from "@/app/components/LoadingState";
import { useConfirmDialog } from "@/app/components/ConfirmDialog";
import { useProfile } from "@/app/components/ProfileProvider";
import { useToast } from "@/app/components/ToastProvider";
import {
  canAccessInspections,
  canPerformQcInspection,
  selectableBranchesForInspection,
} from "@/lib/auth/roles";
import { writeAuditLog } from "@/lib/audit";
import { resolveLinkedInspection } from "@/lib/complaintWorkflow";
import { fetchComplaints } from "@/lib/complaintsData";
import { getErrorMessage } from "@/lib/errors";
import { buildInspectionNewHref, buildInspectionPageHref } from "@/lib/inspectionPaths";
import {
  fetchBranches,
  fetchInspectionPhotos,
  fetchInspectionResults,
  fetchInspectionsList,
} from "@/lib/inspectionData";
import {
  deleteInspectionPhoto,
  getInspectionPhotoUrl,
} from "@/lib/inspectionPhotos";
import {
  severityBadgeClass,
  severityLabel,
} from "@/lib/inspectionScoring";
import {
  formatInspectionDate,
  inspectionBranchName,
  inspectionStatusLabel,
  scoreStatus,
} from "@/lib/inspections";
import { supabase } from "@/lib/supabase";
import type {
  Branch,
  Complaint,
  Inspection,
  InspectionPhoto,
  InspectionResult,
  InspectionStatus,
} from "@/lib/types";

type InspectionRow = Inspection & {
  branches?: { name: string } | null;
};

const statusOptions: InspectionStatus[] = ["draft", "in_progress", "completed", "needs_review"];

export default function InspectionsPage() {
  const { profile, session } = useProfile();
  const { pushToast } = useToast();
  const { confirm, dialog } = useConfirmDialog();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [resultsByInspection, setResultsByInspection] = useState<Record<number, InspectionResult[]>>(
    {}
  );
  const [photosByInspection, setPhotosByInspection] = useState<Record<number, InspectionPhoto[]>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filterBranchId, setFilterBranchId] = useState<number | "all">("all");
  const [filterStatus, setFilterStatus] = useState<InspectionStatus | "all">("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const selectableBranches = useMemo(
    () => selectableBranchesForInspection(profile, branches),
    [branches, profile]
  );

  const canRunInspection = canPerformQcInspection(profile);

  const incomingInspections = useMemo(
    () =>
      inspections.filter(
        (item) => item.complaint_id && item.status !== "completed"
      ),
    [inspections]
  );

  const pendingComplaints = useMemo(
    () =>
      complaints.filter(
        (complaint) =>
          !resolveLinkedInspection(complaint) &&
          complaint.status !== "closed"
      ),
    [complaints]
  );

  const fetchData = async () => {
    setLoading(true);

    try {
      const [branchesData, complaintsData] = await Promise.all([
        fetchBranches(supabase).catch((error) => {
          pushToast(getErrorMessage(error, "Не удалось загрузить филиалы"), "error");
          return [] as Branch[];
        }),
        fetchComplaints(supabase).catch((error) => {
          pushToast(getErrorMessage(error, "Не удалось загрузить заявки"), "error");
          return [] as Complaint[];
        }),
      ]);

      setBranches(branchesData);
      setComplaints(complaintsData);

      const inspectionsData = await fetchInspectionsList(supabase).catch((error) => {
        pushToast(getErrorMessage(error, "Не удалось загрузить проверки"), "error");
        return [];
      });

      const rows = inspectionsData as InspectionRow[];
      setInspections(rows);

      const ids = rows.map((row) => row.id).filter((id): id is number => id != null);

      if (ids.length > 0) {
        const [resultsData, photosData] = await Promise.all([
          fetchInspectionResults(supabase, ids).catch(() => []),
          fetchInspectionPhotos(supabase, ids).catch(() => []),
        ]);

        const groupedResults: Record<number, InspectionResult[]> = {};
        (resultsData ?? []).forEach((row) => {
          const item = row as unknown as InspectionResult;
          const list = groupedResults[item.inspection_id] ?? [];
          list.push(item);
          groupedResults[item.inspection_id] = list;
        });
        setResultsByInspection(groupedResults);

        const groupedPhotos: Record<number, InspectionPhoto[]> = {};
        (photosData ?? []).forEach((row) => {
          const item = row as InspectionPhoto;
          const list = groupedPhotos[item.inspection_id] ?? [];
          list.push(item);
          groupedPhotos[item.inspection_id] = list;
        });
        setPhotosByInspection(groupedPhotos);

        const urls: Record<string, string> = {};
        for (const photo of photosData ?? []) {
          const item = photo as InspectionPhoto;
          try {
            urls[item.id] = await getInspectionPhotoUrl(supabase, item.storage_path);
          } catch {
            // ignore single photo failures
          }
        }
        setPhotoUrls(urls);
      } else {
        setResultsByInspection({});
        setPhotosByInspection({});
        setPhotoUrls({});
      }
    } catch (error) {
      pushToast(getErrorMessage(error, "Ошибка загрузки"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [profile?.id, profile?.role]);

  const filteredInspections = useMemo(() => {
    return inspections.filter((item) => {
      if (filterBranchId !== "all" && item.branch_id !== filterBranchId) return false;
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      const dateSource = item.inspected_at ?? item.created_at;
      if (filterDateFrom && dateSource && dateSource < `${filterDateFrom}T00:00:00`) return false;
      if (filterDateTo && dateSource && dateSource > `${filterDateTo}T23:59:59`) return false;
      return true;
    });
  }, [filterBranchId, filterDateFrom, filterDateTo, filterStatus, inspections]);

  const handleDelete = async (item: InspectionRow) => {
    if (!item.id) return;
    const ok = await confirm({
      title: "Удалить проверку?",
      description: "Запись и связанные фото будут удалены без возможности восстановления.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;

    const { error } = await supabase.from("inspections").delete().eq("id", item.id);
    if (error) {
      pushToast(error.message, "error");
      return;
    }

    await writeAuditLog(supabase, "inspection_deleted", "inspection", item.id);
    pushToast("Проверка удалена", "success");
    void fetchData();
  };

  const handlePhotoDelete = async (photo: InspectionPhoto) => {
    const ok = await confirm({
      title: "Удалить фото?",
      description: "Файл будет удалён из хранилища.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;

    try {
      await deleteInspectionPhoto(supabase, photo.id, photo.storage_path);
      await writeAuditLog(supabase, "inspection_photo_deleted", "inspection_photo", photo.id);
      pushToast("Фото удалено", "success");
      void fetchData();
    } catch (error) {
      pushToast(getErrorMessage(error, "Не удалось удалить фото"), "error");
    }
  };

  if (!canAccessInspections(profile)) {
    return (
      <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-6">
        <EmptyState
          title="Проверки доступны QC и менеджерам"
          description="Операторы оформляют заявки во вкладке «Заявки». После создания заявки QC получает связанную проверку."
        />
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-6">
        <LoadingState label="Загрузка проверок…" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-6">
      {dialog}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Проверки</h1>
          <p className="mt-1 text-white/60">
            Оценка по фиксированным критериям контроля качества
          </p>
        </div>

        {canRunInspection ? (
          <Link
            href={buildInspectionNewHref()}
            className="rounded-xl bg-green-600 px-4 py-2 text-center hover:bg-green-500"
          >
            + Новая проверка
          </Link>
        ) : null}
      </div>

      {incomingInspections.length > 0 || pendingComplaints.length > 0 ? (
        <section className="mb-6 space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4">
          <div>
            <h2 className="text-lg font-semibold">Поступившие заявки</h2>
            <p className="mt-1 text-sm text-white/60">
              Заявки операторов, ожидающие рассмотрения QC
            </p>
          </div>
          <div className="grid gap-3">
            {incomingInspections.map((item) => (
              <article
                key={`inspection-${item.id}`}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-neutral-950/60 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {inspectionBranchName(item.branches)} · проверка #{item.id}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-white/70">{item.comment}</p>
                  <p className="mt-2 text-xs text-white/50">
                    Статус: {inspectionStatusLabel(item.status)}
                  </p>
                </div>
                {item.id ? (
                  <Link
                    href={buildInspectionPageHref(item.id)}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-center text-sm hover:bg-emerald-500"
                  >
                    Рассмотреть
                  </Link>
                ) : null}
              </article>
            ))}
            {pendingComplaints.map((complaint) => (
              <article
                key={`complaint-${complaint.id}`}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-neutral-950/60 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {complaint.branches?.name ?? `Филиал #${complaint.branch_id}`} · заявка
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-white/70">{complaint.complaint_text}</p>
                  <p className="mt-2 text-xs text-white/50">Проверка ещё не создана</p>
                </div>
                <Link
                  href={buildInspectionNewHref(complaint.id)}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-center text-sm hover:bg-emerald-500"
                >
                  Рассмотреть
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-4 md:grid-cols-4">
        <select
          value={filterBranchId}
          onChange={(e) =>
            setFilterBranchId(e.target.value === "all" ? "all" : Number(e.target.value))
          }
          className="rounded-xl bg-neutral-800 px-3 py-2"
        >
          <option value="all">Все филиалы</option>
          {selectableBranches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as InspectionStatus | "all")}
          className="rounded-xl bg-neutral-800 px-3 py-2"
        >
          <option value="all">Все статусы</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {inspectionStatusLabel(status)}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className="rounded-xl bg-neutral-800 px-3 py-2"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="rounded-xl bg-neutral-800 px-3 py-2"
        />
      </div>

      {filteredInspections.length === 0 ? (
        <EmptyState
          title="Проверок не найдено"
          description="Измени фильтры или создай новую проверку."
        />
      ) : (
        <div className="grid gap-4">
          {filteredInspections.map((item) => (
            <InspectionCard
              key={item.id}
              item={item}
              results={item.id ? resultsByInspection[item.id] ?? [] : []}
              photos={item.id ? photosByInspection[item.id] ?? [] : []}
              photoUrls={photoUrls}
              canDeletePhoto={(photo) =>
                profile?.role === "admin" || photo.uploaded_by === session?.user.id
              }
              onDelete={() => void handleDelete(item)}
              onDeletePhoto={(photo) => void handlePhotoDelete(photo)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function InspectionCard({
  item,
  results,
  photos,
  photoUrls,
  canDeletePhoto,
  onDelete,
  onDeletePhoto,
}: {
  item: InspectionRow;
  results: InspectionResult[];
  photos: InspectionPhoto[];
  photoUrls: Record<string, string>;
  canDeletePhoto: (photo: InspectionPhoto) => boolean;
  onDelete: () => void;
  onDeletePhoto: (photo: InspectionPhoto) => void;
}) {
  const scoreNum = Number(item.score);
  const violated = results.filter((result) => result.answer === "yes");

  return (
    <article className="rounded-2xl border border-white/10 bg-neutral-900 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{inspectionBranchName(item.branches)}</h2>
          <p className="text-sm text-white/60">
            {formatInspectionDate(item.inspected_at ?? item.created_at)} · {item.inspector}
          </p>
          <p className="mt-1 text-sm text-white/70">{inspectionStatusLabel(item.status)}</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-white/10 px-3 py-1 text-sm">
            {Number.isFinite(scoreNum) ? `${scoreNum}% · ${scoreStatus(scoreNum)}` : "—"}
          </span>
          <button type="button" onClick={onDelete} className="text-sm text-red-300 hover:text-red-200">
            Удалить
          </button>
        </div>
      </div>

      <InspectionSummary item={item} />

      <p className="mt-3 text-white/70">{item.comment || "Без общего комментария"}</p>

      {violated.length > 0 ? (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-white/80">Нарушенные критерии</h3>
          {violated.map((result) => (
            <div key={result.id ?? result.criterion_id} className="rounded-xl bg-white/5 p-3 text-sm">
              <p className="font-medium">
                {formatViolatedCriterionLabel(result)}
              </p>
              {result.criterion?.severity ? (
                <span
                  className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${severityBadgeClass(result.criterion.severity)}`}
                >
                  {severityLabel(result.criterion.severity)}
                </span>
              ) : null}
              {result.comment ? <p className="mt-1 text-white/70">{result.comment}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {photos.length > 0 ? (
        <PhotoGrid>
          {photos.map((photo) => (
            <div key={photo.id} className="w-28">
              {photoUrls[photo.id] ? (
                <a href={photoUrls[photo.id]} target="_blank" rel="noreferrer">
                  <img
                    src={photoUrls[photo.id]}
                    alt="Фото нарушения"
                    className="h-24 w-28 rounded-lg object-cover"
                  />
                </a>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg bg-white/5 text-xs">
                  Загрузка…
                </div>
              )}
              {canDeletePhoto(photo) ? (
                <button
                  type="button"
                  onClick={() => onDeletePhoto(photo)}
                  className="mt-1 text-xs text-red-300 hover:text-red-200"
                >
                  Удалить
                </button>
              ) : null}
            </div>
          ))}
        </PhotoGrid>
      ) : null}
    </article>
  );
}

function formatViolatedCriterionLabel(result: InspectionResult): string {
  const criterion = result.criterion;
  if (!criterion) return result.criterion_id;

  const subcategory = criterion.subcategory;
  const category = subcategory
    ? Array.isArray(subcategory)
      ? subcategory[0]?.category
      : subcategory.category
    : undefined;

  const categoryName = Array.isArray(category) ? category[0]?.name : category?.name;
  const subcategoryName = Array.isArray(subcategory) ? subcategory[0]?.name : subcategory?.name;
  return [categoryName, subcategoryName, criterion.title].filter(Boolean).join(" → ");
}

function InspectionSummary({ item }: { item: InspectionRow }) {
  return (
    <div className="mt-4 grid gap-2 text-sm text-white/75 sm:grid-cols-2 lg:grid-cols-5">
      <p>Сумма штрафов: {item.total_penalties ?? 0}</p>
      <p>Мелкие нарушения: {item.minor_violations ?? 0}</p>
      <p>Средние нарушения: {item.medium_violations ?? 0}</p>
      <p>Грубые нарушения: {item.critical_violations ?? 0}</p>
      <p>Безоценочные замечания: {item.non_scoring_findings ?? 0}</p>
    </div>
  );
}

function PhotoGrid({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 flex flex-wrap gap-3">{children}</div>;
}
