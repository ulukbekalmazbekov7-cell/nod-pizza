"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ShiftCalendar from "./components/Calendar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type InspectionChartItem = {
  name: string;
  inspections: number;
};

type BranchRow = {
  id?: number;
  name: string;
  manager: string;
  status: string;
};

type InspectionRow = {
  id?: number;
  branch_id?: number;
  score: number | null;
  created_at?: string;
  inspector?: string | null;
  branches?: { name: string } | { name: string }[] | null;
};

function scoreStatus(score: number) {
  if (score >= 90) return "Хорошо";
  if (score >= 70) return "Есть замечания";
  return "Критично";
}

function inspectionBranchName(item: InspectionRow): string {
  const b = item.branches;
  if (!b) return "Без филиала";
  if (Array.isArray(b)) return b[0]?.name ?? "Без филиала";
  return b.name ?? "Без филиала";
}

function formatInspectionDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU");
}

export default function Home() {
  const [inspectionChartData, setInspectionChartData] = useState<InspectionChartItem[]>([]);
  const [inspectionsCount, setInspectionsCount] = useState(0);
  const [branchesCount, setBranchesCount] = useState(0);
  const [employeesCount, setEmployeesCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [recentInspections, setRecentInspections] = useState<InspectionRow[]>([]);
  const [branchesPreview, setBranchesPreview] = useState<BranchRow[]>([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      const { data: branchesData } = await supabase
        .from("branches")
        .select("*")
        .order("created_at", { ascending: false });

      setBranchesCount(branchesData?.length || 0);
      setBranchesPreview((branchesData || []).slice(0, 3));

      const { data: employeesData } = await supabase.from("employees").select("id");
      setEmployeesCount(employeesData?.length || 0);

      const { data: inspectionsData } = await supabase
        .from("inspections")
        .select("branch_id, score, created_at, inspector, branches(name)")
        .order("created_at", { ascending: false });

      const list = (inspectionsData ?? []) as unknown as InspectionRow[];
      setInspectionsCount(list.length);
      setCriticalCount(list.filter((i) => Number(i.score) < 60).length);
      setRecentInspections(list.slice(0, 3));

      const grouped: Record<string, number> = {};
      list.forEach((item) => {
        const name = inspectionBranchName(item);
        grouped[name] = (grouped[name] || 0) + 1;
      });

      const result = Object.entries(grouped).map(([name, count]) => ({
        name,
        inspections: count,
      }));

      setInspectionChartData(result);
    };

    fetchDashboard();
  }, []);

  const stats = [
    { title: "Проверки", value: String(inspectionsCount) },
    { title: "Активные филиалы", value: String(branchesCount) },
    { title: "Сотрудники", value: String(employeesCount) },
    { title: "Критические проверки (<60 баллов)", value: String(criticalCount) },
  ];

  return (
    <main className="min-h-screen bg-neutral-950 p-5 text-white md:p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold">Дашборд контроля качества</h2>
          <p className="mt-2 text-white/60">
            Обзор проверок, филиалов, сотрудников и критических замечаний
          </p>
        </div>

        <Link
          href="/inspections"
          className="inline-flex rounded-xl bg-green-600 px-5 py-3 font-medium hover:bg-green-500"
        >
          + Новая проверка
        </Link>
      </div>

      <div className="mb-8 rounded-2xl border border-white/10 bg-neutral-900 p-5">
        <h3 className="mb-4 text-xl font-semibold">График смен</h3>
        <ShiftCalendar />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold">Последние проверки</h3>
            <span className="text-sm text-white/50">Последние записи</span>
          </div>

          <div className="space-y-3">
            {recentInspections.length === 0 ? (
              <p className="rounded-xl bg-white/5 p-4 text-white/50">Пока нет проверок в базе</p>
            ) : (
              recentInspections.map((check) => {
                const name = inspectionBranchName(check);
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
                        Дата: {formatInspectionDate(check.created_at)}
                        {check.inspector ? ` · ${check.inspector}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <p className="text-lg font-semibold">{label}</p>
                      <span className="rounded-lg bg-white/10 px-3 py-1 text-sm">{status}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold">Филиалы</h3>
            <Link
              href="/branches"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500"
            >
              + Добавить
            </Link>
          </div>

          <div className="space-y-3">
            {branchesPreview.length === 0 ? (
              <p className="rounded-xl bg-white/5 p-4 text-white/50">Нет филиалов в базе</p>
            ) : (
              branchesPreview.map((branch) => (
                <div key={branch.id ?? branch.name} className="rounded-xl bg-white/5 p-4">
                  <p className="font-medium">{branch.name}</p>
                  <p className="mt-1 text-sm text-white/50">
                    Ответственный: {branch.manager || "—"}
                  </p>
                  <p className="mt-2 text-sm">{branch.status || "—"}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
          <h3 className="mb-3 text-xl font-semibold">График проверок филиалов</h3>
          <div className="mx-auto h-80 w-full max-w-[1000px]">
            {inspectionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={inspectionChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                >
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
      </div>
    </main>
  );
}
