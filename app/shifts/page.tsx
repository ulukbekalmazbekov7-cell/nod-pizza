"use client";

import ShiftCalendar from "../components/Calendar";

export default function ShiftsPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-6">График смен</h1>

      <ShiftCalendar />
    </main>
  );
}