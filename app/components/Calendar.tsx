"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useProfile } from "@/app/components/ProfileProvider";
import { writeAuditLog } from "@/lib/audit";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  buildPayload,
  buildShiftScheduleSlug,
  loadShiftSchedule,
  parseStoredPayload,
  saveShiftSchedule,
  type ShiftScheduleAssignments,
  type ShiftScheduleEmployee,
} from "@/lib/shiftSchedule";

type ShiftType = "Д" | "Н" | "В";

const DAYS_IN_MONTH = 30;

const branches = [
  "АЛАМЕДИН",
  "ПОЛИТЕХ",
  "ТЭЦ",
  "ВЕФА",
  "8 МКР",
  "12 МКР",
  "I-MALL",
  "КЫЗЫЛ АСКЕР",
  "ПЛОЩАДЬ",
  "БИШКЕК ПАРК",
  "ОШСКИЙ",
  "7 МКР",
  "АЗИЯ МОЛЛ",
  "6 МКР",
  "ГУМ",
  "МТФ",
  "ОЗЕРО СОРОКА",
  "10 МКР",
  "АЛА АРЧА",
];

const initialEmployees: ShiftScheduleEmployee[] = [
  {
    id: 1,
    name: "Алмазбек уулу Улукбек",
    position: "Специалист 2к",
    shifts: ["Д", "Д", "Д", "В", "В", "Д", "Д", "Д", "Д", "Д", "В", "В", "Д", "Д", "Д", "Д", "Д", "В", "В", "Д", "Д", "Д", "Д", "Д", "В", "В", "Д", "Д", "Д", "Д"],
  },
  {
    id: 2,
    name: "Ашунова Гузаля",
    position: "Специалист 2к",
    shifts: ["Д", "Д", "Н", "Н", "В", "В", "Д", "Д", "Н", "Н", "В", "В", "Д", "Д", "Н", "Н", "В", "В", "Д", "Д", "Н", "Н", "В", "В", "Д", "Д", "Н", "Н", "В", "В"],
  },
  {
    id: 3,
    name: "Беккулова Алиса",
    position: "Специалист 2к",
    shifts: ["Н", "Н", "В", "В", "Д", "Д", "Н", "Н", "В", "В", "Д", "Д", "Н", "Н", "В", "В", "Д", "Д", "Н", "Н", "В", "В", "Д", "Д", "Н", "Н", "В", "В", "Д", "Д"],
  },
  {
    id: 4,
    name: "Сотрудник 3",
    position: "Специалист 1к",
    shifts: ["В", "В", "Д", "Д", "Н", "Н", "В", "В", "Д", "Д", "Н", "Н", "В", "В", "Д", "Д", "Н", "Н", "В", "В", "Д", "Д", "Н", "Н", "В", "В", "Д", "Д", "Н", "Н"],
  },
];

const weekdayLabels = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

function getWeekdayLabel(day: number) {
  const date = new Date(2026, 3, day);
  return weekdayLabels[date.getDay()];
}

function getShiftCellClass(shift: ShiftType) {
  if (shift === "Д") return "bg-yellow-200 text-black";
  if (shift === "Н") return "bg-blue-200 text-black";
  return "bg-neutral-200 text-black";
}

function getWorkDaysCount(shifts: ShiftType[]) {
  return shifts.filter((item) => item === "Д" || item === "Н").length;
}

function nextShift(current: ShiftType): ShiftType {
  if (current === "Д") return "Н";
  if (current === "Н") return "В";
  return "Д";
}

function shuffleArray<T>(array: T[]) {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function normalizeAssignments(
  employees: ShiftScheduleEmployee[],
  incoming: ShiftScheduleAssignments
): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const e of employees) {
    const prev = incoming[e.id] ?? [];
    out[e.id] = Array.from({ length: e.shifts.length }, (_, i) => prev[i] ?? "");
  }
  return out;
}

function createRandomAssignments(employees: ShiftScheduleEmployee[]) {
  const result: Record<number, string[]> = {};

  for (const employee of employees) {
    const assignments = Array.from({ length: employee.shifts.length }, () => "");
    const usageCount: Record<string, number> = {};

    const workDayIndexes = employee.shifts
      .map((shift, index) => (shift === "В" ? -1 : index))
      .filter((index) => index !== -1);

    let availablePool: string[] = [];

    for (const dayIndex of workDayIndexes) {
      let allowedBranches = branches.filter((branch) => (usageCount[branch] || 0) < 2);

      if (allowedBranches.length === 0) {
        allowedBranches = branches;
      }

      if (availablePool.length === 0) {
        availablePool = shuffleArray(allowedBranches);
      } else {
        availablePool = availablePool.filter((branch) => (usageCount[branch] || 0) < 2);

        if (availablePool.length === 0) {
          availablePool = shuffleArray(allowedBranches);
        }
      }

      const selectedBranch = availablePool.shift() || allowedBranches[0];

      assignments[dayIndex] = selectedBranch;
      usageCount[selectedBranch] = (usageCount[selectedBranch] || 0) + 1;
    }

    result[employee.id] = assignments;
  }

  return result;
}

export default function Calendar() {
  const { session } = useProfile();
  const [employees, setEmployees] = useState<ShiftScheduleEmployee[]>(initialEmployees);
  const [isEditing, setIsEditing] = useState(false);
  const [assignments, setAssignments] = useState<Record<number, string[]>>({});
  const [isMounted, setIsMounted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null);
  const [periodLabel, setPeriodLabel] = useState("2026-04");
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branchOptions, setBranchOptions] = useState<Array<{ id: number; name: string }>>([]);

  const scheduleSlug = useMemo(
    () => buildShiftScheduleSlug(branchId, periodLabel),
    [branchId, periodLabel]
  );

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_IN_MONTH }, (_, index) => ({
        dayNumber: index + 1,
        weekday: getWeekdayLabel(index + 1),
      })),
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadBranches() {
      const { data } = await supabase.from("branches").select("id, name").order("name");
      if (!cancelled) setBranchOptions((data ?? []) as Array<{ id: number; name: string }>);
    }

    void loadBranches();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoadError(null);

      if (!isSupabaseConfigured) {
        setAssignments(createRandomAssignments(initialEmployees));
        if (!cancelled) setIsMounted(true);
        return;
      }

      try {
        const row = await loadShiftSchedule(supabase, scheduleSlug);
        if (cancelled) return;

        const parsed = row?.payload ? parseStoredPayload(row.payload) : null;

        if (parsed && parsed.employees.length > 0) {
          setEmployees(parsed.employees);
          setAssignments(normalizeAssignments(parsed.employees, parsed.assignments));
          if (row?.updated_at) {
            setLastSavedAt(new Date(row.updated_at).toLocaleString("ru-RU"));
          }
          setLastSavedBy(row?.updated_by ?? null);
        } else {
          setAssignments(createRandomAssignments(initialEmployees));
          setLastSavedAt(null);
          setLastSavedBy(null);
        }
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Не удалось загрузить график из Supabase";
        if (!cancelled) {
          setLoadError(msg);
          setAssignments(createRandomAssignments(initialEmployees));
        }
      } finally {
        if (!cancelled) setIsMounted(true);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [scheduleSlug]);

  const handleSave = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSaveStatus("error");
      setSaveMessage("Нет переменных Supabase в .env.local — сохранять некуда.");
      return;
    }

    setSaveStatus("saving");
    setSaveMessage(null);

    try {
      const payload = buildPayload(employees, assignments, {
        daysInMonth: DAYS_IN_MONTH,
        periodLabel,
      });
      const { updated_at } = await saveShiftSchedule(supabase, payload, {
        slug: scheduleSlug,
        label: `График СКП (${periodLabel})`,
        branchId,
        periodLabel,
        updatedBy: session?.user.id ?? null,
      });
      setSaveStatus("saved");
      setLastSavedAt(new Date(updated_at).toLocaleString("ru-RU"));
      setLastSavedBy(session?.user.id ?? null);
      await writeAuditLog(supabase, "shift_schedule_saved", "shift_schedule", scheduleSlug, {
        branch_id: branchId,
        period_label: periodLabel,
      });
      window.setTimeout(() => setSaveStatus("idle"), 2800);
    } catch (e) {
      setSaveStatus("error");
      const raw = e instanceof Error ? e.message : "Ошибка сохранения";
      setSaveMessage(
        raw.includes("shift_schedule_snapshots") || raw.includes("42P01")
          ? "Таблица не найдена. Выполни SQL из supabase/migrations/… в Supabase → SQL Editor."
          : raw
      );
    }
  }, [assignments, branchId, employees, periodLabel, scheduleSlug, session?.user.id]);

  function handleNameChange(employeeId: number, value: string) {
    setEmployees((prev) =>
      prev.map((employee) =>
        employee.id === employeeId ? { ...employee, name: value } : employee
      )
    );
  }

  function handlePositionChange(employeeId: number, value: string) {
    setEmployees((prev) =>
      prev.map((employee) =>
        employee.id === employeeId ? { ...employee, position: value } : employee
      )
    );
  }

  function handleShiftClick(employeeId: number, dayIndex: number) {
    if (!isEditing) return;

    setEmployees((prev) =>
      prev.map((employee) => {
        if (employee.id !== employeeId) return employee;

        const updatedShifts = [...employee.shifts];
        updatedShifts[dayIndex] = nextShift(updatedShifts[dayIndex]);

        setAssignments((old) => {
          const updated = { ...old };
          const employeeAssignments = [...(updated[employeeId] || [])];

          if (updatedShifts[dayIndex] === "В") {
            employeeAssignments[dayIndex] = "";
          } else if (!employeeAssignments[dayIndex]) {
            const randomIndex = Math.floor(Math.random() * branches.length);
            employeeAssignments[dayIndex] = branches[randomIndex];
          }

          updated[employeeId] = employeeAssignments;
          return updated;
        });

        return {
          ...employee,
          shifts: updatedShifts,
        };
      })
    );
  }

  function handleBranchChange(employeeId: number, dayIndex: number, value: string) {
    setAssignments((prev) => ({
      ...prev,
      [employeeId]: (prev[employeeId] || []).map((branch, index) =>
        index === dayIndex ? value : branch
      ),
    }));
  }

  function addEmployee() {
    const emptyShifts: ShiftType[] = Array.from({ length: DAYS_IN_MONTH }, () => "В");
    const newId = Date.now();

    setEmployees((prev) => [
      ...prev,
      {
        id: newId,
        name: "Новый сотрудник",
        position: "Специалист",
        shifts: emptyShifts,
      },
    ]);

    setAssignments((prev) => ({
      ...prev,
      [newId]: Array.from({ length: DAYS_IN_MONTH }, () => ""),
    }));
  }

  function removeEmployee(employeeId: number) {
    setEmployees((prev) => prev.filter((employee) => employee.id !== employeeId));

    setAssignments((prev) => {
      const updated = { ...prev };
      delete updated[employeeId];
      return updated;
    });
  }

  function regenerateAssignments() {
    setAssignments(createRandomAssignments(employees));
  }

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-neutral-950 p-3 md:p-4">
      {!isSupabaseConfigured && (
        <p className="mb-3 rounded-xl border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
          Облачное сохранение выключено: задай <code className="text-amber-50">.env.local</code> и
          перезапусти dev. График пока только в памяти вкладки.
        </p>
      )}

      {loadError && (
        <p className="mb-3 rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-100">
          Загрузка из базы: {loadError}. Показан локальный черновик.
        </p>
      )}

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white md:text-xl">
            График работы сотрудников СКП за апрель
          </h2>
          <p className="mt-1 text-xs text-white/60 md:text-sm">
            Нажимай на ячейки в режиме редактирования: Д → Н → В. Сохранение — в Supabase (
            <code className="text-white/80">{scheduleSlug}</code>).
          </p>
          {lastSavedAt ? (
            <p className="mt-1 text-xs text-emerald-400/90">
              Последнее сохранение: {lastSavedAt}
              {lastSavedBy ? ` · пользователь ${lastSavedBy}` : ""}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={periodLabel}
            onChange={(event) => setPeriodLabel(event.target.value)}
            className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
          />
          <select
            value={branchId ?? ""}
            onChange={(event) =>
              setBranchId(event.target.value ? Number(event.target.value) : null)
            }
            className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
          >
            <option value="">Все филиалы</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {saveStatus === "saving" ? "Сохранение…" : "Сохранить в базу"}
          </button>

          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            {isEditing ? "Готово" : "Редактировать"}
          </button>

          <button
            type="button"
            onClick={regenerateAssignments}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Случайные филиалы
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={addEmployee}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
            >
              + Сотрудник
            </button>
          )}
        </div>
      </div>

      {saveMessage && (
        <p
          className={`mb-3 rounded-xl px-3 py-2 text-sm ${
            saveStatus === "error"
              ? "border border-red-500/40 bg-red-950/50 text-red-100"
              : "border border-white/10 bg-neutral-900 text-white/80"
          }`}
        >
          {saveMessage}
        </p>
      )}

      {saveStatus === "saved" && !saveMessage && (
        <p className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100">
          Сохранено в Supabase.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-xs md:text-sm">
          <thead>
            <tr className="bg-neutral-800 text-white">
              <th
                rowSpan={2}
                className="border border-neutral-700 px-2 py-2 text-center font-semibold"
              >
                Должность
              </th>
              <th
                rowSpan={2}
                className="border border-neutral-700 px-2 py-2 text-center font-semibold"
              >
                ФИО
              </th>
              <th
                rowSpan={2}
                className="border border-neutral-700 px-1.5 py-1.5 text-center font-semibold"
              >
                Кол-во
                <br />
                рабочих дней
              </th>

              {days.map((day) => (
                <th
                  key={`day-${day.dayNumber}`}
                  className="border border-neutral-700 px-2 py-2 text-center font-semibold"
                >
                  {day.dayNumber}
                </th>
              ))}
            </tr>

            <tr className="bg-neutral-900 text-white/80">
              {days.map((day) => (
                <th
                  key={`weekday-${day.dayNumber}`}
                  className="border border-neutral-700 px-2 py-2 text-center text-xs font-normal"
                >
                  {day.weekday}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {employees.map((employee) => (
              <Fragment key={employee.id}>
                <tr className="bg-neutral-950 text-white">
                  <td className="border border-neutral-700 px-2 py-2 align-middle">
                    {isEditing ? (
                      <input
                        value={employee.position}
                        onChange={(event) =>
                          handlePositionChange(employee.id, event.target.value)
                        }
                        className="w-36 rounded-lg border border-white/10 bg-neutral-900 px-2 py-1 text-sm text-white outline-none"
                      />
                    ) : (
                      <span className="whitespace-nowrap">{employee.position}</span>
                    )}
                  </td>

                  <td className="border border-neutral-700 px-2 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <input
                          value={employee.name}
                          onChange={(event) =>
                            handleNameChange(employee.id, event.target.value)
                          }
                          className="w-52 rounded-lg border border-white/10 bg-neutral-900 px-2 py-1 text-sm text-white outline-none"
                        />
                      ) : (
                        <span className="whitespace-nowrap">{employee.name}</span>
                      )}

                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => removeEmployee(employee.id)}
                          className="rounded-lg bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="border border-neutral-700 px-2 py-2 text-center font-semibold">
                    {getWorkDaysCount(employee.shifts)}
                  </td>

                  {employee.shifts.map((shift, dayIndex) => (
                    <td
                      key={`${employee.id}-shift-${dayIndex}`}
                      onClick={() => handleShiftClick(employee.id, dayIndex)}
                      className={`border border-neutral-700 px-1.5 py-1.5 text-center text-xs font-bold transition ${
                        getShiftCellClass(shift)
                      } ${isEditing ? "cursor-pointer hover:brightness-95" : ""}`}
                    >
                      {shift}
                    </td>
                  ))}
                </tr>

                <tr className="bg-neutral-900/40 text-white/80">
                  <td className="border border-neutral-700 px-2 py-2 text-xs" colSpan={3}>
                    Филиалы проверок
                  </td>

                  {days.map((day, dayIndex) => {
                    const shift = employee.shifts[dayIndex];
                    const branch = assignments[employee.id]?.[dayIndex] || "";

                    return (
                      <td
                        key={`${employee.id}-branch-${day.dayNumber}`}
                        className="min-w-[56px] border border-neutral-700 px-1 py-1 text-center text-[9px] leading-tight"
                      >
                        {shift === "В" ? (
                          <span className="text-white/20">—</span>
                        ) : isEditing ? (
                          <select
                            value={branch}
                            onChange={(event) =>
                              handleBranchChange(employee.id, dayIndex, event.target.value)
                            }
                            className="w-full rounded border border-white/10 bg-neutral-950 px-1 py-1 text-[10px] text-white outline-none"
                          >
                            {branches.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>{isMounted ? branch : ""}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-yellow-200" />
          <span>День</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-blue-200" />
          <span>Ночь</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-neutral-200" />
          <span>Выходной</span>
        </div>
      </div>
    </div>
  );
}
