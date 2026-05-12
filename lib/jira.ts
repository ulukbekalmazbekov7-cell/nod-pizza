import type { Complaint } from "@/lib/types";
import {
  complaintLevelLabel,
  complaintRequestTypeLabel,
  complaintSourceLabel,
  formatComplaintDate,
} from "@/lib/complaints";

type JiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  defaultAssigneeAccountId?: string;
  qcLabel?: string;
};

type JiraCreateResult = {
  issueKey: string;
  issueUrl: string;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function jiraAuthHeader(email: string, apiToken: string) {
  const token = Buffer.from(`${email}:${apiToken}`).toString("base64");
  return `Basic ${token}`;
}

function jiraAdfDescription(lines: string[]) {
  return {
    type: "doc",
    version: 1,
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

export function readJiraConfig(): JiraConfig | null {
  const baseUrl = process.env.JIRA_BASE_URL?.trim();
  const email = process.env.JIRA_EMAIL?.trim();
  const apiToken = process.env.JIRA_API_TOKEN?.trim();
  const projectKey = process.env.JIRA_PROJECT_KEY?.trim();

  if (!baseUrl || !email || !apiToken || !projectKey) {
    return null;
  }

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    email,
    apiToken,
    projectKey,
    defaultAssigneeAccountId: process.env.JIRA_DEFAULT_ASSIGNEE_ACCOUNT_ID?.trim() || undefined,
    qcLabel: process.env.JIRA_QC_LABEL?.trim() || undefined,
  };
}

export function buildJiraSummary(complaint: Complaint, branchName: string) {
  const reference = complaint.invoice_number?.trim() || complaint.customer_phone?.trim() || "без номера";
  return `[Заявка] ${branchName} — ${reference}`;
}

export function buildJiraDescription(input: {
  complaint: Complaint;
  branchName: string;
  creatorLabel: string;
}) {
  const { complaint, branchName, creatorLabel } = input;

  return jiraAdfDescription([
    `Филиал: ${branchName}`,
    `Источник: ${complaintSourceLabel(complaint.source)}`,
    `Тип обращения: ${complaintRequestTypeLabel(complaint.request_type)}`,
    `Категория: ${complaint.category || "—"}`,
    `Severity: ${complaintLevelLabel(complaint.severity)}`,
    `Priority: ${complaintLevelLabel(complaint.priority)}`,
    `Номер клиента: ${complaint.customer_phone || "—"}`,
    `Номер накладной: ${complaint.invoice_number || "—"}`,
    `Столик: ${complaint.table_number || "—"}`,
    `Этаж: ${complaint.floor || "—"}`,
    `Суть жалобы: ${complaint.complaint_text}`,
    `Есть фото/видео: ${complaint.has_media ? "Да" : "Нет"}`,
    `Комментарий оператора: ${complaint.operator_comment || "—"}`,
    `Кто создал: ${creatorLabel}`,
    `Дата: ${formatComplaintDate(complaint.created_at)}`,
    `ID задачи в NOD: ${complaint.id}`,
  ]);
}

export async function createJiraIssueForComplaint(input: {
  complaint: Complaint;
  branchName: string;
  creatorLabel: string;
  config: JiraConfig;
}): Promise<JiraCreateResult> {
  const { complaint, branchName, creatorLabel, config } = input;
  const labels = ["nod", "qc", "complaint"];
  if (config.qcLabel) labels.push(config.qcLabel);

  const fields: Record<string, unknown> = {
    project: { key: config.projectKey },
    issuetype: { name: "Task" },
    summary: buildJiraSummary(complaint, branchName),
    description: buildJiraDescription({ complaint, branchName, creatorLabel }),
    labels,
  };

  if (config.defaultAssigneeAccountId) {
    fields.assignee = { accountId: config.defaultAssigneeAccountId };
  }

  const response = await fetch(`${config.baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: jiraAuthHeader(config.email, config.apiToken),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { key?: string; errorMessages?: string[]; errors?: Record<string, string> }
    | null;

  if (!response.ok) {
    const details =
      payload?.errorMessages?.join("; ") ||
      (payload?.errors ? Object.values(payload.errors).join("; ") : null) ||
      `Jira API ${response.status}`;
    throw new Error(details);
  }

  const issueKey = payload?.key;
  if (!issueKey) {
    throw new Error("Jira не вернула ключ задачи");
  }

  return {
    issueKey,
    issueUrl: `${config.baseUrl}/browse/${issueKey}`,
  };
}
