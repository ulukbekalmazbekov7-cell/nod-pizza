"use client";

import ShiftCalendar from "../components/Calendar";

export default function ShiftsPage() {
  return (
    <main className="min-h-screen bg-neutral-950 p-4 md:p-6 text-white">
      <div className="mb-4">
        <h1 className="text-xl font-bold md:text-2xl">График смен</h1>
      </div>

      <div className="mb-6">
        {/* сюда твой верхний график */}
      </div>

      <ShiftCalendar />
    </main>
  );
}