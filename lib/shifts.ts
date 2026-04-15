export type ShiftType = "day" | "night" | "off";

export type Employee = {
  id: number;
  name: string;
  role: "manager" | "staff";
  offset?: number;
};

export const employees: Employee[] = [
  { id: 1, name: "Руководитель", role: "manager" },
  { id: 2, name: "Сотрудник 1", role: "staff", offset: 0 },
  { id: 3, name: "Сотрудник 2", role: "staff", offset: 2 },
  { id: 4, name: "Сотрудник 3", role: "staff", offset: 4 },
];

const cycle: ShiftType[] = ["day", "day", "night", "night", "off", "off"];

function getDaysDiff(date: Date, startDate: Date) {
  const oneDay = 1000 * 60 * 60 * 24;

  const utc1 = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const utc2 = Date.UTC(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );

  return Math.floor((utc1 - utc2) / oneDay);
}

export function getShiftForEmployee(
  date: Date,
  employee: Employee,
  startDate: Date
): ShiftType {
  if (employee.role === "manager") {
    const day = date.getDay(); // 0 = воскресенье, 6 = суббота
    return day >= 1 && day <= 5 ? "day" : "off";
  }

  const diff = getDaysDiff(date, startDate);
  const offset = employee.offset ?? 0;
  const index = ((diff + offset) % cycle.length + cycle.length) % cycle.length;

  return cycle[index];
}

export function getMonthDays(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from(
    { length: daysInMonth },
    (_, i) => new Date(year, month, i + 1)
  );
}