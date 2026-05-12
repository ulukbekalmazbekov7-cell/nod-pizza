"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LoadingState from "@/app/components/LoadingState";
import { useProfile } from "@/app/components/ProfileProvider";
import { canManageBranches, canManageEmployees } from "@/lib/auth/roles";
import {
  formatInspectionDate,
  inspectionBranchName,
  isViolation,
  scoreStatus,
} from "@/lib/inspections";
import { supabase } from "@/lib/supabase";
import type { Branch, Inspection } from "@/lib/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type InspectionChartItem = {
  name: string;
  inspections: number;
};

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default function Home() {
  const { profile, loading: profileLoading } = useProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchesCount, setBranchesCount] = useState(0);
  const [employeesCount, setEmployeesCount] = useState(0);
  const [monthlyInspections, setMonthlyInspections] = useState(0);
  const [violationsCount, setViolationsCount] = useState(0);
  const [shiftsToday, setShiftsToday] = useState(0);
  const [recentInspections, setRecentInspections] = useState<Inspection[]>([]);
  const [branchesPreview, setBranchesPreview] = useState<Branch[]>([]);
  const [inspectionChartData, setInspectionChartData] = useState<InspectionChartItem[]>([]);

  useEffect(() => {
    if (profileLoading) return;

    const fetchDashboard = async () => {
      setLoading(true);
      setError(null);

      const monthStart = monthStartIso();
      const today = new Date();
      const dayIndex = today.getDate() - 1;
      const periodLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

      const [
        { data: branchesData, error: branchesError },
        { data: employeesData, error: employeesError },
        { data: inspectionsData, error: inspectionsError },
        { data: shiftRows, error: shiftError },
      ] = await Promise.all([
        supabase.from("branches").select("*").order("created_at", { ascending: false }),
        supabase.from("employees").select("id"),
        supabase
          .from("inspections")
          .select("id, branch_id, score, created_at, inspector, status, branches(name)")
          .gte("created_at", monthStart)
          .order("created_at", { ascending: false }),
        supabase.from("shift_schedule_snapshots").select("payload").limit(20),
      ]);

      if (branchesError || employeesError || inspectionsError) {
        setError(
          branchesError?.message || employeesError?.message || inspectionsError?.message || "Ошибка загрузки"
        );
        setLoading(false);
        return;
      }

      const branches = (branchesData ?? []) as Branch[];
      const inspections = (inspectionsData ?? []) as Inspection[];

      setBranchesCount(branches.length);
      setBranchesPreview(branches.slice(0, 3));
      setEmployeesCount(employeesData?.length ?? 0);
      setMonthlyInspections(inspections.length);
      setViolationsCount(inspections.filter((item) => isViolation(item.score)).length);
      setRecentInspections(inspections.slice(0, 5));

      const grouped: Record<string, number> = {};
      inspections.forEach((item) => {
        const name = inspectionBranchName(item.branches);
        grouped[name] = (grouped[name] || 0) + 1;
      });
      setInspectionChartData(
        Object.entries(grouped).map(([name, count]) => ({ name, inspections: count }))
      );

      if (!shiftError && shiftRows && shiftRows.length > 0) {
        let count = 0;
        for (const row of shiftRows) {
          const payload = row.payload as {
            periodLabel?: string;
            employees?: Array<{ shifts?: string[] }>;
          };
          if (payload.periodLabel && payload.periodLabel !== periodLabel) continue;
          payload.employees?.forEach((employee) => {
            const shift = employee.shifts?.[dayIndex];
            if (shift === "Д" || shift === "Н") count += 1;
          });
        }
        setShiftsToday(count);
      } else {
        setShiftsToday(0);
      }

      setLoading(false);
    };

    void fetchDashboard();
  }, [profileLoading]);

  const stats = useMemo(
    () => [
      { title: "Филиалы", value: String(branchesCount) },
      { title: "Сотрудники", value: String(employeesCount) },
      { title: "Проверки за месяц", value: String(monthlyInspections) },
      { title: "Нарушения / проблемы", value: String(violationsCount) },
      { title: "Смены сегодня", value: String(shiftsToday) },
    ],
    [branchesCount, employeesCount, monthlyInspections, violationsCount, shiftsToday]
  );

  if (profileLoading || loading) {
    return (
      <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-8">
        <LoadingState label="Загрузка дашборда…" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-8">
      <DashboardHeader profileRole={profile?.role ?? "—"} />

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-950/40 p-4 text-red-100">
          {error}
        </div>
      ) : null}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-white/10 bg-neutral-900 p-5 shadow-lg"
          >
            <p className="text-sm text-white/60">{item.title}</p>
            <p className="mt-3 text-3xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      <DashboardQuickActions profile={profile} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <DashboardRecent inspections={recentInspections} />
        <DashboardBranches profile={profile} branches={branchesPreview} />
      </div>

      <DashboardChart data={inspectionChartData} />
    </main>
  );
}

function DashboardHeader({ profileRole }: { profileRole: string }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <DashboardHeaderText profileRole={profileRole} />
      <Link
        href="/inspections"
        className="inline-flex rounded-xl bg-green-600 px-5 py-3 font-medium hover:bg-green-500"
      >
        + Новая проверка
      </Link>
    </div>
  );
}

function DashboardHeaderText({ profileRole }: { profileRole: string }) {
  return (
    <div>
      <h2 className="text-3xl font-bold">Дашборд контроля качества</h2>
      <p className="mt-2 text-white/60">Обзор филиалов, проверок и смен для роли {profileRole}</p>
    </div>
  );
}

function DashboardQuickActions({
  profile,
}: {
  profile: ReturnType<typeof useProfile>["profile"];
}) {
  return (
    <div className="mb-8 rounded-2xl border border-white/10 bg-neutral-900 p-5">
      <h3 className="mb-4 text-xl font-semibold">Быстрые действия</h3>
      <div className="flex flex-wrap gap-3">
        <Link href="/inspections" className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
          Создать проверку
        </Link>
        <Link href="/shifts" className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
          Открыть график смен
        </Link>
        {canManageBranches(profile) ? (
          <Link href="/branches" className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
            Управлять филиалами
          </Link>
        ) : null}
        {canManageEmployees(profile) ? (
          <Link href="/employees" className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
            Управлять сотрудниками
          </Link>
        ) : null}
        {profile?.role === "admin" ? (
          <Link href="/audit" className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
            Журнал аудита
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function DashboardRecent({ inspections }: { inspections: Inspection[] }) {
  return (
    <DashboardRecentCard>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold">Последние инспекции</h3>
        <Link href="/inspections" className="text-sm text-blue-400 hover:text-blue-300">
          Все проверки
        </Link>
      </div>

      <div className="space-y-3">
        {inspections.length === 0 ? (
          <p className="rounded-xl bg-white/5 p-4 text-white/50">Пока нет проверок за текущий месяц</p>
        ) : (
          inspections.map((check) => {
            const name = inspectionBranchName(check.branches);
            const scoreNum = Number(check.score);
            const label = Number.isFinite(scoreNum) ? `${scoreNum}%` : "—";
            const status = Number.isFinite(scoreNum) ? scoreStatus(scoreNum) : "—";

            return (
              <div
                key={check.id ?? `${check.created_at}-${check.inspector}`}
                className="flex flex-col gap-3 rounded-xl bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-sm text-white/50">
                    {formatInspectionDate(check.created_at)}
                    {check.inspector ? ` · ${check.inspector}` : ""}
                  </p>
                </div>

                <DashboardRecentScore label={label} status={status} />
              </div>
            );
          })
        )}
      </div>
    </DashboardRecentCard>
  );
}

function DashboardRecentCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5 xl:col-span-2">{children}</div>
  );
}

function DashboardRecentScore({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center gap-4">
      <p className="text-lg font-semibold">{label}</p>
      <span className="rounded-lg bg-white/10 px-3 py-1 text-sm">{status}</span>
    </div>
  );
}

function DashboardBranches({
  profile,
  branches,
}: {
  profile: ReturnType<typeof useProfile>["profile"];
  branches: Branch[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold">Филиалы</h3>
        {canManageBranches(profile) ? (
          <Link href="/branches" className="rounded-lg bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500">
            + Добавить
          </Link>
        ) : null}
      </div>

      <div className="space-y-3">
        {branches.length === 0 ? (
          <p className="rounded-xl bg-white/5 p-4 text-white/50">Нет доступных филиалов</p>
        ) : (
          branches.map((branch) => (
            <DashboardBranchItem key={branch.id ?? branch.name} branch={branch} />
          ))
        )}
      </div>
    </div>
  );
}

function DashboardBranchItem({ branch }: { branch: Branch }) {
  return (
    <div className="rounded-xl bg-white/5 p-4">
      <p className="font-medium">{branch.name}</p>
      <p className="mt-1 text-sm text-white/50">Ответственный: {branch.manager || "—"}</p>
      <p className="mt-2 text-sm">{branch.status || "—"}</p>
    </div>
  );
}

function DashboardChart({ data }: { data: InspectionChartItem[] }) {
  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-neutral-900 p-5">
      <h3 className="mb-3 text-xl font-semibold">Проверки по филиалам (месяц)</h3>
      <div className="mx-auto h-80 w-full max-w-[1000px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#aaa" />
              <YAxis stroke="#aaa" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="inspections" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-white/40">
            Нет данных по проверкам
          </div>
        )}
      </div>
    </div>
  );
}
