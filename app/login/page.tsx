"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Point = { x: number; y: number };

export default function LoginPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const pointer = {
      x: width * 0.68,
      y: height * 0.42,
    };

    const jelly = {
      x: width * 0.68,
      y: height * 0.42,
      vx: 0,
      vy: 0,
      radius: 90,
    };

    const tentacles: Point[][] = Array.from({ length: 11 }, (_, i) =>
      Array.from({ length: 22 }, (_, j) => ({
        x: jelly.x + (i - 5) * 10,
        y: jelly.y + j * 16,
      }))
    );

    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 2 + 0.8,
      s: Math.random() * 0.4 + 0.15,
      a: Math.random() * Math.PI * 2,
    }));

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function onMove(e: MouseEvent) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    }

    function onTouch(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      pointer.x = t.clientX;
      pointer.y = t.clientY;
    }

    function drawBackground() {
      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, "#020617");
      bg.addColorStop(0.5, "#081226");
      bg.addColorStop(1, "#020617");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const glow1 = ctx.createRadialGradient(
        jelly.x,
        jelly.y,
        0,
        jelly.x,
        jelly.y,
        260
      );
      glow1.addColorStop(0, "rgba(56, 189, 248, 0.18)");
      glow1.addColorStop(0.5, "rgba(96, 165, 250, 0.10)");
      glow1.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, width, height);

      const glow2 = ctx.createRadialGradient(
        jelly.x + 80,
        jelly.y - 40,
        0,
        jelly.x + 80,
        jelly.y - 40,
        340
      );
      glow2.addColorStop(0, "rgba(168, 85, 247, 0.12)");
      glow2.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, width, height);

      for (const p of particles) {
        p.y -= p.s;
        p.x += Math.sin(p.a += 0.01) * 0.18;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        ctx.beginPath();
        ctx.fillStyle = "rgba(148, 163, 184, 0.18)";
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function updateJelly() {
      const dx = pointer.x - jelly.x;
      const dy = pointer.y - jelly.y;

      jelly.vx += dx * 0.0035;
      jelly.vy += dy * 0.0035;

      jelly.vx *= 0.92;
      jelly.vy *= 0.92;

      jelly.x += jelly.vx;
      jelly.y += jelly.vy;
    }

    function drawTentacles(time: number) {
      for (let i = 0; i < tentacles.length; i++) {
        const line = tentacles[i];
        const offsetX = (i - (tentacles.length - 1) / 2) * 10;
        const sway = Math.sin(time * 0.0018 + i * 0.55) * 12;

        line[0].x += (jelly.x + offsetX + sway - line[0].x) * 0.24;
        line[0].y += (jelly.y + 28 - line[0].y) * 0.24;

        for (let j = 1; j < line.length; j++) {
          const prev = line[j - 1];
          const curr = line[j];
          const wave = Math.sin(time * 0.0022 + j * 0.45 + i) * (j * 0.28);

          curr.x += (prev.x + wave - curr.x) * 0.22;
          curr.y += (prev.y + 13 - curr.y) * 0.22;
        }

        ctx.beginPath();
        ctx.moveTo(line[0].x, line[0].y);

        for (let j = 1; j < line.length - 2; j++) {
          const xc = (line[j].x + line[j + 1].x) / 2;
          const yc = (line[j].y + line[j + 1].y) / 2;
          ctx.quadraticCurveTo(line[j].x, line[j].y, xc, yc);
        }

        const last = line[line.length - 1];
        ctx.lineTo(last.x, last.y);

        ctx.lineWidth = Math.max(1, 4 - i * 0.18);
        ctx.strokeStyle =
          i % 2 === 0
            ? "rgba(125, 211, 252, 0.28)"
            : "rgba(196, 181, 253, 0.24)";
        ctx.stroke();
      }
    }

    function drawHead(time: number) {
      const pulse = Math.sin(time * 0.003) * 4;
      const r = jelly.radius + pulse;

      ctx.save();
      ctx.translate(jelly.x, jelly.y);

      const head = ctx.createRadialGradient(-18, -22, 8, 0, 0, r);
      head.addColorStop(0, "rgba(255,255,255,0.85)");
      head.addColorStop(0.15, "rgba(191,219,254,0.72)");
      head.addColorStop(0.45, "rgba(96,165,250,0.42)");
      head.addColorStop(1, "rgba(59,130,246,0.08)");

      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.92, r * 0.68, -0.18, Math.PI, 0);
      ctx.lineTo(r * 0.78, 8);
      ctx.quadraticCurveTo(0, r * 0.42, -r * 0.78, 8);
      ctx.closePath();
      ctx.fillStyle = head;
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(-10, -18, r * 0.38, r * 0.18, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 12, r * 0.55, 0, Math.PI, false);
      ctx.strokeStyle = "rgba(191,219,254,0.16)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }

    function render(time: number) {
      drawBackground();
      updateJelly();
      drawTentacles(time);
      drawHead(time);
      animationId = requestAnimationFrame(render);
    }

    resize();
    render(0);

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onTouch, { passive: true });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);

  const handleAuth = async () => {
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      }

      router.push("/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ошибка авторизации";
      alert(message);
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
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />

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
              {isLogin ? "Вход" : "Регистрация"}
            </h1>
            <p
              style={{
                margin: "12px 0 0",
                color: "rgba(226, 232, 240, 0.72)",
                fontSize: "15px",
                lineHeight: 1.5,
              }}
            >
              Войди в систему и управляй данными без шаманства и боли.
            </p>
          </div>

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
              disabled={loading}
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
              {loading ? "Загрузка..." : isLogin ? "Войти" : "Создать аккаунт"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            style={{
              marginTop: "18px",
              background: "transparent",
              border: "none",
              padding: 0,
              color: "#7dd3fc",
              cursor: "pointer",
              fontSize: "15px",
            }}
          >
            {isLogin
              ? "Нет аккаунта? Зарегистрироваться"
              : "Уже есть аккаунт? Войти"}
          </button>
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