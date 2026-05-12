import type { EnergyWebMode } from "./useEnergyWebCapabilities";

export type BranchMapNodeDef = {
  id: number;
  label: string;
  nx: number;
  ny: number;
};

export const BRANCH_MAP_SLOTS: BranchMapNodeDef[] = [
  { id: 1, label: "Аламедин", nx: 0.08, ny: 0.14 },
  { id: 2, label: "Политех", nx: 0.24, ny: 0.09 },
  { id: 3, label: "ТЭЦ", nx: 0.4, ny: 0.07 },
  { id: 4, label: "Вефа", nx: 0.56, ny: 0.11 },
  { id: 5, label: "8 МКР", nx: 0.72, ny: 0.08 },
  { id: 6, label: "12 МКР", nx: 0.9, ny: 0.14 },
  { id: 7, label: "I-Mall", nx: 0.93, ny: 0.28 },
  { id: 8, label: "Кызыл Аскер", nx: 0.77, ny: 0.24 },
  { id: 9, label: "Площадь", nx: 0.54, ny: 0.48 },
  { id: 10, label: "Бишкек Парк", nx: 0.38, ny: 0.26 },
  { id: 11, label: "Ошский", nx: 0.18, ny: 0.3 },
  { id: 12, label: "7 МКР", nx: 0.06, ny: 0.42 },
  { id: 13, label: "Азия Молл", nx: 0.12, ny: 0.56 },
  { id: 14, label: "6 МКР", nx: 0.28, ny: 0.52 },
  { id: 15, label: "ГУМ", nx: 0.44, ny: 0.44 },
  { id: 16, label: "МТФ", nx: 0.62, ny: 0.38 },
  { id: 17, label: "Озеро Сорока", nx: 0.81, ny: 0.46 },
  { id: 18, label: "10 МКР", nx: 0.94, ny: 0.56 },
  { id: 19, label: "Ала Арча", nx: 0.88, ny: 0.7 },
  { id: 20, label: "Кара-Балта 1", nx: 0.1, ny: 0.74 },
  { id: 21, label: "Кара-Балта 2", nx: 0.26, ny: 0.8 },
  { id: 22, label: "Балыкчы", nx: 0.44, ny: 0.68 },
  { id: 23, label: "Чолпон-Ата", nx: 0.6, ny: 0.76 },
  { id: 24, label: "Каракол", nx: 0.78, ny: 0.84 },
  { id: 25, label: "Бостери", nx: 0.5, ny: 0.9 },
];

const NEON_ACCENTS = [
  { core: "#67e8f9", glow: "rgba(34, 211, 238, 0.55)", line: "rgba(34, 211, 238, 0.42)" },
  { core: "#c4b5fd", glow: "rgba(167, 139, 250, 0.5)", line: "rgba(167, 139, 250, 0.38)" },
  { core: "#f0abfc", glow: "rgba(232, 121, 252, 0.48)", line: "rgba(232, 121, 252, 0.34)" },
] as const;

type BranchNode = BranchMapNodeDef & {
  x: number;
  y: number;
  pulse: number;
  activation: number;
  accent: number;
};

type BranchLink = {
  a: number;
  b: number;
  phase: number;
  speed: number;
  accent: number;
};

export type BranchMapEngine = {
  width: number;
  height: number;
  mode: EnergyWebMode;
  pointer: { x: number; y: number };
  nodes: BranchNode[];
  links: BranchLink[];
  resize: (width: number, height: number, mode: EnergyWebMode, defs: BranchMapNodeDef[]) => void;
  setPointer: (x: number, y: number) => void;
  update: (time: number, delta: number) => void;
  draw: (ctx: CanvasRenderingContext2D, time: number) => void;
};

function buildLinks(nodes: BranchNode[]): BranchLink[] {
  const links: BranchLink[] = [];
  const seen = new Set<string>();

  const add = (a: number, b: number) => {
    if (a === b) return;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({
      a,
      b,
      phase: Math.random(),
      speed: 0.00007 + Math.random() * 0.00006,
      accent: Math.floor(Math.random() * NEON_ACCENTS.length),
    });
  };

  if (nodes.length > 0) {
    const hubIndex = Math.max(
      0,
      nodes.findIndex((node) => node.label === "Площадь")
    );

    for (let i = 0; i < nodes.length; i += 1) {
      if (i !== hubIndex) {
        add(hubIndex, i);
      }
    }
  }

  for (let i = 0; i < nodes.length; i += 1) {
    const neighbors: { index: number; distance: number }[] = [];
    for (let j = 0; j < nodes.length; j += 1) {
      if (i === j) continue;
      const dx = nodes[i].nx - nodes[j].nx;
      const dy = nodes[i].ny - nodes[j].ny;
      neighbors.push({ index: j, distance: Math.hypot(dx, dy) });
    }
    neighbors.sort((left, right) => left.distance - right.distance);
    for (const neighbor of neighbors.slice(0, 1)) {
      add(i, neighbor.index);
    }
  }

  return links;
}

function buildNodes(width: number, height: number, defs: BranchMapNodeDef[]): BranchNode[] {
  return defs.map((def, index) => ({
    ...def,
    x: def.nx * width,
    y: def.ny * height,
    pulse: Math.random() * Math.PI * 2,
    activation: 0,
    accent: index % NEON_ACCENTS.length,
  }));
}

function drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#020617");
  gradient.addColorStop(0.45, "#07111f");
  gradient.addColorStop(1, "#020617");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const mapGlow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    0,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.72
  );
  mapGlow.addColorStop(0, "rgba(34, 211, 238, 0.08)");
  mapGlow.addColorStop(0.45, "rgba(129, 140, 248, 0.05)");
  mapGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = mapGlow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
  ctx.lineWidth = 0.8;
  const step = Math.max(48, Math.min(width, height) / 14);
  for (let x = 0; x <= width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLink(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  accent: (typeof NEON_ACCENTS)[number],
  alpha: number,
  width: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = accent.line;
  ctx.lineWidth = width;
  ctx.shadowBlur = 10;
  ctx.shadowColor = accent.glow;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.restore();
}

function drawLinkPulse(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  accent: (typeof NEON_ACCENTS)[number],
  wave: number,
  alpha: number
) {
  const segment = 0.14;
  const start = Math.max(0, wave - segment);
  const end = Math.min(1, wave + segment);
  const x0 = ax + (bx - ax) * start;
  const y0 = ay + (by - ay) * start;
  const x1 = ax + (bx - ax) * end;
  const y1 = ay + (by - ay) * end;

  ctx.save();
  ctx.strokeStyle = accent.core;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 14;
  ctx.shadowColor = accent.glow;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

function drawBranchNode(
  ctx: CanvasRenderingContext2D,
  node: BranchNode,
  time: number,
  mode: EnergyWebMode,
  showLabel: boolean
) {
  const accent = NEON_ACCENTS[node.accent];
  const pulse = 1 + Math.sin(time * 0.002 + node.pulse) * 0.12;
  const radius = (4.2 + node.activation * 3.4) * pulse;

  ctx.save();
  ctx.shadowBlur = mode === "full" ? 18 : 10;
  ctx.shadowColor = accent.glow;
  ctx.fillStyle = accent.glow;
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius + 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 8;
  ctx.fillStyle = accent.core;
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.beginPath();
  ctx.arc(node.x, node.y, Math.max(1.4, radius * 0.34), 0, Math.PI * 2);
  ctx.fill();

  if (showLabel) {
    const labelX = node.nx > 0.72 ? node.x - 10 : node.x + 10;
    const labelY = node.ny > 0.82 ? node.y - 10 : node.y + 12;

    ctx.font = "600 10px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = node.nx > 0.72 ? "right" : "left";
    ctx.textBaseline = node.ny > 0.82 ? "bottom" : "middle";
    ctx.fillStyle = `rgba(226, 232, 240, ${0.4 + node.activation * 0.45})`;
    ctx.fillText(node.label, labelX, labelY);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
}

export function mapBranchesToLayout(
  branches: { id: number; name: string }[]
): BranchMapNodeDef[] {
  return branches.slice(0, BRANCH_MAP_SLOTS.length).map((branch, index) => {
    const slot = BRANCH_MAP_SLOTS[index] ?? BRANCH_MAP_SLOTS[BRANCH_MAP_SLOTS.length - 1];
    return {
      id: branch.id,
      label: branch.name,
      nx: slot.nx,
      ny: slot.ny,
    };
  });
}

export function createBranchMapEngine(
  width: number,
  height: number,
  mode: EnergyWebMode,
  defs: BranchMapNodeDef[] = BRANCH_MAP_SLOTS
): BranchMapEngine {
  const pointer = { x: width * 0.5, y: height * 0.5 };
  const nodes = buildNodes(width, height, defs);
  const links = buildLinks(nodes);

  const engine: BranchMapEngine = {
    width,
    height,
    mode,
    pointer,
    nodes,
    links,
    resize(nextWidth, nextHeight, nextMode, nextDefs) {
      engine.width = nextWidth;
      engine.height = nextHeight;
      engine.mode = nextMode;
      engine.pointer.x = nextWidth * 0.5;
      engine.pointer.y = nextHeight * 0.5;
      engine.nodes = buildNodes(nextWidth, nextHeight, nextDefs);
      engine.links = buildLinks(engine.nodes);
    },
    setPointer(x, y) {
      engine.pointer.x = x;
      engine.pointer.y = y;
    },
    update(time, delta) {
      const influenceRadius = Math.min(engine.width, engine.height) * (engine.mode === "full" ? 0.18 : 0.14);
      const influenceRadiusSq = influenceRadius * influenceRadius;

      for (const node of engine.nodes) {
        if (engine.mode === "static") {
          node.activation *= 0.9;
          continue;
        }

        const dx = node.x - engine.pointer.x;
        const dy = node.y - engine.pointer.y;
        const distanceSq = dx * dx + dy * dy;
        const proximity =
          distanceSq >= influenceRadiusSq ? 0 : 1 - Math.sqrt(distanceSq) / influenceRadius;
        const ambient = 0.12 + Math.sin(time * 0.0014 + node.pulse) * 0.05;
        const target = Math.min(1, proximity * 0.95 + ambient);
        const ease = engine.mode === "full" ? 0.12 : 0.08;
        node.activation += (target - node.activation) * ease;
      }

      void delta;
    },
    draw(ctx, time) {
      drawBackdrop(ctx, engine.width, engine.height);

      for (const link of engine.links) {
        const a = engine.nodes[link.a];
        const b = engine.nodes[link.b];
        if (!a || !b) continue;

        const accent = NEON_ACCENTS[link.accent];
        const activation = Math.min(1, (a.activation + b.activation) * 0.55);
        const alpha = 0.18 + activation * 0.34;

        drawLink(ctx, a.x, a.y, b.x, b.y, accent, alpha, activation > 0.25 ? 1.35 : 1);

        if (engine.mode === "full") {
          const wave = (link.phase + time * link.speed) % 1;
          drawLinkPulse(ctx, a.x, a.y, b.x, b.y, accent, wave, 0.22 + activation * 0.45);
        }
      }

      for (const node of engine.nodes) {
        drawBranchNode(ctx, node, time, engine.mode, engine.mode !== "lite");
      }
    },
  };

  return engine;
}
