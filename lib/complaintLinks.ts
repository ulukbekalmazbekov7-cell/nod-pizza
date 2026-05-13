export const INSPECTION_FOCUS_QUERY = "inspectionId";
export const COMPLAINT_FOCUS_QUERY = "complaintId";

export function buildInspectionFocusHref(inspectionId: number, complaintId?: string) {
  const params = new URLSearchParams({
    [INSPECTION_FOCUS_QUERY]: String(inspectionId),
  });
  if (complaintId) {
    params.set(COMPLAINT_FOCUS_QUERY, complaintId);
  }
  return `/inspections?${params.toString()}`;
}

export function buildComplaintFocusHref(complaintId: string) {
  return `/inspections?${COMPLAINT_FOCUS_QUERY}=${complaintId}`;
}
