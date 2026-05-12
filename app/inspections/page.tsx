"use client";

import { useEffect, useMemo, useState } from "react";
import InspectionCriteriaForm, {
  type CriterionFormValue,
} from "@/app/components/inspections/InspectionCriteriaForm";
import EmptyState from "@/app/components/EmptyState";
import LoadingState from "@/app/components/LoadingState";
import { useConfirmDialog } from "@/app/components/ConfirmDialog";
import { useProfile } from "@/app/components/ProfileProvider";
import { useToast } from "@/app/components/ToastProvider";
import { filterAccessibleBranches } from "@/lib/auth/roles";
import { writeAuditLog } from "@/lib/audit";
import { flattenCriteria, fetchInspectionCatalog } from "@/lib/inspectionCriteria";
import {
  fetchBranches,
  fetchInspectionPhotos,
  fetchInspectionResults,
  fetchInspectionsList,
} from "@/lib/inspectionData";
import {
  deleteInspectionPhoto,
  getInspectionPhotoUrl,
  uploadInspectionPhoto,
} from "@/lib/inspectionPhotos";
import {
  BASE_INSPECTION_SCORE,
  calculateInspectionScore,
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
  Inspection,
  InspectionCategory,
  InspectionPhoto,
  InspectionResult,
  InspectionStatus,
} from "@/lib/types";

type InspectionRow = Inspection & {
  branches?: { name: string } | null;
};

type InspectionForm = {
  branch_id: number;
  inspector: string;
  inspected_at: string;
  comment: string;
  status: InspectionStatus;
};

const statusOptions: InspectionStatus[] = ["draft", "in_progress", "completed", "needs_review"];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function buildDefaultCriterionValues(categories: InspectionCategory[]) {
  const values: Record<string, CriterionFormValue> = {};
  for (const criterion of flattenCriteria(categories)) {
    values[criterion.id] = { answer: "no", comment: "" };
  }
  return values;
}

export default function InspectionsPage() {
  const { profile, session } = useProfile();
  const { pushToast } = useToast();
  const { confirm, dialog } = useConfirmDialog();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<InspectionCategory[]>([]);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [resultsByInspection, setResultsByInspection] = useState<Record<number, InspectionResult[]>>(
    {}
  );
  const [photosByInspection, setPhotosByInspection] = useState<Record<number, InspectionPhoto[]>>(
    {}
  );
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filterBranchId, setFilterBranchId] = useState<number | "all">("all");
  const [filterStatus, setFilterStatus] = useState<InspectionStatus | "all">("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [form, setForm] = useState<InspectionForm>({
    branch_id: 0,
    inspector: "",
    inspected_at: todayInputValue(),
    comment: "",
    status: "completed",
  });
  const [criterionValues, setCriterionValues] = useState<Record<string, CriterionFormValue>>({});

  const allCriteria = useMemo(() => flattenCriteria(categories), [categories]);

  const formBranches = useMemo(
    () => filterAccessibleBranches(profile, branches),
    [branches, profile]
  );

  const previewScore = useMemo(() => {
    const results = Object.entries(criterionValues).map(([criterion_id, value]) => ({
      criterion_id,
      answer: value.answer,
    }));
    return calculateInspectionScore(allCriteria, results);
  }, [allCriteria, criterionValues]);

  const fetchData = async () => {
    setLoading(true);

    try {
      const [branchesData, catalog] = await Promise.all([
        fetchBranches(supabase).catch((error) => {
          const message = error instanceof Error ? error.message : "Не удалось загрузить филиалы";
          pushToast(message, "error");
          return [] as Branch[];
        }),
        fetchInspectionCatalog(supabase).catch((error) => {
          const message = error instanceof Error ? error.message : "Не удалось загрузить критерии";
          pushToast(message, "error");
          return [] as InspectionCategory[];
        }),
      ]);

      setBranches(branchesData);
      setCategories(catalog);

      const inspectionsData = await fetchInspectionsList(supabase).catch((error) => {
        const message = error instanceof Error ? error.message : "Не удалось загрузить проверки";
        pushToast(message, "error");
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
      const message = error instanceof Error ? error.message : "Ошибка загрузки";
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    if (profile?.full_name && !form.inspector) {
      setForm((prev) => ({ ...prev, inspector: profile.full_name ?? "" }));
    }
  }, [profile?.full_name, form.inspector]);

  useEffect(() => {
    if (categories.length > 0 && Object.keys(criterionValues).length === 0) {
      setCriterionValues(buildDefaultCriterionValues(categories));
    }
  }, [categories, criterionValues]);

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

  const handleCriterionChange = (criterionId: string, value: CriterionFormValue) => {
    setCriterionValues((prev) => ({ ...prev, [criterionId]: value }));
  };

  const handleSave = async () => {
    setSaveError(null);

    if (!form.branch_id) {
      setSaveError("Выбери филиал");
      return;
    }

    const inspector = form.inspector.trim();
    if (!inspector) {
      setSaveError("Укажи проверяющего");
      return;
    }

    if (!form.inspected_at) {
      setSaveError("Укажи дату проверки");
      return;
    }

    if (allCriteria.length === 0) {
      setSaveError("Справочник критериев пуст. Выполни SQL seed в Supabase.");
      return;
    }

    const results = Object.entries(criterionValues).map(([criterion_id, value]) => ({
      criterion_id,
      answer: value.answer,
    }));
    const summary = calculateInspectionScore(allCriteria, results);

    setSaving(true);

    const { data, error } = await supabase
      .from("inspections")
      .insert([
        {
          branch_id: form.branch_id,
          inspector,
          inspected_at: `${form.inspected_at}T12:00:00`,
          score: summary.score,
          comment: form.comment.trim(),
          status: form.status,
          author_id: session?.user.id ?? null,
          minor_violations: summary.minorViolations,
          medium_violations: summary.mediumViolations,
          critical_violations: summary.criticalViolations,
          non_scoring_findings: summary.nonScoringFindings,
          total_penalties: summary.totalPenalties,
        },
      ])
      .select("id")
      .single();

    if (error) {
      setSaving(false);
      setSaveError(error.message || "Не удалось сохранить");
      pushToast("Не удалось сохранить проверку", "error");
      return;
    }

    const inspectionId = data.id as number;
    const resultRows = Object.entries(criterionValues).map(([criterion_id, value]) => ({
      inspection_id: inspectionId,
      criterion_id,
      answer: value.answer,
      comment: value.comment.trim() || null,
    }));

    const { error: resultsError } = await supabase.from("inspection_results").insert(resultRows);

    if (resultsError) {
      setSaving(false);
      setSaveError(resultsError.message);
      pushToast("Проверка создана, но результаты критериев не сохранились", "error");
      return;
    }

    if (session?.user.id) {
      for (const [criterionId, value] of Object.entries(criterionValues)) {
        if (!value.photoFile) continue;
        try {
          await uploadInspectionPhoto(
            supabase,
            inspectionId,
            value.photoFile,
            session.user.id,
            criterionId
          );
        } catch (uploadError) {
          const message =
            uploadError instanceof Error ? uploadError.message : "Ошибка загрузки фото";
          pushToast(message, "error");
        }
      }
    }

    setSaving(false);

    await writeAuditLog(supabase, "inspection_created", "inspection", inspectionId, {
      branch_id: form.branch_id,
      status: form.status,
      score: summary.score,
    });

    pushToast("Проверка сохранена", "success");
    setForm({
      branch_id: 0,
      inspector: profile?.full_name ?? "",
      inspected_at: todayInputValue(),
      comment: "",
      status: "completed",
    });
    setCriterionValues(buildDefaultCriterionValues(categories));
    setShowForm(false);
    void fetchData();
  };

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
      const message = error instanceof Error ? error.message : "Не удалось удалить фото";
      pushToast(message, "error");
    }
  };

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

        <button
          type="button"
          onClick={() => {
            setSaveError(null);
            setShowForm((prev) => !prev);
          }}
          className="rounded-xl bg-green-600 px-4 py-2 hover:bg-green-500"
        >
          + Новая проверка
        </button>
      </div>

      <div className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-4 md:grid-cols-4">
        <select
          value={filterBranchId}
          onChange={(e) =>
            setFilterBranchId(e.target.value === "all" ? "all" : Number(e.target.value))
          }
          className="rounded-xl bg-neutral-800 px-3 py-2"
        >
          <option value="all">Все филиалы</option>
          {branches.map((branch) => (
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

      {showForm ? (
        <div className="mb-6 space-y-5 rounded-2xl border border-white/10 bg-neutral-900 p-4">
          {saveError ? (
            <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-200">{saveError}</p>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={form.branch_id}
              onChange={(e) => setForm({ ...form, branch_id: Number(e.target.value) })}
              className="rounded-xl bg-neutral-800 px-3 py-2"
            >
              <option value={0}>Выбери филиал</option>
              {formBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            {formBranches.length === 0 ? (
              <p className="md:col-span-2 text-sm text-amber-200/90">
                Нет доступных филиалов. Добавьте их в разделе «Филиалы» (для admin) или назначьте
                филиал в профиле пользователя.
              </p>
            ) : null}

            <input
              type="date"
              value={form.inspected_at}
              onChange={(e) => setForm({ ...form, inspected_at: e.target.value })}
              className="rounded-xl bg-neutral-800 px-3 py-2"
            />

            <input
              placeholder="Проверяющий"
              value={form.inspector}
              onChange={(e) => setForm({ ...form, inspector: e.target.value })}
              className="rounded-xl bg-neutral-800 px-3 py-2"
            />

            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as InspectionStatus })}
              className="rounded-xl bg-neutral-800 px-3 py-2"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {inspectionStatusLabel(status)}
                </option>
              ))}
            </select>

            <textarea
              placeholder="Общий комментарий по проверке"
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              className="min-h-24 rounded-xl bg-neutral-800 px-3 py-2 md:col-span-2"
            />
          </div>

          <InspectionCriteriaForm
            categories={categories}
            values={criterionValues}
            onChange={handleCriterionChange}
          />

          <div className="rounded-2xl border border-white/10 bg-neutral-950/50 p-4">
            <p className="text-sm text-white/60">База: {BASE_INSPECTION_SCORE} баллов</p>
            <p className="mt-2 text-2xl font-bold">
              Итог: {previewScore.score} баллов · {scoreStatus(previewScore.score)}
            </p>
            <p className="mt-2 text-sm text-white/70">
              Сумма штрафов: {previewScore.totalPenalties} · Мелкие: {previewScore.minorViolations} ·
              Средние: {previewScore.mediumViolations} · Грубые: {previewScore.criticalViolations} ·
              Безоценочные: {previewScore.nonScoringFindings}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-4 py-2 disabled:opacity-50"
          >
            {saving ? "Сохранение…" : "Сохранить проверку"}
          </button>
        </div>
      ) : null}

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
