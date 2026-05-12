export const INSPECTION_FOCUS_QUERY = "inspectionId";

export function buildInspectionFocusHref(inspectionId: number) {
  return `/inspections?${INSPECTION_FOCUS_QUERY}=${inspectionId}`;
}
