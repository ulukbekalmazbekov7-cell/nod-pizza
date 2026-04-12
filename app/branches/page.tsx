"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Branch = {
  id?: number;
  name: string;
  manager: string;
  address: string;
  status: string;
};

const emptyBranch: Branch = {
  name: "",
  manager: "",
  address: "",
  status: "Активный",
};

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newBranch, setNewBranch] = useState<Branch>(emptyBranch);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBranches = async () => {
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Ошибка загрузки филиалов:", error);
      return;
    }

    setBranches(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleSaveBranch = async () => {
    if (!newBranch.name.trim()) return;

    if (editingId !== null) {
      const { error } = await supabase
        .from("branches")
        .update({
          name: newBranch.name,
          manager: newBranch.manager,
          address: newBranch.address,
          status: newBranch.status,
        })
        .eq("id", editingId);

      if (error) {
        console.error("Ошибка обновления филиала:", error);
        return;
      }
    } else {
      const { error } = await supabase.from("branches").insert([
        {
          name: newBranch.name,
          manager: newBranch.manager,
          address: newBranch.address,
          status: newBranch.status,
        },
      ]);

      if (error) {
        console.error("Ошибка добавления филиала:", error);
        return;
      }
    }

    setNewBranch(emptyBranch);
    setEditingId(null);
    setShowForm(false);
    fetchBranches();
  };

  const handleDeleteBranch = async (id?: number) => {
    if (!id) return;

    const { error } = await supabase.from("branches").delete().eq("id", id);

    if (error) {
      console.error("Ошибка удаления филиала:", error);
      return;
    }

    fetchBranches();
  };

  const handleEditBranch = (branch: Branch) => {
    setNewBranch({
      name: branch.name,
      manager: branch.manager,
      address: branch.address,
      status: branch.status,
    });
    setEditingId(branch.id ?? null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setNewBranch(emptyBranch);
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Филиалы</h1>

        <button
          onClick={() => {
            if (showForm) {
              handleCancel();
            } else {
              setShowForm(true);
            }
          }}
          className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg"
        >
          + Добавить филиал
        </button>
      </div>

      {showForm && (
        <div className="bg-neutral-900 p-4 rounded-xl mb-6 border border-white/10">
          <h2 className="text-xl mb-4">
            {editingId !== null ? "Редактировать филиал" : "Новый филиал"}
          </h2>

          <div className="grid gap-3">
            <input
              placeholder="Название"
              value={newBranch.name}
              onChange={(e) =>
                setNewBranch({ ...newBranch, name: e.target.value })
              }
              className="bg-neutral-800 p-2 rounded"
            />

            <input
              placeholder="Ответственный"
              value={newBranch.manager}
              onChange={(e) =>
                setNewBranch({ ...newBranch, manager: e.target.value })
              }
              className="bg-neutral-800 p-2 rounded"
            />

            <input
              placeholder="Адрес"
              value={newBranch.address}
              onChange={(e) =>
                setNewBranch({ ...newBranch, address: e.target.value })
              }
              className="bg-neutral-800 p-2 rounded"
            />

            <select
              value={newBranch.status}
              onChange={(e) =>
                setNewBranch({ ...newBranch, status: e.target.value })
              }
              className="bg-neutral-800 p-2 rounded"
            >
              <option>Активный</option>
              <option>На контроле</option>
              <option>Новый филиал</option>
              <option>Закрыт</option>
            </select>

            <div className="flex gap-3">
              <button
                onClick={handleSaveBranch}
                className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded"
              >
                {editingId !== null ? "Сохранить изменения" : "Сохранить"}
              </button>

              <button
                onClick={handleCancel}
                className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-white/60">Загрузка филиалов...</p>
      ) : branches.length === 0 ? (
        <p className="text-white/60">Пока филиалов нет. Добавь первый.</p>
      ) : (
        <div className="grid gap-4">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="bg-neutral-900 p-4 rounded-xl border border-white/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{branch.name}</h2>
                  <p className="text-white/60 mt-1">
                    Ответственный: {branch.manager || "Не указан"}
                  </p>
                  <p className="text-white/60">
                    Адрес: {branch.address || "Не указан"}
                  </p>
                  <p className="mt-2">{branch.status}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditBranch(branch)}
                    className="bg-yellow-600 hover:bg-yellow-500 px-3 py-2 rounded-lg text-sm"
                  >
                    Редактировать
                  </button>

                  <button
                    onClick={() => handleDeleteBranch(branch.id)}
                    className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-lg text-sm"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}