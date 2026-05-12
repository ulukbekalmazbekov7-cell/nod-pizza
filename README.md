# NOD PIZZA — внутренний QC-портал

Закрытая корпоративная система для контроля качества, графиков смен, филиалов, сотрудников и инспекций.

## Локальный запуск

1. Установи зависимости:

```bash
npm install
```

2. Скопируй `.env.example` в `.env.local` и заполни:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. В Supabase выполни SQL-миграции из `supabase/migrations/` **в порядке имени файла**.

4. Запусти dev-сервер:

```bash
npm run dev
```

5. Открой [http://localhost:3000](http://localhost:3000) и войди под выданной учётной записью.

## Миграции

| Файл | Назначение |
|------|------------|
| `20260212120000_shift_schedule_snapshots.sql` | Таблица снимков графика смен |
| `20260213130000_corporate_rls_auth_tables.sql` | Базовый RLS для authenticated |
| `20260512120000_roles_profiles_audit_photos.sql` | Роли, профили, аудит, фото, узкие политики |
| `20260513140000_inspection_criteria_model.sql` | Категории, критерии, результаты, RLS |
| `20260513150000_inspection_subcategories_hierarchy.sql` | Подгруппы, penalty_points, RLS |
| `20260513150100_inspection_hierarchy_seed.sql` | Seed иерархии критериев |

## Ручная настройка Supabase Dashboard

1. **Authentication → Providers → Email** — включи подтверждение почты.
2. **Authentication → Settings** — отключи публичную регистрацию (Sign ups).
3. **Storage** — bucket `inspection-photos` создаётся миграцией; проверь, что он приватный.
4. Создай пользователя: **Authentication → Users → Add user** (или Invite).
5. После создания пользователя выполни в SQL Editor:

```sql
insert into public.profiles (id, role, full_name, branch_id, branch_ids)
values (
  'UUID_ПОЛЬЗОВАТЕЛЯ',
  'admin', -- admin | manager | qc
  'Имя Фамилия',
  null,    -- для manager: id филиала
  '{}'     -- для qc: массив id филиалов, например '{1,2,3}'
)
on conflict (id) do update
set role = excluded.role,
    full_name = excluded.full_name,
    branch_id = excluded.branch_id,
    branch_ids = excluded.branch_ids;
```

## Роли

- **admin** — полный доступ, журнал аудита.
- **manager** — свой филиал (`profiles.branch_id`).
- **qc** — проверки и графики по `profiles.branch_ids`.

## Демо для руководства

1. Вход под admin: дашборд с метриками и быстрыми действиями.
2. Раздел **Проверки**: фильтры, статус, оценка, комментарий, фото нарушений.
3. **График смен**: выбор месяца и филиала, сохранение, история последнего сохранения.
4. **Филиалы / Сотрудники**: справочники (редактирование у admin).
5. **Журнал аудита** (только admin): создание/удаление проверок, изменения графика.
6. Мобильная навигация внизу экрана; на desktop — боковое меню.

## Сборка

```bash
npm run build
npm run start
```

Подробности по безопасности — в [SECURITY.md](./SECURITY.md).
