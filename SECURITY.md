# Security report — корпоративный режим (внутренняя система)

Краткий отчёт по состоянию безопасности MVP внутреннего QC-портала.

## Что было опасно / слабее желаемого

1. **Только клиентский AuthGuard** — незалогиненный теоретически мог получить HTML страниц до гидрации React; защита данных всё равно должна быть в **RLS**, но контур приложения был «мягким».
2. **Сессия в основном через localStorage** — без согласованного cookie-потока edge-middleware не мог надёжно отсечь доступ на уровне запроса.
3. **Публичная регистрация в UI** — форма позволяла вызывать `signUp`; при включённой регистрации в проекте это расширяло поверхность атаки.
4. **Таблицы без единой политики в репозитории** — риск: в Dashboard забыли включить RLS на `branches` / `employees` / `inspections` и т.д.
5. **`NEXT_PUBLIC_*`** — anon/publishable ключ по определению виден в браузере; это нормально для Supabase, но **вся** защита данных — **RLS и Auth**, не секретность ключа.
6. **Широкий доступ authenticated** — любой залогиненный пользователь видел все строки до введения ролей в `profiles`.

## Что исправлено в коде и артефактах

| Мера | Описание |
|------|----------|
| **Middleware** (`middleware.ts`) | Cookie-сессия Supabase (`@supabase/ssr`), редирект неавторизованных на `/login`, залогиненных с `/login` на главную; `/audit` только для `profiles.role = admin`. |
| **Браузерный клиент** (`lib/supabase.ts`) | `createBrowserClient` — сессия в cookie, согласована с middleware и RLS для `authenticated`. **service_role не используется.** |
| **Только вход** (`app/login/page.tsx`) | Убрана регистрация из UI; один сценарий — `signInWithPassword`. |
| **Роли** (`profiles`, `lib/auth/roles.ts`, `ProfileProvider`) | admin / manager / qc; UI и запросы учитывают роль; данные режутся RLS. |
| **Аудит** (`audit_logs`, `lib/audit.ts`, `app/audit/page.tsx`) | Журнал действий; страница только admin. |
| **Фото инспекций** (`inspection-photos` bucket, `inspection_photos`, storage policies) | Загрузка/просмотр для authenticated; удаление admin или автором файла. |
| **Миграции RLS** | `supabase/migrations/` — RLS и политики по ролям и филиалам. |
| **Шаблон env** | `.env.example` — только публичные ключи. |
| **Git** | `.env*` в `.gitignore`. |

## Что нужно сделать вручную в Supabase Dashboard

1. **Authentication → Providers → Email** — включить **Confirm email**.
2. **Authentication → Settings** — отключить **Sign ups**; пользователей создаёт администратор.
3. Выполнить все SQL из `supabase/migrations/` в **SQL Editor**, если ещё не применяли.
4. Для каждого пользователя Auth создать/обновить строку в `public.profiles` с ролью и привязкой к филиалам (см. README).
5. Убедиться, что bucket **inspection-photos** существует и **не публичный**.

## Проверка перед демо

- [ ] В репозитории нет `service_role` в TS/TSX.
- [ ] `.env.local` не в git.
- [ ] RLS включён на `branches`, `employees`, `inspections`, `profiles`, `audit_logs`, `inspection_photos`, `shift_schedule_snapshots`.
- [ ] Тестовые пользователи admin / manager / qc с разными филиалами.
- [ ] Middleware режет `/audit` для не-admin.

## Что желательно улучшить позже

- **MFA** для админов в Supabase.
- **Серверные Route Handlers** для чувствительных отчётов.
- **Подписанные URL** с коротким TTL и аудит скачиваний фото.
- **Ротация ключей** при подозрении на утечку anon key.

## Данные графика смен

Таблица `shift_schedule_snapshots` с RLS по филиалу и роли; поля `updated_by`, `period_label`, `branch_id` для истории изменений.
