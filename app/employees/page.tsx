"use client";

import { useEffect, useMemo, useState } from "react";
import { useConfirmDialog } from "@/app/components/ConfirmDialog";
import LoadingState from "@/app/components/LoadingState";
import { useProfile } from "@/app/components/ProfileProvider";
import { useToast } from "@/app/components/ToastProvider";
import { ROLE_LABELS, canManageEmployees } from "@/lib/auth/roles";
import { writeAuditLog } from "@/lib/audit";
import {
  employeeNameSet,
  fetchAppProfiles,
  fetchEmployeesDirectory,
} from "@/lib/peopleData";
import { supabase } from "@/lib/supabase";
import type { Employee, Profile } from "@/lib/types";

type Branch = {
  id: number;
  name: string;
};

const emptyEmployee: Employee = {
  full_name: "",
  position: "",
  status: "Работает",
  branch_id: null,
};

export default function EmployeesPage() {
  const { profile } = useProfile();
  const { pushToast } = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const canEdit = canManageEmployees(profile);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [appUsers, setAppUsers] = useState<Profile[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Employee>(emptyEmployee);

  const existingEmployeeNames = useMemo(() => employeeNameSet(employees), [employees]);

  const fetchData = async () => {
    setLoading(true);

    try {
      const [employeesData, branchesResult] = await Promise.all([
        fetchEmployeesDirectory(supabase),
        supabase.from("branches").select("id, name").order("name", { ascending: true }),
      ]);

      if (branchesResult.error) {
        pushToast("Не удалось загрузить филиалы", "error");
      }

      setEmployees(employeesData);
      setBranches((branchesResult.data ?? []) as Branch[]);

      if (canEdit) {
        const profiles = await fetchAppProfiles(supabase).catch((error) => {
          const message =
            error instanceof Error ? error.message : "Не удалось загрузить пользователей";
          pushToast(message, "error");
          return [] as Profile[];
        });
        setAppUsers(profiles);
      } else {
        setAppUsers([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось загрузить сотрудников";
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [canEdit]);

  const openCreateForm = (seed?: Partial<Employee>) => {
    setForm({
      ...emptyEmployee,
      ...seed,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      pushToast("Укажите ФИО сотрудника", "error");
      return;
    }

    const { data, error } = await supabase
      .from("employees")
      .insert([
        {
          full_name: form.full_name.trim(),
          position: form.position.trim(),
          status: form.status,
          branch_id: form.branch_id,
        },
      ])
      .select("id")
      .single();

    if (error) {
      pushToast(error.message || "Не удалось создать сотрудника", "error");
      return;
    }

    if (data?.id != null) {
      await writeAuditLog(supabase, "employee_created", "employee", data.id, {
        full_name: form.full_name.trim(),
      });
    }

    pushToast("Сотрудник создан", "success");
    setForm(emptyEmployee);
    setShowForm(false);
    void fetchData();
  };

  const handleDelete = async (id?: number) => {
    if (!id || !canEdit) return;

    const ok = await confirm({
      title: "Удалить сотрудника?",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;

    const { error } = await supabase.from("employees").delete().eq("id", id);

    if (error) {
      pushToast(error.message, "error");
      return;
    }

    await writeAuditLog(supabase, "employee_deleted", "employee", id);
    pushToast("Сотрудник удалён", "success");
    void fetchData();
  };

  const handleCreateFromUser = (user: Profile) => {
    openCreateForm({
      full_name: user.full_name?.trim() || "Без имени",
      position: ROLE_LABELS[user.role],
      status: "Работает",
      branch_id: user.branch_id,
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 p-6 text-white">
        <LoadingState label="Загрузка сотрудников…" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-white">
      {dialog}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Сотрудники</h1>
          <p className="mt-1 text-sm text-white/60">
            Справочник для проверок и графиков. Учётные записи Auth создаются в Supabase.
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            onClick={() => openCreateForm()}
            className="rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-500"
          >
            Создать сотрудника
          </button>
        ) : null}
      </div>

      {showForm && canEdit ? (
        <div className="mb-6 rounded-xl border border-white/10 bg-neutral-900 p-4">
          <h2 className="mb-4 text-xl">Новый сотрудник</h2>

          <div className="grid gap-3">
            <input
              placeholder="ФИО"
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              className="rounded bg-neutral-800 p-2"
            />

            <input
              placeholder="Должность"
              value={form.position}
              onChange={(event) => setForm({ ...form, position: event.target.value })}
              className="rounded bg-neutral-800 p-2"
            />

            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              className="rounded bg-neutral-800 p-2"
            >
              <option>Работает</option>
              <option>Отпуск</option>
              <option>Стажировка</option>
              <option>Уволен</option>
            </select>

            <select
              value={form.branch_id ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  branch_id: event.target.value ? Number(event.target.value) : null,
                })
              }
              className="rounded bg-neutral-800 p-2"
            >
              <option value="">Выбери филиал</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="rounded bg-green-600 px-4 py-2 hover:bg-green-500"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyEmployee);
                }}
                className="rounded border border-white/15 px-4 py-2 text-white/80 hover:bg-white/5"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Пользователи системы</h2>
            <span className="text-sm text-white/50">{appUsers.length}</span>
          </div>

          {appUsers.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm text-white/60">
              Пользователи не найдены. Создайте учётную запись в Supabase Auth и строку в profiles.
            </p>
          ) : (
            <div className="grid gap-3">
              {appUsers.map((user) => {
                const normalizedName = user.full_name?.trim().toLocaleLowerCase("ru") ?? "";
                const alreadyInDirectory =
                  normalizedName.length > 0 && existingEmployeeNames.has(normalizedName);

                return (
                  <div
                    key={user.id}
                    className="flex flex-col gap-3 rounded-xl border border-white/10 bg-neutral-900 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-lg font-medium">{user.full_name?.trim() || "Без имени"}</p>
                      <p className="mt-1 text-sm text-white/60">{ROLE_LABELS[user.role]}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCreateFromUser(user)}
                      disabled={alreadyInDirectory}
                      className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/85 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {alreadyInDirectory ? "Уже в справочнике" : "Создать сотрудника"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Справочник сотрудников</h2>
          <span className="text-sm text-white/50">{employees.length}</span>
        </div>

        <div className="grid gap-4">
          {employees.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm text-white/60">
              Справочник пуст. Создайте сотрудника вручную или из пользователя системы.
            </p>
          ) : (
            employees.map((employee) => (
              <div
                key={employee.id}
                className="rounded-xl border border-white/10 bg-neutral-900 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">{employee.full_name}</h3>
                    <p className="mt-1 text-white/60">
                      Должность: {employee.position || "Не указана"}
                    </p>
                    <p className="text-white/60">
                      Филиал: {employee.branches?.name || "Не привязан"}
                    </p>
                    <p className="mt-2">{employee.status}</p>
                  </div>

                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(employee.id)}
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm hover:bg-red-500"
                    >
                      Удалить
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
