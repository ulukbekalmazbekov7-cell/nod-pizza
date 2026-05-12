import type { InspectionStatus } from "@/lib/types";

export function inspectionStatusLabel(status: InspectionStatus | string): string {
  switch (status) {
    case "draft":
      return "Новая";
    case "in_progress":
      return "В работе";
    case "completed":
      return "Закрыта";
    case "needs_review":
      return "Проверка исправления";
    default:
      return status;
  }
}

export function scoreStatus(score: number) {
  if (score >= 90) return "Хорошо";
  if (score >= 70) return "Есть замечания";
  return "Критично";
}

export function isViolation(score: number | null | undefined): boolean {
  if (score == null || !Number.isFinite(Number(score))) return false;
  return Number(score) < 70;
}

export function inspectionBranchName(
  branches?: { name: string } | { name: string }[] | null
): string {
  if (!branches) return "Без филиала";
  if (Array.isArray(branches)) return branches[0]?.name ?? "Без филиала";
  return branches.name ?? "Без филиала";
}

export function formatInspectionDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
