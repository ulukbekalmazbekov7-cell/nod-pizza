"use client";

import type { CriterionAnswer, InspectionCategory, InspectionCriterion } from "@/lib/types";
import {
  answerLabel,
  effectivePenaltyPoints,
  severityBadgeClass,
  severityLabel,
} from "@/lib/inspectionScoring";

export type CriterionFormValue = {
  answer: CriterionAnswer;
  comment: string;
  photoFile?: File;
};

type InspectionCriteriaFormProps = {
  categories: InspectionCategory[];
  values: Record<string, CriterionFormValue>;
  onChange: (criterionId: string, value: CriterionFormValue) => void;
};

const answerOptions: CriterionAnswer[] = ["yes", "no", "no_data", "not_applicable"];

export default function InspectionCriteriaForm({
  categories,
  values,
  onChange,
}: InspectionCriteriaFormProps) {
  return (
    <div className="space-y-5">
      {categories.map((category) => (
        <section
          key={category.id}
          className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/50"
        >
          <header className="border-b border-white/10 bg-neutral-900/80 px-4 py-4 md:px-5">
            <h3 className="text-lg font-semibold tracking-tight">{category.name}</h3>
            {category.description ? (
              <p className="mt-1 text-sm text-white/60">{category.description}</p>
            ) : null}
          </header>

          <CategoryBody>
            {(category.subcategories ?? []).map((subcategory) => (
              <div
                key={subcategory.id}
                className="rounded-xl border border-white/10 bg-neutral-900/40"
              >
                <div className="border-b border-white/10 px-4 py-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-white/85">
                    {subcategory.name}
                  </h4>
                  {subcategory.description ? (
                    <p className="mt-1 text-xs text-white/55">{subcategory.description}</p>
                  ) : null}
                </div>

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
                </div>
              </div>
            ))}
          </CategoryBody>
        </section>
      ))}
    </div>
  );
}

function CategoryBody({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 p-4 md:p-5">{children}</div>;
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

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <CriterionTitleRow criterion={criterion} penalty={penalty} />
          {criterion.description ? (
            <p className="mt-2 text-sm text-white/60">{criterion.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {answerOptions.map((answer) => (
            <label
              key={answer}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition ${
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

      <textarea
        placeholder="Комментарий по критерию"
        value={value.comment}
        onChange={(event) => onChange(criterion.id, { ...value, comment: event.target.value })}
        className="min-h-20 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm"
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
      <p className="font-medium text-white">{criterion.title}</p>
      <span
        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${severityBadgeClass(criterion.severity)}`}
      >
        {severityLabel(criterion.severity)}
      </span>
      <span className="rounded-full border border-white/15 bg-neutral-950 px-2.5 py-0.5 text-[11px] text-white/75">
        Штраф: {penalty} б.
      </span>
    </div>
  );
}
