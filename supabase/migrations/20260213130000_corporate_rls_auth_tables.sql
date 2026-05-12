-- Корпоративный режим: RLS + политики только для authenticated.
-- Выполни в Supabase → SQL Editor.
-- Требуются таблицы: branches, employees, inspections, shift_schedule_snapshots.
-- profiles / shifts — только если таблицы есть в проекте.

-- ─── branches ───────────────────────────────────────────────────────────────
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branches_corp_auth_all" ON public.branches;
CREATE POLICY "branches_corp_auth_all"
  ON public.branches
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── employees ─────────────────────────────────────────────────────────────
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_corp_auth_all" ON public.employees;
CREATE POLICY "employees_corp_auth_all"
  ON public.employees
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── inspections ───────────────────────────────────────────────────────────
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspections_corp_auth_all" ON public.inspections;
CREATE POLICY "inspections_corp_auth_all"
  ON public.inspections
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── shift_schedule_snapshots (совместимо со старой миграцией имён политик) ─
ALTER TABLE public.shift_schedule_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift_schedules_select_authenticated" ON public.shift_schedule_snapshots;
DROP POLICY IF EXISTS "shift_schedules_insert_authenticated" ON public.shift_schedule_snapshots;
DROP POLICY IF EXISTS "shift_schedules_update_authenticated" ON public.shift_schedule_snapshots;
DROP POLICY IF EXISTS "shift_schedules_delete_authenticated" ON public.shift_schedule_snapshots;
DROP POLICY IF EXISTS "shift_schedule_snapshots_corp_auth_all" ON public.shift_schedule_snapshots;

CREATE POLICY "shift_schedule_snapshots_corp_auth_all"
  ON public.shift_schedule_snapshots
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── profiles (если таблица есть) ───────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS profiles_corp_auth_all ON public.profiles';
    EXECUTE $pol$
      CREATE POLICY profiles_corp_auth_all
        ON public.profiles
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true)
    $pol$;
  END IF;
END $$;

-- ─── shifts (если таблица есть) ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shifts'
  ) THEN
    EXECUTE 'ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS shifts_corp_auth_all ON public.shifts';
    EXECUTE $pol$
      CREATE POLICY shifts_corp_auth_all
        ON public.shifts
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true)
    $pol$;
  END IF;
END $$;
