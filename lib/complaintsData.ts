import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Complaint,
  ComplaintLevel,
  ComplaintRequestType,
  ComplaintSource,
} from "@/lib/types";
import { complaintRequestTypeLabel, sourceForRequestType } from "@/lib/complaints";
import { getErrorMessage } from "@/lib/errors";

const COMPLAINT_BASE_SELECT =
  "id, branch_id, source, request_type, category, severity, priority, complaint_text, customer_name, customer_phone, invoice_number, table_number, floor, has_media, operator_comment, status, created_by, created_at, updated_at, jira_issue_key, jira_issue_url, jira_sync_status, jira_sync_error, inspection_id";

export { COMPLAINT_BASE_SELECT };

const COMPLAINT_SELECT = `${COMPLAINT_BASE_SELECT}, branches(name), linked_inspection:inspections!inspection_id(id, status)`;

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === "PGRST205";
}

export type CreateComplaintInput = {
  branch_id: number;
  request_type: ComplaintRequestType;
  priority: ComplaintLevel;
  complaint_text: string;
  customer_name?: string;
  customer_phone?: string;
  invoice_number?: string;
  table_number?: string;
  floor?: string;
  has_media: boolean;
  operator_comment?: string;
  created_by?: string | null;
};

export async function fetchComplaints(client: SupabaseClient) {
  const extended = await client
    .from("complaints")
    .select(COMPLAINT_SELECT)
    .order("created_at", { ascending: false });

  if (!extended.error) {
    return (extended.data ?? []) as unknown as Complaint[];
  }

  if (!isMissingTableError(extended.error)) {
    const base = await client
      .from("complaints")
      .select(COMPLAINT_BASE_SELECT)
      .order("created_at", { ascending: false });

    if (base.error) {
      throw new Error(getErrorMessage(base.error, "Не удалось загрузить задачи"));
    }

    return (base.data ?? []) as unknown as Complaint[];
  }

  if (isMissingTableError(extended.error)) return [];
  throw new Error(getErrorMessage(extended.error, "Не удалось загрузить задачи"));
}

export async function createComplaint(client: SupabaseClient, input: CreateComplaintInput) {
  const source: ComplaintSource = sourceForRequestType(input.request_type);
  const category = complaintRequestTypeLabel(input.request_type);

  const { data, error } = await client
    .from("complaints")
    .insert({
      branch_id: input.branch_id,
      source,
      request_type: input.request_type,
      category,
      severity: input.priority,
      priority: input.priority,
      complaint_text: input.complaint_text.trim(),
      customer_name: input.customer_name?.trim() || null,
      customer_phone: input.customer_phone?.trim() || null,
      invoice_number: input.invoice_number?.trim() || null,
      table_number: input.request_type === "hall" ? input.table_number?.trim() || null : null,
      floor: input.request_type === "hall" ? input.floor?.trim() || null : null,
      has_media: input.has_media,
      operator_comment: input.operator_comment?.trim() || null,
      status: "created",
      created_by: input.created_by ?? null,
      jira_sync_status: "pending",
    })
    .select(COMPLAINT_BASE_SELECT)
    .single();

  if (error) {
    throw new Error(getErrorMessage(error, "Не удалось создать задачу"));
  }

  return data as unknown as Complaint;
}
