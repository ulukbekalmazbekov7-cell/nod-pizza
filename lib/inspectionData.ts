import type { SupabaseClient } from "@supabase/supabase-js";
import type { Branch } from "@/lib/types";

const INSPECTIONS_EXTENDED_SELECT =
  "id, branch_id, inspector, score, comment, status, author_id, inspected_at, minor_violations, medium_violations, critical_violations, non_scoring_findings, total_penalties, complaint_id, created_at, branches(name)";

const INSPECTIONS_BASE_SELECT =
  "id, branch_id, inspector, score, comment, status, author_id, complaint_id, created_at, branches(name)";

function isMissingColumnError(error: { code?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === "PGRST205";
}

export async function fetchBranches(client: SupabaseClient) {
  const { data, error } = await client.from("branches").select("id, name").order("name");
  if (error) throw error;
  return (data ?? []) as Branch[];
}

export async function fetchInspectionsList(client: SupabaseClient) {
  const extended = await client
    .from("inspections")
    .select(INSPECTIONS_EXTENDED_SELECT)
    .order("created_at", { ascending: false });

  if (!isMissingColumnError(extended.error)) {
    if (extended.error) throw extended.error;
    return extended.data ?? [];
  }

  const base = await client
    .from("inspections")
    .select(INSPECTIONS_BASE_SELECT)
    .order("created_at", { ascending: false });

  if (base.error) throw base.error;
  return base.data ?? [];
}

export async function fetchInspectionResults(client: SupabaseClient, inspectionIds: number[]) {
  if (inspectionIds.length === 0) return [];

  const { data, error } = await client
    .from("inspection_results")
    .select(
      "id, inspection_id, criterion_id, answer, comment, criterion:inspection_criteria(id, title, severity, penalty_points, is_evaluated, subcategory:inspection_subcategories(id, name, category:inspection_categories(id, name)))"
    )
    .in("inspection_id", inspectionIds);

  if (isMissingTableError(error)) return [];
  if (error) throw error;
  return data ?? [];
}

export async function fetchInspectionPhotos(client: SupabaseClient, inspectionIds: number[]) {
  if (inspectionIds.length === 0) return [];

  const { data, error } = await client
    .from("inspection_photos")
    .select("id, inspection_id, storage_path, uploaded_by, criterion_id, created_at")
    .in("inspection_id", inspectionIds);

  if (isMissingTableError(error)) return [];
  if (error) throw error;
  return data ?? [];
}
