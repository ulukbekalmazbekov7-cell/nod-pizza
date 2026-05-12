import { NextResponse } from "next/server";
import { createJiraIssueForComplaint, readJiraConfig } from "@/lib/jira";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Complaint } from "@/lib/types";

type CreateIssueBody = {
  complaintId?: string;
};

const COMPLAINT_SELECT =
  "id, branch_id, source, request_type, category, severity, priority, complaint_text, customer_name, customer_phone, invoice_number, table_number, floor, has_media, operator_comment, status, created_by, created_at, updated_at, jira_issue_key, jira_issue_url, jira_sync_status, jira_sync_error, branches(name)";

export async function POST(request: Request) {
  let body: CreateIssueBody;

  try {
    body = (await request.json()) as CreateIssueBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!body.complaintId) {
    return NextResponse.json({ error: "complaintId обязателен" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { data: complaintRow, error: complaintError } = await supabase
    .from("complaints")
    .select(COMPLAINT_SELECT)
    .eq("id", body.complaintId)
    .maybeSingle();

  if (complaintError) {
    return NextResponse.json({ error: complaintError.message }, { status: 500 });
  }

  if (!complaintRow) {
    return NextResponse.json({ error: "Жалоба не найдена или недоступна" }, { status: 404 });
  }

  const complaint = complaintRow as unknown as Complaint;
  const branchName = complaint.branches?.name ?? `Филиал #${complaint.branch_id}`;

  const { data: creatorProfile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", complaint.created_by ?? user.id)
    .maybeSingle();

  const creatorLabel =
    creatorProfile?.full_name?.trim() ||
    user.email?.trim() ||
    complaint.created_by ||
    user.id;

  const jiraConfig = readJiraConfig();
  if (!jiraConfig) {
    const message = "Jira env variables are not configured";
    const { data: failedRow, error: updateError } = await supabase
      .from("complaints")
      .update({
        jira_sync_status: "failed",
        jira_sync_error: message,
      })
      .eq("id", complaint.id)
      .select(COMPLAINT_SELECT)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      complaint: failedRow,
      jira_sync_status: "failed",
      jira_sync_error: message,
    });
  }

  try {
    const jiraIssue = await createJiraIssueForComplaint({
      complaint,
      branchName,
      creatorLabel,
      config: jiraConfig,
    });

    const { data: updatedRow, error: updateError } = await supabase
      .from("complaints")
      .update({
        jira_issue_key: jiraIssue.issueKey,
        jira_issue_url: jiraIssue.issueUrl,
        jira_sync_status: "success",
        jira_sync_error: null,
        status: complaint.status === "created" ? "assigned" : complaint.status,
      })
      .eq("id", complaint.id)
      .select(COMPLAINT_SELECT)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      complaint: updatedRow,
      jira_issue_key: jiraIssue.issueKey,
      jira_issue_url: jiraIssue.issueUrl,
      jira_sync_status: "success",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Jira sync failed";

    const { data: failedRow, error: updateError } = await supabase
      .from("complaints")
      .update({
        jira_sync_status: "failed",
        jira_sync_error: message,
      })
      .eq("id", complaint.id)
      .select(COMPLAINT_SELECT)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      complaint: failedRow,
      jira_sync_status: "failed",
      jira_sync_error: message,
    });
  }
}
