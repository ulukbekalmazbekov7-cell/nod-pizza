import type { Complaint, InspectionStatus } from "@/lib/types";

export type LinkedInspectionSummary = {
  id: number;
  status: InspectionStatus;
};

export function resolveLinkedInspection(complaint: Complaint): LinkedInspectionSummary | null {
  const linked = complaint.linked_inspection;
  if (linked) {
    const row = Array.isArray(linked) ? linked[0] : linked;
    if (row?.id != null && row.status) {
      return { id: row.id, status: row.status };
    }
  }

  if (complaint.inspection_id != null) {
    return { id: complaint.inspection_id, status: "draft" };
  }

  return null;
}

export function complaintHandedOffToQc(complaint: Complaint) {
  return resolveLinkedInspection(complaint) != null || complaint.status !== "created";
}
