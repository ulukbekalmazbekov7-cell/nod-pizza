"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Branch = {
  id: number;
  name: string;
};

type InspectionForm = {
  branch_id: number;
  inspector: string;
  score: number;
  comment: string;
};

type InspectionRow = InspectionForm & {
  id?: number;
  branches?: { name: string } | null;
};

export default function InspectionsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<InspectionForm>({
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
    setInspections((inspectionsData || []) as InspectionRow[]);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaveError(null);

    if (!form.branch_id) {
      setSaveError("Выбери филиал");
      return;
    }

    const inspector = form.inspector.trim();
    if (!inspector) {
      setSaveError("Укажи проверяющего");
      return;
    }

    if (!Number.isFinite(form.score) || form.score < 0 || form.score > 100) {
      setSaveError("Оценка должна быть от 0 до 100");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("inspections").insert([
      {
        branch_id: form.branch_id,
        inspector,
        score: form.score,
        comment: form.comment.trim(),
      },
    ]);

    setSaving(false);

    if (error) {
      setSaveError(error.message || "Не удалось сохранить");
      return;
    }

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
          type="button"
          onClick={() => {
            setSaveError(null);
            setShowForm(!showForm);
          }}
          className="bg-green-600 px-4 py-2 rounded"
        >
          + Новая проверка
        </button>
      </div>

      {showForm && (
        <div className="bg-neutral-900 p-4 rounded-xl mb-6">
          {saveError && (
            <p className="mb-3 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-200">{saveError}</p>
          )}
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
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-blue-600 px-4 py-2 disabled:opacity-50"
            >
              {saving ? "Сохранение…" : "Сохранить"}
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