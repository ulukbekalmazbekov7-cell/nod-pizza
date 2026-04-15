"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type ShiftType = "Д" | "Н" | "В";

type Employee = {
  id: number;
  name: string;
  position: string;
  shifts: ShiftType[];
};

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

const initialEmployees: Employee[] = [
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

function createRandomAssignments(employees: Employee[]) {
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
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [isEditing, setIsEditing] = useState(false);
  const [assignments, setAssignments] = useState<Record<number, string[]>>({});
  const [isMounted, setIsMounted] = useState(false);

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_IN_MONTH }, (_, index) => ({
        dayNumber: index + 1,
        weekday: getWeekdayLabel(index + 1),
      })),
    []
  );

  useEffect(() => {
    setAssignments(createRandomAssignments(initialEmployees));
    setIsMounted(true);
  }, []);

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
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white md:text-xl">
            График работы сотрудников СКП за апрель
          </h2>
          <p className="mt-1 text-xs text-white/60 md:text-sm">
            Нажимай на ячейки в режиме редактирования: Д → Н → В
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
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
                      className={`border border-neutral-700 px-2 py-2 text-center font-bold transition ${
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
                        className="min-w-[72px] border border-neutral-700 px-1 py-2 text-center text-[10px] leading-tight"
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

      <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/70">
        <div className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded bg-yellow-200" />
          <span>День</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded bg-blue-200" />
          <span>Ночь</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded bg-neutral-200" />
          <span>Выходной</span>
        </div>
      </div>
    </div>
  );
}