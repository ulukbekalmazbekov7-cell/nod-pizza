"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import BranchMapBackground from "@/app/components/background/BranchMapBackground";
import { formatAuthError } from "@/lib/authErrors";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!isSupabaseConfigured) {
      alert(
        "Не заданы переменные Supabase. Создай в корне проекта файл .env.local с:\n\n" +
          "NEXT_PUBLIC_SUPABASE_URL=… (из Project Settings → API)\n" +
          "NEXT_PUBLIC_SUPABASE_ANON_KEY=… (anon public key)\n\n" +
          "Перезапусти npm run dev и попробуй снова."
      );
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push("/");
    } catch (error) {
      alert(formatAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        background: "#020617",
        color: "#fff",
      }}
    >
      <BranchMapBackground />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "32px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            marginLeft: "clamp(0px, 7vw, 90px)",
            borderRadius: "28px",
            padding: "32px",
            backdropFilter: "blur(22px)",
            WebkitBackdropFilter: "blur(22px)",
            background: "rgba(9, 14, 28, 0.42)",
            border: "1px solid rgba(148, 163, 184, 0.16)",
            boxShadow:
              "0 10px 50px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ marginBottom: "22px" }}>
            <div
              style={{
                fontSize: "13px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(191, 219, 254, 0.72)",
                marginBottom: "10px",
              }}
            >
              Nod Pizza
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: "42px",
                lineHeight: 1.05,
                fontWeight: 700,
              }}
            >
              Вход
            </h1>
            <p
              style={{
                margin: "12px 0 0",
                color: "rgba(226, 232, 240, 0.72)",
                fontSize: "15px",
                lineHeight: 1.5,
              }}
            >
              Корпоративный доступ: только для выданных учётных записей. Регистрация через сайт
              отключена — пользователей добавляет администратор.
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div
              style={{
                marginBottom: "4px",
                padding: "12px 14px",
                borderRadius: "14px",
                fontSize: "14px",
                lineHeight: 1.45,
                color: "#fecaca",
                background: "rgba(127, 29, 29, 0.45)",
                border: "1px solid rgba(248, 113, 113, 0.35)",
              }}
            >
              <strong>База не подключена.</strong> Добавь в корень проекта{" "}
              <code style={{ color: "#fde68a" }}>.env.local</code> переменные{" "}
              <code style={{ color: "#fde68a" }}>NEXT_PUBLIC_SUPABASE_URL</code> и{" "}
              <code style={{ color: "#fde68a" }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
              (Supabase → Project Settings → API), затем перезапусти dev-сервер. Поддомен в URL
              должен совпадать с <strong>Project reference</strong> в настройках проекта.
            </div>
          )}

          <div style={{ display: "grid", gap: "14px" }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />

            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />

            <button
              onClick={handleAuth}
              disabled={loading || !isSupabaseConfigured}
              style={{
                marginTop: "6px",
                width: "100%",
                border: "none",
                borderRadius: "16px",
                padding: "14px 18px",
                fontSize: "16px",
                fontWeight: 700,
                color: "#fff",
                cursor: loading ? "default" : "pointer",
                background:
                  "linear-gradient(135deg, rgba(37,99,235,0.95), rgba(147,51,234,0.95))",
                boxShadow:
                  "0 10px 30px rgba(37,99,235,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? "Загрузка..." : "Войти"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "16px",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  outline: "none",
  background: "rgba(15, 23, 42, 0.56)",
  color: "#fff",
  fontSize: "15px",
  boxSizing: "border-box",
};