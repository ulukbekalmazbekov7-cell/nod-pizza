"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type EmployeeChartItem = {
  name: string;
  employees: number;
};

type InspectionChartItem = {
  name: string;
  inspections: number;
};

export default function Home() {
  const [employeeChartData, setEmployeeChartData] = useState<EmployeeChartItem[]>([]);
  const [inspectionChartData, setInspectionChartData] = useState<InspectionChartItem[]>([]);
  const [employeesCount, setEmployeesCount] = useState(0);
  const [inspectionsCount, setInspectionsCount] = useState(0);
  const [branchesCount, setBranchesCount] = useState(0);

  useEffect(() => {
    const fetchDashboard = async () => {
      const { data: branchesData } = await supabase.from("branches").select("id, name");
      setBranchesCount(branchesData?.length || 0);

      const { data: emp } = await supabase
        .from("employees")
        .select("branch_id, branches(name)");

      const empGrouped: Record<string, number> = {};
      (emp || []).forEach((item: any) => {
        const name = item.branches?.name || "Без филиала";
        empGrouped[name] = (empGrouped[name] || 0) + 1;
      });

      const empResult = Object.entries(empGrouped).map(([name, count]) => ({
        name,
        employees: count,
      }));

      setEmployeeChartData(empResult);
      setEmployeesCount((emp || []).length);

      const { data: insp } = await supabase
        .from("inspections")
        .select("branch_id, branches(name)");

      const inspGrouped: Record<string, number> = {};
      (insp || []).forEach((item: any) => {
        const name = item.branches?.name || "Без филиала";
        inspGrouped[name] = (inspGrouped[name] || 0) + 1;
      });

      const inspResult = Object.entries(inspGrouped).map(([name, count]) => ({
        name,
        inspections: count,
      }));

      setInspectionChartData(inspResult);
      setInspectionsCount((insp || []).length);
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
        <aside className="hidden md:flex w-64 min-h-screen border-r border-white/10 bg-neutral-900/60 p-5 flex-col">
          <div className="mb-8">
            <h1 className="text-2xl font-bold">НОД Пицца</h1>
            <p className="text-sm text-white/60 mt-1">QC Портал</p>
          </div>

          <nav className="space-y-2 text-sm">
  <Link href="/" className="block rounded-xl bg-white/10 px-4 py-3">
    Главная
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

  <Link href="/shifts" className="block rounded-xl px-4 py-3 hover:bg-white/5">
    График смен
  </Link>
</nav>
        </aside>

        <section className="flex-1 p-5 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold">Дашборд контроля качества</h2>
              <p className="text-white/60 mt-2">
                Обзор проверок, филиалов, сотрудников и критических замечаний
              </p>
            </div>

            <Link
              href="/inspections"
              className="inline-flex rounded-xl bg-green-600 hover:bg-green-500 px-5 py-3 font-medium"
            >
              + Новая проверка
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
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

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-2xl border border-white/10 bg-neutral-900 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Последние проверки</h3>
                <span className="text-sm text-white/50">Последние 3 записи</span>
              </div>

              <div className="space-y-3">
                {recentChecks.map((check) => (
                  <div
                    key={`${check.branch}-${check.date}`}
                    className="rounded-xl bg-white/5 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Филиалы</h3>
                <Link
                  href="/branches"
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-2 text-sm"
                >
                  + Добавить
                </Link>
              </div>

              <div className="space-y-3">
                {branchesPreview.map((branch) => (
                  <div key={branch.name} className="rounded-xl bg-white/5 p-4">
                    <p className="font-medium">{branch.name}</p>
                    <p className="text-sm text-white/50 mt-1">
                      Ответственный: {branch.manager}
                    </p>
                    <p className="text-sm mt-2">{branch.status}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
            <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
              <h3 className="text-xl font-semibold mb-3">График сотрудников</h3>
              <div className="h-80 w-full">
                {employeeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={employeeChartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="name" stroke="#aaa" />
                      <YAxis stroke="#aaa" allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="employees" fill="#16a34a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/40">
                    Нет данных по сотрудникам
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
              <h3 className="text-xl font-semibold mb-3">График проверок филиалов</h3>
              <div className="h-80 w-full">
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
                  <div className="h-full flex items-center justify-center text-white/40">
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