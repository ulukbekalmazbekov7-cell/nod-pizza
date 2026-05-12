import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CriterionSeverity,
  InspectionCategory,
  InspectionCriterion,
  InspectionSubcategory,
} from "@/lib/types";
import { DEFAULT_PENALTY_BY_SEVERITY } from "@/lib/inspectionScoring";

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === "PGRST205";
}

export type NewInspectionCriterionInput = {
  subcategory_id: string;
  title: string;
  severity: CriterionSeverity;
  penalty_points?: number;
  description?: string | null;
  sort_order: number;
};

export async function fetchInspectionCatalog(client: SupabaseClient) {
  const { data, error } = await client
    .from("inspection_categories")
    .select(
      `id, name, sort_order, description,
      subcategories:inspection_subcategories(
        id, category_id, name, sort_order, description,
        criteria:inspection_criteria(
          id, subcategory_id, title, severity, penalty_points, is_evaluated, sort_order, description
        )
      )`
    )
    .order("sort_order", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }

  const categories = (data ?? []) as InspectionCategory[];
  return categories.map((category) => ({
    ...category,
    subcategories: [...(category.subcategories ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((subcategory) => ({
        ...subcategory,
        criteria: [...(subcategory.criteria ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      })),
  }));
}

export function flattenCriteria(categories: InspectionCategory[]): InspectionCriterion[] {
  return categories.flatMap((category) =>
    (category.subcategories ?? []).flatMap((subcategory) => subcategory.criteria ?? [])
  );
}

export function flattenSubcategories(categories: InspectionCategory[]): InspectionSubcategory[] {
  return categories.flatMap((category) => category.subcategories ?? []);
}

export function appendCriterionToCategories(
  categories: InspectionCategory[],
  subcategoryId: string,
  criterion: InspectionCriterion
): InspectionCategory[] {
  return categories.map((category) => ({
    ...category,
    subcategories: (category.subcategories ?? []).map((subcategory) => {
      if (subcategory.id !== subcategoryId) return subcategory;

      const criteria = [...(subcategory.criteria ?? []), criterion].sort(
        (left, right) => left.sort_order - right.sort_order
      );

      return { ...subcategory, criteria };
    }),
  }));
}

export async function createInspectionCriterion(
  client: SupabaseClient,
  input: NewInspectionCriterionInput
) {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Укажите название критерия");
  }

  const isEvaluated = input.severity !== "none" && input.severity !== "informational";
  const penaltyPoints =
    input.penalty_points ??
    (isEvaluated ? DEFAULT_PENALTY_BY_SEVERITY[input.severity] : 0);

  const { data, error } = await client
    .from("inspection_criteria")
    .insert({
      subcategory_id: input.subcategory_id,
      title,
      severity: input.severity,
      penalty_points: penaltyPoints,
      is_evaluated: isEvaluated,
      sort_order: input.sort_order,
      description: input.description?.trim() || null,
    })
    .select(
      "id, subcategory_id, title, severity, penalty_points, is_evaluated, sort_order, description"
    )
    .single();

  if (error) throw error;
  return data as InspectionCriterion;
}
