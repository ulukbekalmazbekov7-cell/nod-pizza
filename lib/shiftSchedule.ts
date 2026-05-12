import type { SupabaseClient } from "@supabase/supabase-js";

/** Текущая версия формата payload — при смене структуры увеличивай и мигрируй в load. */
export const SHIFT_SCHEDULE_SCHEMA_VERSION = 1 as const;

export const DEFAULT_SHIFT_SCHEDULE_SLUG = "skp_calendar_default";

export type ShiftType = "Д" | "Н" | "В";

export type ShiftScheduleEmployee = {
  id: number;
  name: string;
  position: string;
  shifts: ShiftType[];
};

/** В JSON ключи объекта — строки; в UI используем number id. */
export type ShiftScheduleAssignments = Record<number, string[]>;

export type ShiftSchedulePayloadV1 = {
  schemaVersion: typeof SHIFT_SCHEDULE_SCHEMA_VERSION;
  daysInMonth: number;
  /** Зарезервировано под разные месяцы (например "2026-04"). */
  periodLabel?: string;
  employees: ShiftScheduleEmployee[];
  assignments: Record<string, string[]>;
};

export type ShiftScheduleRow = {
  slug: string;
  label: string | null;
  payload: ShiftSchedulePayloadV1;
  updated_at: string;
  updated_by?: string | null;
  branch_id?: number | null;
  period_label?: string | null;
};

export function buildShiftScheduleSlug(branchId: number | null, periodLabel: string) {
  return `shift_${branchId ?? "all"}_${periodLabel}`;
}

function assignmentsFromRecord(
  raw: Record<string, string[]> | undefined
): ShiftScheduleAssignments {
  const out: ShiftScheduleAssignments = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    const id = Number(k);
    if (!Number.isFinite(id)) continue;
    out[id] = v;
  }
  return out;
}

function assignmentsToRecord(a: ShiftScheduleAssignments): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(a)) {
    out[String(k)] = v;
  }
  return out;
}

export function buildPayload(
  employees: ShiftScheduleEmployee[],
  assignments: ShiftScheduleAssignments,
  options?: { daysInMonth?: number; periodLabel?: string }
): ShiftSchedulePayloadV1 {
  return {
    schemaVersion: SHIFT_SCHEDULE_SCHEMA_VERSION,
    daysInMonth: options?.daysInMonth ?? 30,
    periodLabel: options?.periodLabel,
    employees,
    assignments: assignmentsToRecord(assignments),
  };
}

export function parseStoredPayload(raw: unknown): {
  employees: ShiftScheduleEmployee[];
  assignments: ShiftScheduleAssignments;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<ShiftSchedulePayloadV1>;
  if (p.schemaVersion !== SHIFT_SCHEDULE_SCHEMA_VERSION) return null;
  if (!Array.isArray(p.employees)) return null;

  const employees = p.employees as ShiftScheduleEmployee[];
  const assignments = assignmentsFromRecord(p.assignments as Record<string, string[]>);

  return { employees, assignments };
}

export async function loadShiftSchedule(
  client: SupabaseClient,
  slug: string = DEFAULT_SHIFT_SCHEDULE_SLUG
): Promise<ShiftScheduleRow | null> {
  const { data, error } = await client
    .from("shift_schedule_snapshots")
    .select("slug,label,payload,updated_at,updated_by,branch_id,period_label")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    slug: data.slug as string,
    label: data.label as string | null,
    payload: data.payload as ShiftSchedulePayloadV1,
    updated_at: data.updated_at as string,
    updated_by: data.updated_by as string | null,
    branch_id: data.branch_id as number | null,
    period_label: data.period_label as string | null,
  };
}

export async function saveShiftSchedule(
  client: SupabaseClient,
  payload: ShiftSchedulePayloadV1,
  options?: {
    slug?: string;
    label?: string;
    branchId?: number | null;
    periodLabel?: string;
    updatedBy?: string | null;
  }
): Promise<{ updated_at: string }> {
  const slug = options?.slug ?? DEFAULT_SHIFT_SCHEDULE_SLUG;
  const label = options?.label ?? "График СКП";

  const { data, error } = await client
    .from("shift_schedule_snapshots")
    .upsert(
      {
        slug,
        label,
        payload,
        branch_id: options?.branchId ?? null,
        period_label: options?.periodLabel ?? payload.periodLabel ?? null,
        updated_by: options?.updatedBy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select("updated_at")
    .single();

  if (error) throw error;
  return { updated_at: data.updated_at as string };
}
