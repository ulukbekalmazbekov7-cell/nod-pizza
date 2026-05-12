import type { AuthError } from "@supabase/supabase-js";

/** Понятные сообщения для корпоративного входа (Supabase Auth / REST). */
export function formatAuthError(error: unknown): string {
  if (!error) return "Неизвестная ошибка авторизации.";

  const auth = error as Partial<AuthError> & { code?: string };
  const msg = (auth.message ?? "").trim();
  const lower = msg.toLowerCase();
  const code = (auth.code ?? "").toLowerCase();

  if (
    code === "signup_disabled" ||
    (lower.includes("signup") && lower.includes("disabled")) ||
    lower.includes("signups not allowed")
  ) {
    return (
      "Регистрация отключена.\n\n" +
      "Учётные записи создаёт только администратор (Supabase → Authentication → Users или через ваш IT-процесс)."
    );
  }

  if (
    code === "email_not_confirmed" ||
    /email not confirmed|email_not_confirmed/i.test(msg)
  ) {
    return (
      "Вход возможен только после подтверждения email.\n\n" +
      "• Открой письмо со ссылкой подтверждения (проверь спам).\n" +
      "• Если письма нет — попроси администратора подтвердить аккаунт в Supabase → Authentication → Users."
    );
  }

  if (
    code === "invalid_credentials" ||
    lower.includes("invalid login") ||
    lower.includes("invalid_credentials") ||
    msg === "Invalid login credentials"
  ) {
    return "Неверный email или пароль.";
  }

  if (lower.includes("user already registered") || lower.includes("already registered")) {
    return "Этот email уже зарегистрирован. Используй вход или обратись к администратору.";
  }

  if (/too many requests|rate limit|429/i.test(msg)) {
    return "Слишком много попыток. Подожди минуту и попробуй снова.";
  }

  if (/failed to fetch|networkerror|load failed/i.test(lower)) {
    return (
      "Нет связи с сервером авторизации.\n\n" +
      "Проверь интернет, URL проекта в .env.local и что проект Supabase не на паузе."
    );
  }

  return msg || "Ошибка авторизации. Обратись к администратору.";
}
