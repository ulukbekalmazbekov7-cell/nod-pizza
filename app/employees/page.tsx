"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Branch = {
  id: number;
  name: string;
};

type Employee = {
  id?: number;
  full_name: string;
  position: string;
  status: string;
  branch_id: number | null;
};

const emptyEmployee: Employee = {
  full_name: "",
  position: "",
  status: "Работает",
  branch_id: null,
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Employee>(emptyEmployee);

  const fetchData = async () => {
    const { data: employeesData, error: employeesError } = await supabase
      .from("employees")
      .select("*, branches(name)")
      .order("created_at", { ascending: false });

    const { data: branchesData, error: branchesError } = await supabase
      .from("branches")
      .select("id, name")
      .order("name", { ascending: true });

    if (employeesError) {
      console.error("Ошибка загрузки сотрудников:", employeesError);
    }

    if (branchesError) {
      console.error("Ошибка загрузки филиалов:", branchesError);
    }

    setEmployees(employeesData || []);
    setBranches(branchesData || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!form.full_name.trim()) return;

    const { error } = await supabase.from("employees").insert([
      {
        full_name: form.full_name,
        position: form.position,
        status: form.status,
        branch_id: form.branch_id,
      },
    ]);

    if (error) {
      console.error("Ошибка добавления сотрудника:", error);
      return;
    }

    setForm(emptyEmployee);
    setShowForm(false);
    fetchData();
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;

    const { error } = await supabase.from("employees").delete().eq("id", id);

    if (error) {
      console.error("Ошибка удаления сотрудника:", error);
      return;
    }

    fetchData();
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Сотрудники</h1>

        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg"
        >
          + Добавить сотрудника
        </button>
      </div>

      {showForm && (
        <div className="bg-neutral-900 p-4 rounded-xl mb-6 border border-white/10">
          <h2 className="text-xl mb-4">Новый сотрудник</h2>

          <div className="grid gap-3">
            <input
              placeholder="ФИО"
              value={form.full_name}
              onChange={(e) =>
                setForm({ ...form, full_name: e.target.value })
              }
              className="bg-neutral-800 p-2 rounded"
            />

            <input
              placeholder="Должность"
              value={form.position}
              onChange={(e) =>
                setForm({ ...form, position: e.target.value })
              }
              className="bg-neutral-800 p-2 rounded"
            />

            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value })
              }
              className="bg-neutral-800 p-2 rounded"
            >
              <option>Работает</option>
              <option>Отпуск</option>
              <option>Стажировка</option>
              <option>Уволен</option>
            </select>

            <select
              value={form.branch_id ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  branch_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="bg-neutral-800 p-2 rounded"
            >
              <option value="">Выбери филиал</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded"
            >
              Сохранить
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {employees.map((employee) => (
          <div
            key={employee.id}
            className="bg-neutral-900 p-4 rounded-xl border border-white/10"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{employee.full_name}</h2>
                <p className="text-white/60 mt-1">
                  Должность: {employee.position || "Не указана"}
                </p>
                <p className="text-white/60">
                  Филиал: {employee.branches?.name || "Не привязан"}
                </p>
                <p className="mt-2">{employee.status}</p>
              </div>

              <button
                onClick={() => handleDelete(employee.id)}
                className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-lg text-sm"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}