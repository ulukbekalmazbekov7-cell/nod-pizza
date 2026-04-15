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

export default function Home() {
  const [inspectionChartData, setInspectionChartData] = useState<InspectionChartItem[]>([]);
  const [inspectionsCount, setInspectionsCount] = useState(0);
  const [branchesCount, setBranchesCount] = useState(0);
  const [employeesCount, setEmployeesCount] = useState(0);

  useEffect(() => {
    const fetchDashboard = async () => {
      const { data: branchesData } = await supabase.from("branches").select("id, name");
      setBranchesCount(branchesData?.length || 0);

      const { data: employeesData } = await supabase.from("employees").select("id");
      setEmployeesCount(employeesData?.length || 0);

      const { data: inspectionsData } = await supabase
        .from("inspections")
        .select("branch_id, branches(name)");

      const grouped: Record<string, number> = {};
      (inspectionsData || []).forEach((item: any) => {
        const name = item.branches?.name || "Без филиала";
        grouped[name] = (grouped[name] || 0) + 1;
      });

      const result = Object.entries(grouped).map(([name, count]) => ({
        name,
        inspections: count,
      }));

      setInspectionChartData(result);
      setInspectionsCount((inspectionsData || []).length);
    };

    fetchDashboard();
  }, []);

  const recentChecks = [
    { branch: "Нод Пицца Аламедин", date: "12.04.2026", score: "88%", status: "Есть замечания" },
    { branch: "Нод Пицца Азия Молл", date: "11.04.2026", score: "94%", status: "Хорошо" },
    { branch: "Нод Пицца Дордой", date: "10.04.2026", score: "76%", status: "Критично" },
  ];

  const branchesPreview = [
    { name: "Аламедин", manager: "Айбек", status: "Активный" },
    { name: "Азия Молл", manager: "Нурсултан", status: "Активный" },
    { name: "Дордой", manager: "Мээрим", status: "На контроле" },
  ];

  const stats = [
    { title: "Проверки", value: String(inspectionsCount) },
    { title: "Активные филиалы", value: String(branchesCount) },
    { title: "Сотрудники", value: String(employeesCount) },
    { title: "Критические ошибки", value: "12" },
  ];

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="flex">
        <aside className="hidden min-h-screen w-64 flex-col border-r border-white/10 bg-neutral-900/60 p-5 md:flex">
          <div className="mb-8">
            <h1 className="text-2xl font-bold">НОД Пицца</h1>
            <p className="mt-1 text-sm text-white/60">QC Портал</p>
          </div>

          <nav className="space-y-2 text-sm">
            <Link href="/" className="block rounded-xl bg-white/10 px-4 py-3">
              Главная
            </Link>

            <Link href="/shifts" className="block rounded-xl px-4 py-3 hover:bg-white/5">
              График смен
            </Link>

            <Link href="/inspections" className="block rounded-xl px-4 py-3 hover:bg-white/5">
              Проверки
            </Link>

            <Link href="/branches" className="block rounded-xl px-4 py-3 hover:bg-white/5">
              Филиалы
            </Link>

            <Link href="/employees" className="block rounded-xl px-4 py-3 hover:bg-white/5">
              Сотрудники
            </Link>
          </nav>
        </aside>

        <section className="flex-1 p-5 md:p-8">
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
                <span className="text-sm text-white/50">Последние 3 записи</span>
              </div>

              <div className="space-y-3">
                {recentChecks.map((check) => (
                  <div
                    key={`${check.branch}-${check.date}`}
                    className="flex flex-col gap-3 rounded-xl bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium">{check.branch}</p>
                      <p className="text-sm text-white/50">Дата: {check.date}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <p className="text-lg font-semibold">{check.score}</p>
                      <span className="rounded-lg bg-white/10 px-3 py-1 text-sm">
                        {check.status}
                      </span>
                    </div>
                  </div>
                ))}
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
                {branchesPreview.map((branch) => (
                  <div key={branch.name} className="rounded-xl bg-white/5 p-4">
                    <p className="font-medium">{branch.name}</p>
                    <p className="mt-1 text-sm text-white/50">
                      Ответственный: {branch.manager}
                    </p>
                    <p className="mt-2 text-sm">{branch.status}</p>
                  </div>
                ))}
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
        </section>
      </div>
    </main>
  );
}