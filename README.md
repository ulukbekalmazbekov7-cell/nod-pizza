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
- `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`
- опционально `JIRA_DEFAULT_ASSIGNEE_ACCOUNT_ID`, `JIRA_QC_LABEL`

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
| `20260513200000_inspection_catalog_qc_write.sql` | Права qc на справочник критериев |
| `20260513210000_complaints_jira.sql` | Жалобы операторов и поля синхронизации Jira |

## Переменные окружения

Скопируй `.env.example` в `.env.local` и заполни:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `JIRA_BASE_URL` — базовый URL Jira Cloud, например `https://your-domain.atlassian.net`
- `JIRA_EMAIL` — почта пользователя Jira с API-доступом
- `JIRA_API_TOKEN` — API token из Atlassian
- `JIRA_PROJECT_KEY` — ключ проекта NOD QC, например `NODQC`
- `JIRA_DEFAULT_ASSIGNEE_ACCOUNT_ID` — опционально, accountId исполнителя QC
- `JIRA_QC_LABEL` — опциональная дополнительная метка Jira

Jira secrets используются только в server route `POST /api/jira/create-issue`. Не добавляйте `JIRA_*` и `service_role` в клиентский код.

### Как получить Jira API token

1. Открой [Atlassian API tokens](https://id.atlassian.com/manage-profile/security/api-tokens).
2. Создай token и сохрани его в `JIRA_API_TOKEN`.
3. В `JIRA_EMAIL` укажи ту же почту, под которой создан token.

### Как найти project key

1. Открой проект NOD QC в Jira.
2. Project key виден в URL (`/browse/NODQC-1`) и в настройках проекта.
3. Запиши его в `JIRA_PROJECT_KEY`.

### Как найти assignee accountId

1. В Jira Cloud открой профиль нужного сотрудника QC.
2. Account ID можно получить через Jira REST API `GET /rest/api/3/user/search?query=email`.
3. Скопируй `accountId` в `JIRA_DEFAULT_ASSIGNEE_ACCOUNT_ID`.

### Как проверить интеграцию

1. Примени миграцию `20260513210000_complaints_jira.sql`.
2. Заполни `JIRA_*` в `.env.local`.
3. Запусти `npm run dev`.
4. Войди в портал и открой раздел **Задачи**.
5. Создай жалобу и проверь:

- запись в таблице `complaints`
- `jira_sync_status = success`
- ссылку `jira_issue_url`
- issue в Jira с labels `nod`, `qc`, `complaint`

Если Jira недоступна, жалоба останется в NOD, а в карточке появится `jira_sync_status = failed` и текст `jira_sync_error`.

### Локальное тестирование Jira sync

1. Используй тестовый Jira Cloud project, а не production.
2. Перезапусти dev-сервер после изменения `.env.local`.
3. Создай жалобу с валидным филиалом и номером клиента или накладной.
4. Для повторной отправки после ошибки нажми **Повторить синхронизацию** в карточке задачи.
5. Проверяй ответ route в Network: `POST /api/jira/create-issue`.

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
3. **Задачи / Жалобы**: регистрация обращений операторов и автосоздание issue в Jira QC.
4. **График смен**: выбор месяца и филиала, сохранение, история последнего сохранения.
5. **Филиалы / Сотрудники**: справочники (редактирование у admin).
6. **Журнал аудита** (только admin): создание/удаление проверок, изменения графика.
7. Мобильная навигация внизу экрана; на desktop — боковое меню.

## Сборка

```bash
npm run build
npm run start
```

Подробности по безопасности — в [SECURITY.md](./SECURITY.md).
