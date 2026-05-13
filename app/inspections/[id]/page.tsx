"use client";

import { use } from "react";
import InspectionEditor from "@/app/components/inspections/InspectionEditor";

type InspectionDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function InspectionDetailPage({ params }: InspectionDetailPageProps) {
  const { id } = use(params);
  const inspectionId = Number(id);

  if (!Number.isFinite(inspectionId) || inspectionId <= 0) {
    return null;
  }

  return <InspectionEditor inspectionId={inspectionId} />;
}
