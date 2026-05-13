"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import InspectionEditor from "@/app/components/inspections/InspectionEditor";
import LoadingState from "@/app/components/LoadingState";
import { useProfile } from "@/app/components/ProfileProvider";
import { useToast } from "@/app/components/ToastProvider";
import { createLinkedInspection } from "@/lib/complaintInspections";
import { resolveLinkedInspection } from "@/lib/complaintWorkflow";
import { fetchComplaints } from "@/lib/complaintsData";
import { getErrorMessage } from "@/lib/errors";
import { buildInspectionPageHref } from "@/lib/inspectionPaths";
import { supabase } from "@/lib/supabase";

export default function NewInspectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useProfile();
  const { pushToast } = useToast();
  const [preparing, setPreparing] = useState(false);

  const complaintId = searchParams.get("complaintId");

  useEffect(() => {
    if (!complaintId) return;

    let cancelled = false;

    const prepareComplaintInspection = async () => {
      setPreparing(true);

      try {
        const complaints = await fetchComplaints(supabase);
        const complaint = complaints.find((item) => item.id === complaintId);

        if (!complaint) {
          pushToast("Заявка не найдена", "error");
          router.replace("/inspections");
          return;
        }

        let inspectionId =
          resolveLinkedInspection(complaint)?.id ?? complaint.inspection_id ?? null;

        if (!inspectionId) {
          inspectionId = await createLinkedInspection(
            supabase,
            complaint,
            session?.user?.id ?? null
          );
        }

        if (cancelled) return;

        router.replace(buildInspectionPageHref(inspectionId));
      } catch (error) {
        if (!cancelled) {
          pushToast(getErrorMessage(error, "Не удалось открыть проверку"), "error");
          router.replace("/inspections");
        }
      } finally {
        if (!cancelled) {
          setPreparing(false);
        }
      }
    };

    void prepareComplaintInspection();

    return () => {
      cancelled = true;
    };
  }, [complaintId, router, session?.user?.id, pushToast]);

  if (complaintId) {
    return (
      <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-6">
        <LoadingState label="Подготовка проверки…" />
      </main>
    );
  }

  if (preparing) {
    return (
      <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-6">
        <LoadingState label="Подготовка проверки…" />
      </main>
    );
  }

  return <InspectionEditor inspectionId={null} />;
}
