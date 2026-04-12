"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: number;
  full_name: string;
  branch_id: number | null;
};

type Branch = {
  id: number;
  name: string;
};

type Shift = {
  id: number;
  employee_id: number;
  branch_id: number | null;
  shift_date: string;
  shift_type: string;
  employees?: {
    full_name: string;
  }[] | { full_name: string } | null;
  branches?: {
    name: string;
  }[] | { name: string } | null;
};

const shiftOptions = ["День", "Ночь", "Вых", "Отпуск", "Больничный"];
const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function getCurrentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

function normalizeRelation<T>(value: T[] | T | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function getCalendarDays(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);

  const firstDayOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  let firstWeekDay = firstDayOfMonth.getDay();
  if (firstWeekDay === 0) firstWeekDay = 7;

  const leadingEmptyDays = firstWeekDay - 1;
  const totalCells = Math.ceil((leadingEmptyDays + daysInMonth) / 7) * 7;

  const result: Array<{
    date: string | null;
    dayNumber: number | null;
    isCurrentMonth: boolean;
  }> = [];

  for (let i = 0; i < totalCells; i++) {
    const dayNumber = i - leadingEmptyDays + 1;

    if (dayNumber < 1 || dayNumber > daysInMonth) {
      result.push({
        date: null,
        dayNumber: null,
        isCurrentMonth: false,
      });
      continue;
    }

    const iso = `${year}-${String(month).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;

    result.push({
      date: iso,
      dayNumber,
      isCurrentMonth: true,
    });
  }

  return result;
}

function shiftBadgeClass(shiftType: string) {
  switch (shiftType) {
    case "День":
      return "bg-green-600/20 text-green-300 border border-green-500/30";
    case "Ночь":
      return "bg-blue-600/20 text-blue-300 border border-blue-500/30";
    case "Вых":
      return "bg-neutral-700 text-neutral-200 border border-white/10";
    case "Отпуск":
      return "bg-yellow-600/20 text-yellow-300 border border-yellow-500/30";
    case "Больничный":
      return "bg-red-600/20 text-red-300 border border-red-500/30";
    default:
      return "bg-white/10 text-white border border-white/10";
  }
}

export default function ShiftsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    employee_id: "",
    branch_id: "",
    shift_date: "",
    shift_type: "День",
  });

  const fetchData = async () => {
    const { data: employeesData, error: employeesError } = await supabase
      .from("employees")
      .select("id, full_name, branch_id")
      .order("full_name", { ascending: true });

    const { data: branchesData, error: branchesError } = await supabase
      .from("branches")
      .select("id, name")
      .order("name", { ascending: true });

    const startDate = `${selectedMonth}-01`;
    const [year, month] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

    const { data: shiftsData, error: shiftsError } = await supabase
      .from("shifts")
      .select("id, employee_id, branch_id, shift_date, shift_type, employees(full_name), branches(name)")
      .gte("shift_date", startDate)
      .lte("shift_date", endDate)
      .order("shift_date", { ascending: true });

    if (employeesError) console.error("Ошибка загрузки сотрудников:", employeesError);
    if (branchesError) console.error("Ошибка загрузки филиалов:", branchesError);
    if (shiftsError) console.error("Ошибка загрузки смен:", shiftsError);

    setEmployees((employeesData as Employee[]) || []);
    setBranches((branchesData as Branch[]) || []);
    setShifts((shiftsData as Shift[]) || []);
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const handleSave = async () => {
    if (!form.employee_id || !form.shift_date || !form.shift_type) return;

    const selectedEmployee = employees.find(
      (emp) => emp.id === Number(form.employee_id)
    );

    const branchIdToSave =
      form.branch_id !== ""
        ? Number(form.branch_id)
        : selectedEmployee?.branch_id ?? null;

    const { error } = await supabase.from("shifts").insert([
      {
        employee_id: Number(form.employee_id),
        branch_id: branchIdToSave,
        shift_date: form.shift_date,
        shift_type: form.shift_type,
      },
    ]);

    if (error) {
      console.error("Ошибка сохранения смены:", error);
      return;
    }

    setForm({
      employee_id: "",
      branch_id: "",
      shift_date: "",
      shift_type: "День",
    });
    setShowForm(false);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("shifts").delete().eq("id", id);

    if (error) {
      console.error("Ошибка удаления смены:", error);
      return;
    }

    fetchData();
  };

  const groupedShifts = useMemo(() => {
    const grouped: Record<string, Shift[]> = {};

    shifts.forEach((shift) => {
      if (!grouped[shift.shift_date]) grouped[shift.shift_date] = [];
      grouped[shift.shift_date].push(shift);
    });

    return grouped;
  }, [shifts]);

  const calendarDays = useMemo(() => getCalendarDays(selectedMonth), [selectedMonth]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">График смен</h1>
            <p className="text-white/60 mt-2">
              Календарь смен сотрудников по дням месяца
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-2"
            />

            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg"
            >
              + Добавить смену
            </button>
          </div>
        </div>

        {showForm && (
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 mb-6">
            <h2 className="text-xl font-semibold mb-4">Новая смена</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={form.employee_id}
                onChange={(e) =>
                  setForm({ ...form, employee_id: e.target.value })
                }
                className="bg-neutral-800 p-3 rounded-lg"
              >
                <option value="">Выбери сотрудника</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </option>
                ))}
              </select>

              <select
                value={form.branch_id}
                onChange={(e) =>
                  setForm({ ...form, branch_id: e.target.value })
                }
                className="bg-neutral-800 p-3 rounded-lg"
              >
                <option value="">Филиал по сотруднику</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={form.shift_date}
                onChange={(e) =>
                  setForm({ ...form, shift_date: e.target.value })
                }
                className="bg-neutral-800 p-3 rounded-lg"
              />

              <select
                value={form.shift_type}
                onChange={(e) =>
                  setForm({ ...form, shift_type: e.target.value })
                }
                className="bg-neutral-800 p-3 rounded-lg"
              >
                {shiftOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg"
              >
                Сохранить
              </button>

              <button
                onClick={() => setShowForm(false)}
                className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-lg"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        <div className="mb-4">
          <h2 className="text-2xl font-semibold capitalize">
            {getMonthLabel(selectedMonth)}
          </h2>
        </div>

        <div
          className="grid gap-2 mb-2"
          style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
        >
          {weekDays.map((day) => (
            <div
              key={day}
              className="rounded-xl bg-neutral-900 border border-white/10 p-3 text-center text-sm text-white/70"
            >
              {day}
            </div>
          ))}
        </div>

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
        >
          {calendarDays.map((day, index) => {
            const dayShifts = day.date ? groupedShifts[day.date] || [] : [];

            return (
              <div
                key={`${day.date}-${index}`}
                className={`rounded-2xl border p-3 min-h-[160px] ${
                  day.isCurrentMonth
                    ? "bg-neutral-900 border-white/10"
                    : "bg-neutral-950 border-white/5 opacity-40"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">
                    {day.dayNumber ?? ""}
                  </span>
                  {day.isCurrentMonth && dayShifts.length > 0 && (
                    <span className="text-xs text-white/50">
                      {dayShifts.length} смен
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {day.isCurrentMonth &&
                    dayShifts.map((shift) => {
                      const employee = normalizeRelation(shift.employees);
                      const branch = normalizeRelation(shift.branches);

                      return (
                        <div
                          key={shift.id}
                          className="rounded-xl bg-white/5 p-2"
                        >
                          <p className="text-sm font-medium leading-tight truncate">
                            {employee?.full_name || "Без имени"}
                          </p>

                          <p className="text-xs text-white/50 mt-1 truncate">
                            {branch?.name || "Без филиала"}
                          </p>

                          <div className="flex items-center justify-between gap-2 mt-2">
                            <span
                              className={`text-xs px-2 py-1 rounded-lg ${shiftBadgeClass(
                                shift.shift_type
                              )}`}
                            >
                              {shift.shift_type}
                            </span>

                            <button
                              onClick={() => handleDelete(shift.id)}
                              className="text-xs text-red-300 hover:text-red-200"
                            >
                              удалить
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}