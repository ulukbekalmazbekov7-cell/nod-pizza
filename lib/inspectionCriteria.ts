import type { SupabaseClient } from "@supabase/supabase-js";
import type { InspectionCategory, InspectionCriterion, InspectionSubcategory } from "@/lib/types";

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

  if (error) throw error;

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
