import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCanvas,
  GlobalFonts,
  loadImage,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import type { UserLevel } from "../leveling/leveling.types";
import { xpForNextLevelUp, xpInCurrentLevel } from "../leveling/xp";

// ---------------------------------------------------------------------------
// Font registration (runs once at module load)
// ---------------------------------------------------------------------------
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FONTS_DIR = join(__dirname, "fonts");

GlobalFonts.registerFromPath(join(FONTS_DIR, "Poppins-Regular.ttf"), "Poppins");
GlobalFonts.registerFromPath(
  join(FONTS_DIR, "Poppins-SemiBold.ttf"),
  "Poppins SemiBold",
);
GlobalFonts.registerFromPath(
  join(FONTS_DIR, "Poppins-Bold.ttf"),
  "Poppins Bold",
);

// ---------------------------------------------------------------------------
// Catppuccin Mocha palette
// ---------------------------------------------------------------------------
const MOCHA = {
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  surface0: "#313244",
  surface1: "#45475a",
  surface2: "#585b70",
  overlay0: "#6c7086",
  subtext0: "#a6adc8",
  subtext1: "#bac2de",
  text: "#cdd6f4",
  blue: "#89b4fa",
  yellow: "#f9e2af",
  mauve: "#cba6f7",
  sapphire: "#74c7ec",
  sky: "#89dceb",
  green: "#a6e3a1",
  peach: "#fab387",
};

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const CARD_WIDTH = 934;
const CARD_HEIGHT = 280;

const PADDING = 30;
const BORDER_RADIUS = 20;

const AVATAR_SIZE = 180;
const AVATAR_X = PADDING + 10;
const AVATAR_Y = (CARD_HEIGHT - AVATAR_SIZE) / 2;
const AVATAR_RING = 4; // px ring around avatar

const CONTENT_X = AVATAR_X + AVATAR_SIZE + 30;
const CONTENT_RIGHT = CARD_WIDTH - PADDING;

// Progress bar
const BAR_Y = 200;
const BAR_HEIGHT = 26;
const BAR_RADIUS = BAR_HEIGHT / 2;
const BAR_X = CONTENT_X;
const BAR_WIDTH = CONTENT_RIGHT - CONTENT_X;

// Rank / Level block (top-right)
const STATS_RIGHT = CARD_WIDTH - PADDING;
const STATS_Y_LABEL = 62;
const STATS_Y_VALUE = 112;

// In-memory cache: guildId → decoded Image
const backgroundCache = new Map<
  string,
  Awaited<ReturnType<typeof loadImage>>
>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function renderRankCard(
  guildId: string,
  userLevel: UserLevel,
  rank: number | null,
  avatarUrl: string,
  backgroundImage: Buffer | null,
): Promise<Buffer> {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext("2d");

  // --- Background ---
  await drawBackground(ctx, backgroundImage, guildId);

  // --- Card border ---
  ctx.strokeStyle = MOCHA.surface1;
  ctx.lineWidth = 2;
  roundedRectPath(ctx, 1, 1, CARD_WIDTH - 2, CARD_HEIGHT - 2, BORDER_RADIUS);
  ctx.stroke();

  // --- Avatar with ring ---
  await drawAvatar(ctx, avatarUrl);

  // --- Username ---
  ctx.fillStyle = MOCHA.text;
  ctx.font = `600 38px "Poppins SemiBold", Poppins, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(userLevel.username, CONTENT_X, 155);

  // --- Rank & Level (top right) ---
  drawStatBlock(
    ctx,
    "LEVEL",
    String(userLevel.level),
    STATS_RIGHT - 160,
    MOCHA.yellow,
  );
  drawStatBlock(
    ctx,
    "RANK",
    rank != null ? `#${rank}` : "N/A",
    STATS_RIGHT,
    MOCHA.text,
  );

  // --- XP progress bar ---
  const currentXpInLevel = xpInCurrentLevel(userLevel.xp, userLevel.level);
  const xpNeeded = xpForNextLevelUp(userLevel.level);
  const progress = xpNeeded > 0 ? Math.min(currentXpInLevel / xpNeeded, 1) : 0;

  drawProgressBar(ctx, progress);

  // --- XP label ---
  const xpLabel = formatXp(currentXpInLevel, xpNeeded);
  ctx.fillStyle = MOCHA.subtext0;
  ctx.font = `400 20px Poppins, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(xpLabel, BAR_X + BAR_WIDTH, BAR_Y - 10);
  ctx.textAlign = "left";

  return canvas.encode("png");
}

export function invalidateBackgroundCache(guildId: string): void {
  backgroundCache.delete(guildId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function drawBackground(
  ctx: SKRSContext2D,
  backgroundImage: Buffer | null,
  guildId: string,
): Promise<void> {
  if (backgroundImage) {
    let bg = backgroundCache.get(guildId);
    if (!bg) {
      bg = await loadImage(backgroundImage);
      backgroundCache.set(guildId, bg);
    }
    ctx.save();
    roundedRectPath(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, BORDER_RADIUS);
    ctx.clip();
    // Cover: scale to fill while preserving aspect ratio, center-crop
    const scale = Math.max(CARD_WIDTH / bg.width, CARD_HEIGHT / bg.height);
    const sw = bg.width * scale;
    const sh = bg.height * scale;
    const sx = (CARD_WIDTH - sw) / 2;
    const sy = (CARD_HEIGHT - sh) / 2;
    ctx.drawImage(bg, sx, sy, sw, sh);
    ctx.fillStyle = "rgba(0,0,0,0.50)";
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    ctx.restore();
    return;
  }

  // Catppuccin Mocha base background
  ctx.save();
  roundedRectPath(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, BORDER_RADIUS);
  ctx.clip();
  ctx.fillStyle = MOCHA.base;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.restore();
}

async function drawAvatar(
  ctx: SKRSContext2D,
  avatarUrl: string,
): Promise<void> {
  const cx = AVATAR_X + AVATAR_SIZE / 2;
  const cy = AVATAR_Y + AVATAR_SIZE / 2;
  const r = AVATAR_SIZE / 2;

  // Outer ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + AVATAR_RING, 0, Math.PI * 2);
  ctx.fillStyle = MOCHA.yellow;
  ctx.fill();
  ctx.restore();

  try {
    const avatar = await loadImage(avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE);
    ctx.restore();
  } catch {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = MOCHA.surface1;
    ctx.fill();
    ctx.restore();
  }
}

function drawStatBlock(
  ctx: SKRSContext2D,
  label: string,
  value: string,
  rightEdge: number,
  valueColor: string,
): void {
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";

  // Label
  ctx.fillStyle = MOCHA.subtext0;
  ctx.font = `400 18px Poppins, sans-serif`;
  ctx.fillText(label, rightEdge, STATS_Y_LABEL);

  // Value
  ctx.fillStyle = valueColor;
  ctx.font = `700 46px "Poppins Bold", Poppins, sans-serif`;
  ctx.fillText(value, rightEdge, STATS_Y_VALUE);

  ctx.textAlign = "left";
}

function drawProgressBar(ctx: SKRSContext2D, progress: number): void {
  // Track
  ctx.fillStyle = MOCHA.surface0;
  roundedRectPath(ctx, BAR_X, BAR_Y, BAR_WIDTH, BAR_HEIGHT, BAR_RADIUS);
  ctx.fill();

  // Fill
  if (progress > 0) {
    const fillWidth = Math.max(BAR_RADIUS * 2, BAR_WIDTH * progress);

    // Glow effect — soft shadow behind fill
    ctx.save();
    ctx.shadowColor = MOCHA.yellow;
    ctx.shadowBlur = 4;
    ctx.fillStyle = MOCHA.yellow;
    roundedRectPath(ctx, BAR_X, BAR_Y, fillWidth, BAR_HEIGHT, BAR_RADIUS);
    ctx.fill();
    ctx.restore();
  }
}

function roundedRectPath(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function formatXp(current: number, total: number): string {
  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  return `${fmt(current)} / ${fmt(total)} XP`;
}
