"use client";

import Link from "next/link";
import {
  complaintLevelBadgeClass,
  complaintLevelLabel,
  complaintRequestTypeLabel,
  complaintStatusLabel,
  formatComplaintDate,
  jiraSyncBadgeClass,
  jiraSyncStatusLabel,
} from "@/lib/complaints";
import { complaintHandedOffToQc, resolveLinkedInspection } from "@/lib/complaintWorkflow";
import { inspectionStatusLabel } from "@/lib/inspections";
import type { Complaint } from "@/lib/types";

type ApplicationCardProps = {
  complaint: Complaint;
  branchName: string;
  isOperator: boolean;
  canReview: boolean;
  canManualCreate: boolean;
  reviewing: boolean;
  creatingInspection: boolean;
  onSyncJira: (complaintId: string) => void;
  onCreateManualInspection: (complaint: Complaint) => void;
  onReview: (complaint: Complaint) => void;
};

export default function ApplicationCard({
  complaint,
  branchName,
  isOperator,
  canReview,
  canManualCreate,
  reviewing,
  creatingInspection,
  onSyncJira,
  onCreateManualInspection,
  onReview,
}: ApplicationCardProps) {
  const linkedInspection = resolveLinkedInspection(complaint);
  const handedOffToQc = complaintHandedOffToQc(complaint);

  return (
    <article className="rounded-2xl border border-white/10 bg-neutral-950/50 p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{branchName}</h2>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/70">
              {complaintRequestTypeLabel(complaint.request_type)}
            </span>
          </div>
          <p className="mt-2 text-sm text-white/80">{complaint.complaint_text}</p>
          <p className="mt-2 text-xs text-white/50">
            Создано: {formatComplaintDate(complaint.created_at)} · Статус:{" "}
            {complaintStatusLabel(complaint.status)}
          </p>
        </div>

        <ApplicationBadges complaint={complaint} />
      </div>

      <div className="mt-4 grid gap-2 text-sm text-white/70 md:grid-cols-2">
        <p>Клиент: {complaint.customer_phone || "—"}</p>
        <p>Накладная: {complaint.invoice_number || "—"}</p>
        {complaint.request_type === "hall" ? (
          <>
            <p>Столик: {complaint.table_number || "—"}</p>
            <p>Этаж: {complaint.floor || "—"}</p>
          </>
        ) : null}
        <p>Медиа: {complaint.has_media ? "Да" : "Нет"}</p>
        <p>Комментарий: {complaint.operator_comment || "—"}</p>
      </div>

      {isOperator ? (
        <section className="mt-4 rounded-xl border border-white/10 bg-neutral-900/40 p-3 text-sm">
          <p className="font-medium text-white/90">
            {handedOffToQc ? "Передано в QC" : "Ожидает передачи в QC"}
          </p>
          <p className="mt-2 text-white/70">
            Статус проверки:{" "}
            {linkedInspection
              ? inspectionStatusLabel(linkedInspection.status)
              : "Проверка ещё не создана"}
          </p>
          <p className="mt-2 text-white/70">
            Jira:{" "}
            {complaint.jira_issue_url ? (
              <Link
                href={complaint.jira_issue_url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-300 hover:text-blue-200"
              >
                {complaint.jira_issue_key}
              </Link>
            ) : (
              <span className="text-white/50">задача ещё не создана</span>
            )}
          </p>
        </section>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        {canReview && !isOperator ? (
          <button
            type="button"
            onClick={() => onReview(complaint)}
            disabled={reviewing}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {reviewing ? "Открытие…" : "Рассмотреть заявку"}
          </button>
        ) : !linkedInspection ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-amber-100">
            Связанная проверка ещё не создана. QC или администратор может создать её вручную.
          </p>
        ) : null}

        {!isOperator ? (
          complaint.jira_issue_url ? (
            <Link
              href={complaint.jira_issue_url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-300 hover:text-blue-200"
            >
              Jira: {complaint.jira_issue_key}
            </Link>
          ) : (
            <span className="text-white/50">Jira: не создана</span>
          )
        ) : null}

        {canManualCreate && !canReview && !linkedInspection ? (
          <button
            type="button"
            onClick={() => onCreateManualInspection(complaint)}
            disabled={creatingInspection}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
          >
            {creatingInspection ? "Создание…" : "Создать проверку вручную"}
          </button>
        ) : null}

        {complaint.jira_sync_status === "failed" ? (
          <button
            type="button"
            onClick={() => onSyncJira(complaint.id)}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs hover:bg-white/5"
          >
            Повторить синхронизацию
          </button>
        ) : null}
      </div>

      {complaint.jira_sync_error ? (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-200">
          {complaint.jira_sync_error}
        </p>
      ) : null}
    </article>
  );
}

function ApplicationBadges({ complaint }: { complaint: Complaint }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span
        className={`rounded-full border px-2 py-0.5 text-xs ${complaintLevelBadgeClass(complaint.severity)}`}
      >
        Severity: {complaintLevelLabel(complaint.severity)}
      </span>
      <span
        className={`rounded-full border px-2 py-0.5 text-xs ${complaintLevelBadgeClass(complaint.priority)}`}
      >
        Priority: {complaintLevelLabel(complaint.priority)}
      </span>
      <span
        className={`rounded-full border px-2 py-0.5 text-xs ${jiraSyncBadgeClass(complaint.jira_sync_status)}`}
      >
        {jiraSyncStatusLabel(complaint.jira_sync_status)}
      </span>
    </div>
  );
}
