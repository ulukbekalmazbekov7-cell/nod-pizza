import type { SupabaseClient } from "@supabase/supabase-js";
import type { Complaint } from "@/lib/types";
import { complaintRequestTypeLabel } from "@/lib/complaints";
import { getErrorMessage } from "@/lib/errors";

export function buildInspectionSummaryFromComplaint(complaint: Complaint) {
  const lines = [
    `Заявка ${complaint.id}`,
    `Тип: ${complaintRequestTypeLabel(complaint.request_type)}`,
    complaint.complaint_text,
  ];

  if (complaint.operator_comment?.trim()) {
    lines.push(`Комментарий оператора: ${complaint.operator_comment.trim()}`);
  }

  if (complaint.customer_phone?.trim()) {
    lines.push(`Клиент: ${complaint.customer_phone.trim()}`);
  }

  if (complaint.invoice_number?.trim()) {
    lines.push(`Накладная: ${complaint.invoice_number.trim()}`);
  }

  if (complaint.request_type === "hall") {
    if (complaint.table_number?.trim()) lines.push(`Столик: ${complaint.table_number.trim()}`);
    if (complaint.floor?.trim()) lines.push(`Этаж: ${complaint.floor.trim()}`);
  }

  if (complaint.has_media) {
    lines.push("У заявки отмечены фото/видео.");
  }

  return lines.join("\n");
}

export async function createLinkedInspection(
  client: SupabaseClient,
  complaint: Complaint,
  actorId?: string | null
) {
  const { data: inspection, error: inspectionError } = await client
    .from("inspections")
    .insert({
      branch_id: complaint.branch_id,
      inspector: "Контроль качества",
      score: null,
      comment: buildInspectionSummaryFromComplaint(complaint),
      status: "draft",
      complaint_id: complaint.id,
      author_id: actorId ?? complaint.created_by ?? null,
      inspected_at: null,
    })
    .select("id")
    .single();

  if (inspectionError) {
    throw new Error(getErrorMessage(inspectionError, "Не удалось создать проверку по заявке"));
  }

  const inspectionId = inspection.id as number;

  const { error: complaintError } = await client
    .from("complaints")
    .update({
      inspection_id: inspectionId,
      status: "assigned",
    })
    .eq("id", complaint.id);

  if (complaintError) {
    throw new Error(getErrorMessage(complaintError, "Не удалось связать заявку с проверкой"));
  }

  return inspectionId;
}

export function mapInspectionStatusToComplaintStatus(
  status: "draft" | "in_progress" | "needs_review" | "completed"
) {
  switch (status) {
    case "draft":
      return "assigned" as const;
    case "in_progress":
      return "in_progress" as const;
    case "needs_review":
      return "correction_check" as const;
    case "completed":
      return "closed" as const;
    default:
      return "assigned" as const;
  }
}
