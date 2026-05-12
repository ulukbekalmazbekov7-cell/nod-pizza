import type {
  ComplaintLevel,
  ComplaintRequestType,
  ComplaintSource,
  ComplaintStatus,
  JiraSyncStatus,
} from "@/lib/types";

export const COMPLAINT_REQUEST_TYPE_OPTIONS: Array<{
  value: ComplaintRequestType;
  label: string;
  source: ComplaintSource;
}> = [
  { value: "delivery", label: "Доставка", source: "delivery" },
  { value: "hall", label: "Зал", source: "hall" },
  { value: "app", label: "Приложение", source: "app" },
  { value: "other", label: "Другое", source: "other" },
];

export const COMPLAINT_STATUS_OPTIONS: ComplaintStatus[] = [
  "created",
  "assigned",
  "in_progress",
  "correction_check",
  "closed",
];

export const COMPLAINT_LEVEL_OPTIONS: ComplaintLevel[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export function complaintRequestTypeLabel(value: string) {
  return COMPLAINT_REQUEST_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export function complaintSourceLabel(source: ComplaintSource) {
  switch (source) {
    case "phone":
      return "Телефон";
    case "app":
      return "Приложение";
    case "delivery":
      return "Доставка";
    case "hall":
      return "Зал";
    case "rocket":
      return "Rocket";
    case "other":
      return "Другое";
    default:
      return source;
  }
}

export function complaintStatusLabel(status: ComplaintStatus) {
  switch (status) {
    case "created":
      return "Создана";
    case "assigned":
      return "Назначена";
    case "in_progress":
      return "В работе";
    case "correction_check":
      return "Проверка исправления";
    case "closed":
      return "Закрыта";
    default:
      return status;
  }
}

export function complaintLevelLabel(level: ComplaintLevel) {
  switch (level) {
    case "low":
      return "Низкий";
    case "medium":
      return "Средний";
    case "high":
      return "Высокий";
    case "critical":
      return "Критический";
    default:
      return level;
  }
}

export function jiraSyncStatusLabel(status: JiraSyncStatus) {
  switch (status) {
    case "pending":
      return "Ожидает синхронизации";
    case "success":
      return "Синхронизировано";
    case "failed":
      return "Ошибка синхронизации";
    default:
      return status;
  }
}

export function complaintLevelBadgeClass(level: ComplaintLevel) {
  switch (level) {
    case "critical":
      return "border-red-500/50 bg-red-950/50 text-red-100";
    case "high":
      return "border-orange-500/50 bg-orange-950/40 text-orange-100";
    case "medium":
      return "border-yellow-500/50 bg-yellow-950/40 text-yellow-100";
    case "low":
      return "border-emerald-500/40 bg-emerald-950/30 text-emerald-100";
    default:
      return "border-white/20 bg-neutral-800/80 text-white/70";
  }
}

export function jiraSyncBadgeClass(status: JiraSyncStatus) {
  switch (status) {
    case "success":
      return "border-emerald-500/40 bg-emerald-950/30 text-emerald-100";
    case "failed":
      return "border-red-500/50 bg-red-950/50 text-red-100";
    case "pending":
      return "border-blue-500/40 bg-blue-950/30 text-blue-100";
    default:
      return "border-white/20 bg-neutral-800/80 text-white/70";
  }
}

export function sourceForRequestType(requestType: ComplaintRequestType): ComplaintSource {
  return (
    COMPLAINT_REQUEST_TYPE_OPTIONS.find((item) => item.value === requestType)?.source ?? "other"
  );
}

export function formatComplaintDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
