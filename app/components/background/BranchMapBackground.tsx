"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { BRANCH_MAP_SLOTS, createBranchMapEngine } from "./branchMapEngine";
import { useEnergyWebCapabilities, type EnergyWebMode } from "./useEnergyWebCapabilities";

type BranchMapBackgroundProps = {
  className?: string;
};

function StaticBranchMapFallback({ className }: BranchMapBackgroundProps) {
  const hub = BRANCH_MAP_SLOTS.find((node) => node.label === "Площадь") ?? BRANCH_MAP_SLOTS[0];

  return (
    <motion.div
      aria-hidden
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.12), transparent 48%), radial-gradient(circle at 30% 70%, rgba(167, 139, 250, 0.1), transparent 42%), linear-gradient(145deg, #020617 0%, #07111f 50%, #020617 100%)",
      }}
    >
      <svg
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.55 }}
      >
        <g stroke="rgba(34, 211, 238, 0.22)" strokeWidth="1" fill="none">
          {BRANCH_MAP_SLOTS.map((node) => (
            <line
              key={`link-${node.id}`}
              x1={hub.nx * 1000}
              y1={hub.ny * 700}
              x2={node.nx * 1000}
              y2={node.ny * 700}
            />
          ))}
        </g>
        {BRANCH_MAP_SLOTS.map((node) => (
          <g key={node.id}>
            <circle cx={node.nx * 1000} cy={node.ny * 700} r="10" fill="rgba(34, 211, 238, 0.18)" />
            <circle cx={node.nx * 1000} cy={node.ny * 700} r="4" fill="rgba(103, 232, 249, 0.85)" />
          </g>
        ))}
      </svg>
    </motion.div>
  );
}

export default function BranchMapBackground({ className }: BranchMapBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const capabilities = useEnergyWebCapabilities();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (capabilities.mode === "static" || prefersReducedMotion) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    const mode: EnergyWebMode = capabilities.mode;
    let engine = createBranchMapEngine(1, 1, mode, BRANCH_MAP_SLOTS);
    let lastTime = 0;
    let visible = document.visibilityState === "visible";

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      engine.resize(width, height, mode, BRANCH_MAP_SLOTS);
      engine.setPointer(width * 0.5, height * 0.5);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (mode === "lite" && event.pointerType === "touch") return;
      engine.setPointer(event.clientX, event.clientY);
    };

    const onVisibilityChange = () => {
      visible = document.visibilityState === "visible";
      if (visible) {
        lastTime = performance.now();
        animationId = requestAnimationFrame(render);
      } else {
        cancelAnimationFrame(animationId);
      }
    };

    const render = (time: number) => {
      if (!visible) return;

      const delta = lastTime === 0 ? 16 : time - lastTime;
      lastTime = time;

      engine.update(time, delta);
      engine.draw(ctx, time);
      animationId = requestAnimationFrame(render);
    };

    resize();
    lastTime = performance.now();
    animationId = requestAnimationFrame(render);

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [capabilities.mode, prefersReducedMotion]);

  if (capabilities.mode === "static" || prefersReducedMotion) {
    return <StaticBranchMapFallback className={className} />;
  }

  return (
    <motion.div
      aria-hidden
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
    </motion.div>
  );
}
