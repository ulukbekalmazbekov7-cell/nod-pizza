"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Branch = {
  id: number;
  name: string;
};

type Inspection = {
  id?: number;
  branch_id: number;
  inspector: string;
  score: number;
  comment: string;
};

export default function InspectionsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState<Inspection>({
    branch_id: 0,
    inspector: "",
    score: 0,
    comment: "",
  });

  const fetchData = async () => {
    const { data: branchesData } = await supabase.from("branches").select("*");
    const { data: inspectionsData } = await supabase
      .from("inspections")
      .select("*, branches(name)")
      .order("created_at", { ascending: false });

    setBranches(branchesData || []);
    setInspections(inspectionsData || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!form.branch_id) return;

    await supabase.from("inspections").insert([form]);

    setForm({
      branch_id: 0,
      inspector: "",
      score: 0,
      comment: "",
    });

    setShowForm(false);
    fetchData();
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="flex justify-between mb-6">
        <h1 className="text-3xl font-bold">Проверки</h1>

        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-green-600 px-4 py-2 rounded"
        >
          + Новая проверка
        </button>
      </div>

      {showForm && (
        <div className="bg-neutral-900 p-4 rounded-xl mb-6">
          <div className="grid gap-3">

            <select
              value={form.branch_id}
              onChange={(e) =>
                setForm({ ...form, branch_id: Number(e.target.value) })
              }
              className="bg-neutral-800 p-2 rounded"
            >
              <option value={0}>Выбери филиал</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <input
              placeholder="Проверяющий"
              value={form.inspector}
              onChange={(e) =>
                setForm({ ...form, inspector: e.target.value })
              }
              className="bg-neutral-800 p-2 rounded"
            />

            <input
              type="number"
              placeholder="Оценка (0-100)"
              value={form.score}
              onChange={(e) =>
                setForm({ ...form, score: Number(e.target.value) })
              }
              className="bg-neutral-800 p-2 rounded"
            />

            <textarea
              placeholder="Комментарий"
              value={form.comment}
              onChange={(e) =>
                setForm({ ...form, comment: e.target.value })
              }
              className="bg-neutral-800 p-2 rounded"
            />

            <button
              onClick={handleSave}
              className="bg-blue-600 px-4 py-2 rounded"
            >
              Сохранить
            </button>

          </div>
        </div>
      )}

      <div className="grid gap-4">
        {inspections.map((item) => (
          <div key={item.id} className="bg-neutral-900 p-4 rounded-xl">
            <h2 className="text-xl font-semibold">
              {item.branches?.name}
            </h2>
            <p className="text-white/60">Проверяющий: {item.inspector}</p>
            <p>Оценка: {item.score}</p>
            <p className="text-white/60">{item.comment}</p>
          </div>
        ))}
      </div>
    </main>
  );
}