"use client";

import { useEffect, useMemo, useState } from "react";
import type { CriterionAnswer, CriterionSeverity, InspectionCategory, InspectionCriterion } from "@/lib/types";
import {
  answerLabel,
  DEFAULT_PENALTY_BY_SEVERITY,
  effectivePenaltyPoints,
  severityBadgeClass,
  severityLabel,
} from "@/lib/inspectionScoring";

export type NewCriterionDraft = {
  title: string;
  severity: CriterionSeverity;
  penalty_points?: number;
  description?: string;
};

type InspectionCriteriaFormProps = {
  categories: InspectionCategory[];
  values: Record<string, CriterionFormValue>;
  onChange: (criterionId: string, value: CriterionFormValue) => void;
  canManageCriteria?: boolean;
  onCreateCriterion?: (subcategoryId: string, draft: NewCriterionDraft) => Promise<void>;
};

const answerOptions: CriterionAnswer[] = ["yes", "no", "no_data", "not_applicable"];
const severityOptions: CriterionSeverity[] = [
  "minor",
  "medium",
  "critical",
  "none",
  "informational",
];

export type CriterionFormValue = {
  answer: CriterionAnswer;
  comment: string;
  photoFile?: File;
};

function countCriteria(category: InspectionCategory) {
  return (category.subcategories ?? []).reduce(
    (total, subcategory) => total + (subcategory.criteria?.length ?? 0),
    0
  );
}

function countAnswered(category: InspectionCategory, values: Record<string, CriterionFormValue>) {
  return (category.subcategories ?? []).reduce((total, subcategory) => {
    for (const criterion of subcategory.criteria ?? []) {
      if (values[criterion.id]) total += 1;
    }
    return total;
  }, 0);
}

export default function InspectionCriteriaForm({
  categories,
  values,
  onChange,
  canManageCriteria = false,
  onCreateCriterion,
}: InspectionCriteriaFormProps) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [openSubcategories, setOpenSubcategories] = useState<Set<string>>(new Set());

  const firstCategoryId = categories[0]?.id;

  useEffect(() => {
    if (!firstCategoryId) return;
    setOpenCategories((prev) => (prev.size > 0 ? prev : new Set([firstCategoryId])));
    const firstSubcategory = categories[0]?.subcategories?.[0]?.id;
    if (!firstSubcategory) return;
    setOpenSubcategories((prev) => (prev.size > 0 ? prev : new Set([firstSubcategory])));
  }, [categories, firstCategoryId]);

  const totalCriteria = useMemo(
    () => categories.reduce((sum, category) => sum + countCriteria(category), 0),
    [categories]
  );

  const answeredCriteria = useMemo(
    () => categories.reduce((sum, category) => sum + countAnswered(category, values), 0),
    [categories, values]
  );

  const toggleCategory = (categoryId: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const toggleSubcategory = (subcategoryId: string) => {
    setOpenSubcategories((prev) => {
      const next = new Set(prev);
      if (next.has(subcategoryId)) next.delete(subcategoryId);
      else next.add(subcategoryId);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-neutral-950/60 px-4 py-3 text-sm text-white/70">
        <span>Критерии сгруппированы по разделам — открывайте только нужный блок.</span>
        <span className="font-medium text-white/85">
          Заполнено: {answeredCriteria} / {totalCriteria}
        </span>
      </div>

      {categories.map((category) => {
        const categoryOpen = openCategories.has(category.id);
        const categoryTotal = countCriteria(category);

        return (
          <section
            key={category.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/50"
          >
            <button
              type="button"
              onClick={() => toggleCategory(category.id)}
              className="flex w-full items-start justify-between gap-3 border-b border-white/10 bg-neutral-900/80 px-4 py-4 text-left md:px-5"
              aria-expanded={categoryOpen}
            >
              <div className="min-w-0">
                <h3 className="text-base font-semibold tracking-tight md:text-lg">{category.name}</h3>
                {category.description ? (
                  <p className="mt-1 text-sm text-white/60">{category.description}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-white/60">
                <span className="rounded-full border border-white/10 px-2 py-1">
                  {categoryTotal} крит.
                </span>
                <span className="text-white/80">{categoryOpen ? "−" : "+"}</span>
              </div>
            </button>

            {categoryOpen ? (
              <div className="space-y-3 p-3 md:p-4">
                {(category.subcategories ?? []).map((subcategory) => {
                  const subcategoryOpen = openSubcategories.has(subcategory.id);
                  const subcategoryTotal = subcategory.criteria?.length ?? 0;

                  return (
                    <div
                      key={subcategory.id}
                      className="overflow-hidden rounded-xl border border-white/10 bg-neutral-900/40"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSubcategory(subcategory.id)}
                        className="flex w-full items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-left"
                        aria-expanded={subcategoryOpen}
                      >
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold uppercase tracking-wide text-white/85">
                            {subcategory.name}
                          </h4>
                          {subcategory.description ? (
                            <p className="mt-1 text-xs text-white/55">{subcategory.description}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs text-white/60">
                          <span>{subcategoryTotal}</span>
                          <span className="text-white/80">{subcategoryOpen ? "−" : "+"}</span>
                        </div>
                      </button>

                      {subcategoryOpen ? (
                        <div className="divide-y divide-white/10">
                          {(subcategory.criteria ?? []).map((criterion) => {
                            const value = values[criterion.id] ?? {
                              answer: "no" as CriterionAnswer,
                              comment: "",
                            };

                            return (
                              <CriterionRow
                                key={criterion.id}
                                criterion={criterion}
                                value={value}
                                onChange={onChange}
                              />
                            );
                          })}
                          {canManageCriteria && onCreateCriterion ? (
                            <AddCriterionPanel
                              subcategoryId={subcategory.id}
                              onCreateCriterion={onCreateCriterion}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function CriterionRow({
  criterion,
  value,
  onChange,
}: {
  criterion: InspectionCriterion;
  value: CriterionFormValue;
  onChange: (criterionId: string, value: CriterionFormValue) => void;
}) {
  const penalty = effectivePenaltyPoints(criterion);
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(value.comment.trim() || value.photoFile || value.answer !== "no")
  );

  useEffect(() => {
    if (value.comment.trim() || value.photoFile || value.answer !== "no") {
      setDetailsOpen(true);
    }
  }, [value.answer, value.comment, value.photoFile]);

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <CriterionTitleRow criterion={criterion} penalty={penalty} />
          {criterion.description ? (
            <p className="mt-1 text-sm text-white/60">{criterion.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {answerOptions.map((answer) => (
            <label
              key={answer}
              className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs transition md:text-sm ${
                value.answer === answer
                  ? "border-blue-500/60 bg-blue-600 text-white"
                  : "border-white/10 bg-neutral-950 text-white/80 hover:bg-white/5"
              }`}
            >
              <input
                type="radio"
                name={`criterion-${criterion.id}`}
                value={answer}
                checked={value.answer === answer}
                onChange={() => onChange(criterion.id, { ...value, answer })}
                className="sr-only"
              />
              {answerLabel(answer)}
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setDetailsOpen((prev) => !prev)}
        className="text-xs text-blue-300 hover:text-blue-200"
      >
        {detailsOpen ? "Скрыть комментарий и фото" : "Комментарий и фото"}
      </button>

      {detailsOpen ? (
        <div className="space-y-2">
          <textarea
            placeholder="Комментарий по критерию"
            value={value.comment}
            onChange={(event) => onChange(criterion.id, { ...value, comment: event.target.value })}
            className="min-h-16 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm"
          />

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-blue-300 hover:text-blue-200">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const photoFile = event.target.files?.[0];
                onChange(criterion.id, { ...value, photoFile });
                event.currentTarget.value = "";
              }}
            />
            {value.photoFile ? `Фото: ${value.photoFile.name}` : "+ Фото-доказательство"}
          </label>
        </div>
      ) : null}
    </div>
  );
}

function AddCriterionPanel({
  subcategoryId,
  onCreateCriterion,
}: {
  subcategoryId: string;
  onCreateCriterion: (subcategoryId: string, draft: NewCriterionDraft) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<CriterionSeverity>("minor");
  const [penaltyPoints, setPenaltyPoints] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultPenalty = DEFAULT_PENALTY_BY_SEVERITY[severity];
  const isScored = severity !== "none" && severity !== "informational";

  const resetForm = () => {
    setTitle("");
    setSeverity("minor");
    setPenaltyPoints("");
    setDescription("");
    setError(null);
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Укажите название критерия");
      return;
    }

    const parsedPenalty = penaltyPoints.trim() ? Number(penaltyPoints) : undefined;
    if (parsedPenalty != null && (!Number.isFinite(parsedPenalty) || parsedPenalty < 0)) {
      setError("Штраф должен быть неотрицательным числом");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onCreateCriterion(subcategoryId, {
        title: trimmedTitle,
        severity,
        penalty_points: parsedPenalty,
        description: description.trim() || undefined,
      });
      resetForm();
      setOpen(false);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Не удалось добавить критерий";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-blue-300 hover:text-blue-200"
        >
          + Добавить свой критерий
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-white/10 bg-neutral-950/40 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white">Новый критерий в подгруппе</p>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setOpen(false);
          }}
          className="text-xs text-white/60 hover:text-white/85"
        >
          Отмена
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          placeholder="Название критерия"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm md:col-span-2"
        />

        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value as CriterionSeverity)}
          className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm"
        >
          {severityOptions.map((option) => (
            <option key={option} value={option}>
              {severityLabel(option)}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={0}
          placeholder={isScored ? `Штраф, по умолчанию ${defaultPenalty}` : "Без штрафа"}
          value={penaltyPoints}
          onChange={(event) => setPenaltyPoints(event.target.value)}
          disabled={!isScored}
          className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm disabled:opacity-50"
        />

        <textarea
          placeholder="Пояснение (необязательно)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="min-h-16 rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm md:col-span-2"
        />
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={saving}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm disabled:opacity-50"
      >
        {saving ? "Сохранение…" : "Добавить в подгруппу"}
      </button>
    </div>
  );
}

function CriterionTitleRow({
  criterion,
  penalty,
}: {
  criterion: InspectionCriterion;
  penalty: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm font-medium text-white md:text-base">{criterion.title}</p>
      <span
        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${severityBadgeClass(criterion.severity)}`}
      >
        {severityLabel(criterion.severity)}
      </span>
      <span className="rounded-full border border-white/15 bg-neutral-950 px-2 py-0.5 text-[11px] text-white/75">
        Штраф: {penalty} б.
      </span>
    </div>
  );
}
