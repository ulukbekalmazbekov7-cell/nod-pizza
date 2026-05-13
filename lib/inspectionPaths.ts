export function buildInspectionPageHref(inspectionId: number) {
  return `/inspections/${inspectionId}`;
}

export function buildInspectionNewHref(complaintId?: string) {
  if (!complaintId) return "/inspections/new";
  return `/inspections/new?complaintId=${encodeURIComponent(complaintId)}`;
}
