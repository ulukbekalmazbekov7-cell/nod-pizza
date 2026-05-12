export type CriterionSeverity = "minor" | "medium" | "critical" | "none" | "informational";

export type CriterionAnswer = "yes" | "no" | "no_data" | "not_applicable";

export const BASE_INSPECTION_SCORE = 100;

/** Фиксированные штрафы по severity, если penalty_points в строке = 0. */
export const DEFAULT_PENALTY_BY_SEVERITY: Record<CriterionSeverity, number> = {
  minor: 3,
  medium: 5,
  critical: 10,
  none: 0,
  informational: 0,
};

export type CriterionForScoring = {
  id: string;
  severity: CriterionSeverity;
  penalty_points: number;
  is_evaluated: boolean;
};

export type ResultForScoring = {
  criterion_id: string;
  answer: CriterionAnswer;
};

export type InspectionScoreSummary = {
  score: number;
  totalPenalties: number;
  minorViolations: number;
  mediumViolations: number;
  criticalViolations: number;
  nonScoringFindings: number;
  violatedCriteriaIds: string[];
};

export function effectivePenaltyPoints(criterion: CriterionForScoring): number {
  if (!criterion.is_evaluated) return 0;
  if (criterion.severity === "none" || criterion.severity === "informational") return 0;
  if (criterion.penalty_points > 0) return criterion.penalty_points;
  return DEFAULT_PENALTY_BY_SEVERITY[criterion.severity];
}

export function calculateInspectionScore(
  criteria: CriterionForScoring[],
  results: ResultForScoring[]
): InspectionScoreSummary {
  const criteriaById = new Map(criteria.map((item) => [item.id, item]));
  let totalPenalties = 0;
  let minorViolations = 0;
  let mediumViolations = 0;
  let criticalViolations = 0;
  let nonScoringFindings = 0;
  const violatedCriteriaIds: string[] = [];

  for (const result of results) {
    if (result.answer !== "yes") continue;

    const criterion = criteriaById.get(result.criterion_id);
    if (!criterion) continue;

    violatedCriteriaIds.push(criterion.id);

    if (!criterion.is_evaluated || criterion.severity === "none" || criterion.severity === "informational") {
      nonScoringFindings += 1;
      continue;
    }

    if (criterion.severity === "minor") minorViolations += 1;
    if (criterion.severity === "medium") mediumViolations += 1;
    if (criterion.severity === "critical") criticalViolations += 1;

    totalPenalties += effectivePenaltyPoints(criterion);
  }

  const score = Math.max(0, BASE_INSPECTION_SCORE - totalPenalties);

  return {
    score,
    totalPenalties,
    minorViolations,
    mediumViolations,
    criticalViolations,
    nonScoringFindings,
    violatedCriteriaIds,
  };
}

export function severityLabel(severity: CriterionSeverity): string {
  switch (severity) {
    case "minor":
      return "Мелкое нарушение";
    case "medium":
      return "Среднее нарушение";
    case "critical":
      return "Грубое нарушение";
    case "none":
      return "Безоценочное";
    case "informational":
      return "Информационное";
    default:
      return severity;
  }
}

export function severityBadgeClass(severity: CriterionSeverity): string {
  switch (severity) {
    case "critical":
      return "border-red-500/50 bg-red-950/50 text-red-100";
    case "medium":
      return "border-orange-500/50 bg-orange-950/40 text-orange-100";
    case "minor":
      return "border-yellow-500/50 bg-yellow-950/40 text-yellow-100";
    case "none":
    case "informational":
      return "border-white/20 bg-neutral-800/80 text-white/70";
    default:
      return "border-white/20 bg-neutral-800/80 text-white/70";
  }
}

export function answerLabel(answer: CriterionAnswer): string {
  switch (answer) {
    case "yes":
      return "Да";
    case "no":
      return "Нет";
    case "no_data":
      return "Нет данных";
    case "not_applicable":
      return "Не применимо";
    default:
      return answer;
  }
}
