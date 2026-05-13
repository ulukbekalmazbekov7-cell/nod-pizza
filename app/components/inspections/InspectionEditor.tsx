"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import InspectionCriteriaForm, {
  type CriterionFormValue,
  type NewCriterionDraft,
} from "@/app/components/inspections/InspectionCriteriaForm";
import EmptyState from "@/app/components/EmptyState";
import LoadingState from "@/app/components/LoadingState";
import { useProfile } from "@/app/components/ProfileProvider";
import { useToast } from "@/app/components/ToastProvider";
import {
  canAccessInspections,
  canManageInspectionCatalog,
  canPerformQcInspection,
  selectableBranchesForInspection,
} from "@/lib/auth/roles";
import { writeAuditLog } from "@/lib/audit";
import { mapInspectionStatusToComplaintStatus } from "@/lib/complaintInspections";
import { getErrorMessage } from "@/lib/errors";
import {
  appendCriterionToCategories,
  createInspectionCriterion,
  flattenCriteria,
  fetchInspectionCatalog,
} from "@/lib/inspectionCriteria";
import {
  buildInspectorOptions,
  fetchInspectorProfiles,
} from "@/lib/peopleData";
import {
  fetchBranches,
  fetchInspectionById,
  fetchInspectionResults,
} from "@/lib/inspectionData";
import { uploadInspectionPhoto } from "@/lib/inspectionPhotos";
import {
  BASE_INSPECTION_SCORE,
  calculateInspectionScore,
} from "@/lib/inspectionScoring";
import { inspectionStatusLabel, scoreStatus } from "@/lib/inspections";
import { supabase } from "@/lib/supabase";
import type {
  Branch,
  Inspection,
  InspectionCategory,
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

type InspectionEditorProps = {
  inspectionId?: number | null;
};

export default function InspectionEditor({ inspectionId = null }: InspectionEditorProps) {
  const router = useRouter();
  const { profile, session, loading: profileLoading } = useProfile();
  const { pushToast } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<InspectionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [inspectorOptions, setInspectorOptions] = useState<string[]>([]);
  const [linkedComplaintId, setLinkedComplaintId] = useState<string | null>(null);

  const [form, setForm] = useState<InspectionForm>({
    branch_id: 0,
    inspector: "",
    inspected_at: todayInputValue(),
    comment: "",
    status: "completed",
  });
  const [criterionValues, setCriterionValues] = useState<Record<string, CriterionFormValue>>({});

  const allCriteria = useMemo(() => flattenCriteria(categories), [categories]);

  const selectableBranches = useMemo(
    () => selectableBranchesForInspection(profile, branches),
    [branches, profile]
  );

  const branchAssignmentMissing = useMemo(() => {
    if (!profile || profile.role === "admin") return false;
    const assignedBranches = selectableBranchesForInspection(profile, branches);
    return assignedBranches.length === 0 && branches.length > 0;
  }, [branches, profile]);

  const canManageCatalog = canManageInspectionCatalog(profile);
  const canRunInspection = canPerformQcInspection(profile);
  const isEditing = inspectionId != null;

  const previewScore = useMemo(() => {
    const results = Object.entries(criterionValues).map(([criterion_id, value]) => ({
      criterion_id,
      answer: value.answer,
    }));
    return calculateInspectionScore(allCriteria, results);
  }, [allCriteria, criterionValues]);

  useEffect(() => {
    let cancelled = false;

    const loadEditor = async () => {
      setLoading(true);
      setSaveError(null);

      try {
        const [branchesData, catalog, inspectorProfiles] = await Promise.all([
          fetchBranches(supabase).catch((error) => {
            pushToast(getErrorMessage(error, "Не удалось загрузить филиалы"), "error");
            return [] as Branch[];
          }),
          fetchInspectionCatalog(supabase).catch((error) => {
            pushToast(getErrorMessage(error, "Не удалось загрузить критерии"), "error");
            return [] as InspectionCategory[];
          }),
          fetchInspectorProfiles(supabase).catch((error) => {
            const message =
              getErrorMessage(error, "Не удалось загрузить проверяющих");
            const canUseCurrentProfile =
              profile && (profile.role === "admin" || profile.role === "qc");
            if (!canUseCurrentProfile) {
              pushToast(message, "error");
            }
            return [];
          }),
        ]);

        if (cancelled) return;

        setBranches(branchesData);
        setCategories(catalog);
        setInspectorOptions(
          buildInspectorOptions(inspectorProfiles, profile, session?.user ?? null)
        );

        const defaultValues = buildDefaultCriterionValues(catalog);

        if (inspectionId == null) {
          setLinkedComplaintId(null);
          setForm({
            branch_id:
              selectableBranchesForInspection(profile, branchesData).length === 1 &&
              selectableBranchesForInspection(profile, branchesData)[0].id != null
                ? (selectableBranchesForInspection(profile, branchesData)[0].id as number)
                : 0,
            inspector: profile?.full_name?.trim() ?? "",
            inspected_at: todayInputValue(),
            comment: "",
            status: "completed",
          });
          setCriterionValues(defaultValues);
          return;
        }

        const item = (await fetchInspectionById(supabase, inspectionId).catch(() => null)) as
          | InspectionRow
          | null;

        if (!item) {
          pushToast("Проверка не найдена или недоступна", "error");
          router.push("/inspections");
          return;
        }

        const results = (await fetchInspectionResults(supabase, [inspectionId]).catch(
          () => []
        )) as InspectionResult[];

        const values = { ...defaultValues };
        for (const result of results) {
          if (!result.criterion_id) continue;
          values[result.criterion_id] = {
            answer: result.answer,
            comment: result.comment ?? "",
          };
        }

        setLinkedComplaintId(item.complaint_id ?? null);
        setForm({
          branch_id: item.branch_id,
          inspector: profile?.full_name?.trim() || item.inspector,
          inspected_at: item.inspected_at?.slice(0, 10) ?? todayInputValue(),
          comment: item.comment ?? "",
          status: item.status,
        });
        setCriterionValues(values);
      } catch (error) {
        pushToast(getErrorMessage(error, "Ошибка загрузки"), "error");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadEditor();

    return () => {
      cancelled = true;
    };
  }, [inspectionId, profile?.full_name, profile?.id, profile?.role, router, session?.user, pushToast]);

  useEffect(() => {
    if (!profile?.full_name || form.inspector || inspectionId != null) return;
    if (inspectorOptions.includes(profile.full_name)) {
      setForm((prev) => ({ ...prev, inspector: profile.full_name ?? "" }));
    }
  }, [form.inspector, inspectionId, inspectorOptions, profile?.full_name]);

  const handleCriterionChange = (criterionId: string, value: CriterionFormValue) => {
    setCriterionValues((prev) => ({ ...prev, [criterionId]: value }));
  };

  const handleCreateCriterion = async (subcategoryId: string, draft: NewCriterionDraft) => {
    const subcategory = categories
      .flatMap((category) => category.subcategories ?? [])
      .find((item) => item.id === subcategoryId);

    if (!subcategory) {
      throw new Error("Подгруппа не найдена");
    }

    const criterion = await createInspectionCriterion(supabase, {
      subcategory_id: subcategoryId,
      title: draft.title,
      severity: draft.severity,
      penalty_points: draft.penalty_points,
      description: draft.description ?? null,
      sort_order: (subcategory.criteria?.length ?? 0) + 1,
    });

    setCategories((prev) => appendCriterionToCategories(prev, subcategoryId, criterion));
    setCriterionValues((prev) => ({
      ...prev,
      [criterion.id]: { answer: "no", comment: "" },
    }));

    await writeAuditLog(supabase, "inspection_criterion_created", "inspection_criterion", criterion.id, {
      subcategory_id: subcategoryId,
      title: criterion.title,
      severity: criterion.severity,
      penalty_points: criterion.penalty_points,
    });

    pushToast("Критерий добавлен в подгруппу", "success");
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

    const inspectionPayload = {
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
    };

    let savedInspectionId = inspectionId;

    if (inspectionId != null) {
      const { error } = await supabase
        .from("inspections")
        .update(inspectionPayload)
        .eq("id", inspectionId);

      if (error) {
        setSaving(false);
        setSaveError(error.message || "Не удалось сохранить");
        pushToast("Не удалось сохранить проверку", "error");
        return;
      }

      const { error: deleteResultsError } = await supabase
        .from("inspection_results")
        .delete()
        .eq("inspection_id", inspectionId);

      if (deleteResultsError) {
        setSaving(false);
        setSaveError(deleteResultsError.message);
        pushToast("Не удалось обновить результаты проверки", "error");
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("inspections")
        .insert([inspectionPayload])
        .select("id")
        .single();

      if (error) {
        setSaving(false);
        setSaveError(error.message || "Не удалось сохранить");
        pushToast("Не удалось сохранить проверку", "error");
        return;
      }

      savedInspectionId = data.id as number;
    }

    if (savedInspectionId == null) {
      setSaving(false);
      setSaveError("Не удалось определить проверку");
      return;
    }

    const resultRows = Object.entries(criterionValues).map(([criterion_id, value]) => ({
      inspection_id: savedInspectionId,
      criterion_id,
      answer: value.answer,
      comment: value.comment.trim() || null,
    }));

    const { error: resultsError } = await supabase.from("inspection_results").insert(resultRows);

    if (resultsError) {
      setSaving(false);
      setSaveError(resultsError.message);
      pushToast(
        isEditing
          ? "Проверка обновлена, но результаты критериев не сохранились"
          : "Проверка создана, но результаты критериев не сохранились",
        "error"
      );
      return;
    }

    if (session?.user.id) {
      for (const [criterionId, value] of Object.entries(criterionValues)) {
        if (!value.photoFile) continue;
        try {
          await uploadInspectionPhoto(
            supabase,
            savedInspectionId,
            value.photoFile,
            session.user.id,
            criterionId
          );
        } catch (uploadError) {
          pushToast(getErrorMessage(uploadError, "Ошибка загрузки фото"), "error");
        }
      }
    }

    if (linkedComplaintId) {
      await supabase
        .from("complaints")
        .update({ status: mapInspectionStatusToComplaintStatus(form.status) })
        .eq("id", linkedComplaintId);
    }

    setSaving(false);

    await writeAuditLog(
      supabase,
      isEditing ? "inspection_updated" : "inspection_created",
      "inspection",
      savedInspectionId,
      {
        branch_id: form.branch_id,
        status: form.status,
        score: summary.score,
        complaint_id: linkedComplaintId,
      }
    );

    pushToast(isEditing ? "Проверка обновлена" : "Проверка сохранена", "success");
    router.push("/inspections");
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

  if (!canRunInspection) {
    return (
      <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-6">
        <EmptyState
          title="Нет прав на редактирование проверки"
          description="Создавать и сохранять проверки могут только пользователи с ролью QC или admin."
        />
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-6">
        <LoadingState label="Загрузка проверки…" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-6">
      <div className="mb-6">
        <Link href="/inspections" className="text-sm text-white/60 hover:text-white">
          ← К списку проверок
        </Link>
        <h1 className="mt-3 text-3xl font-bold">
          {isEditing ? `Проверка #${inspectionId}` : "Новая проверка"}
        </h1>
      </div>

      <div className="space-y-5 rounded-2xl border border-white/10 bg-neutral-900 p-4">
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
            {selectableBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          {!profileLoading && selectableBranches.length === 0 ? (
            <p className="md:col-span-2 text-sm text-amber-200/90">
              Нет доступных филиалов. Добавьте их в разделе «Филиалы» (для admin) или назначьте
              филиал в профиле пользователя.
            </p>
          ) : null}
          {branchAssignmentMissing ? (
            <p className="md:col-span-2 text-sm text-white/60">
              В профиле не указаны филиалы — для проверки доступен общий список из справочника.
            </p>
          ) : null}

          <input
            type="date"
            value={form.inspected_at}
            onChange={(e) => setForm({ ...form, inspected_at: e.target.value })}
            className="rounded-xl bg-neutral-800 px-3 py-2"
          />

          <select
            value={
              inspectorOptions.includes(form.inspector) || form.inspector === ""
                ? form.inspector
                : "__custom__"
            }
            onChange={(event) => {
              const value = event.target.value;
              if (value === "__custom__") {
                setForm({ ...form, inspector: "" });
                return;
              }
              setForm({ ...form, inspector: value });
            }}
            className="rounded-xl bg-neutral-800 px-3 py-2"
          >
            <option value="">Выбери проверяющего</option>
            {inspectorOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="__custom__">Другой проверяющий</option>
          </select>
          {!inspectorOptions.includes(form.inspector) ? (
            <input
              placeholder="ФИО проверяющего"
              value={form.inspector}
              onChange={(event) => setForm({ ...form, inspector: event.target.value })}
              className="rounded-xl bg-neutral-800 px-3 py-2"
            />
          ) : null}
          {inspectorOptions.length === 0 ? (
            <p className="md:col-span-2 text-sm text-amber-200/90">
              Список проверяющих пуст. Добавьте пользователей с ролями admin или qc в profiles.
            </p>
          ) : null}

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
          canManageCriteria={canManageCatalog}
          onCreateCriterion={canManageCatalog ? handleCreateCriterion : undefined}
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
    </main>
  );
}
