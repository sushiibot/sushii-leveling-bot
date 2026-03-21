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
GlobalFonts.registerFromPath(
  fileURLToPath(import.meta.resolve("./fonts/Poppins-Regular.ttf")),
  "Poppins",
);
GlobalFonts.registerFromPath(
  fileURLToPath(import.meta.resolve("./fonts/Poppins-SemiBold.ttf")),
  "Poppins SemiBold",
);
GlobalFonts.registerFromPath(
  fileURLToPath(import.meta.resolve("./fonts/Poppins-Bold.ttf")),
  "Poppins Bold",
);

// ---------------------------------------------------------------------------
// Username sanitization
// @napi-rs/canvas does not do per-glyph font fallback, so characters outside
// Poppins' coverage render as boxes. Strip them from the username instead.
// Ranges derived from @fontsource/poppins CSS unicode-range declarations.
// ---------------------------------------------------------------------------
const POPPINS_RANGES: [number, number][] = [
  [0x0000, 0x00ff], // Basic Latin + Latin-1 Supplement
  [0x0100, 0x02ba], // Latin Extended A/B
  [0x02bd, 0x02ff],
  [0x0304, 0x0304],
  [0x0308, 0x0308],
  [0x0329, 0x0329],
  [0x0900, 0x097f], // Devanagari
  [0x1cd0, 0x1cf9],
  [0x1d00, 0x1dbf],
  [0x1e00, 0x1e9f],
  [0x1ef2, 0x1eff],
  [0x2000, 0x206f], // General Punctuation
  [0x20a0, 0x20c0], // Currency Symbols
  [0x2113, 0x2113],
  [0x2122, 0x2122],
  [0x2191, 0x2191],
  [0x2193, 0x2193],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
  [0x2c60, 0x2c7f],
  [0xa720, 0xa7ff],
  [0xfeff, 0xfeff],
  [0xfffd, 0xfffd],
];

function stripUnsupportedChars(text: string): string {
  return [...text]
    .filter((char) => {
      // biome-ignore lint/style/noNonNullAssertion: iterating valid string chars
      const cp = char.codePointAt(0)!;
      return POPPINS_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
    })
    .join("");
}

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
  rosewater: "#f5e0dc",
  flamingo: "#f2cdcd",
  pink: "#f5c2e7",
  mauve: "#cba6f7",
  red: "#f38ba8",
  maroon: "#eba0ac",
  peach: "#fab387",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  teal: "#94e2d5",
  sky: "#89dceb",
  sapphire: "#74c7ec",
  blue: "#89b4fa",
  lavender: "#b4befe",
} as const;

type AccentColor = keyof typeof MOCHA_ACCENTS;
const MOCHA_ACCENTS = {
  rosewater: MOCHA.rosewater,
  flamingo: MOCHA.flamingo,
  pink: MOCHA.pink,
  mauve: MOCHA.mauve,
  red: MOCHA.red,
  maroon: MOCHA.maroon,
  peach: MOCHA.peach,
  yellow: MOCHA.yellow,
  green: MOCHA.green,
  teal: MOCHA.teal,
  sky: MOCHA.sky,
  sapphire: MOCHA.sapphire,
  blue: MOCHA.blue,
  lavender: MOCHA.lavender,
} as const;

export const CATPPUCCIN_ACCENT_COLORS = Object.keys(
  MOCHA_ACCENTS,
) as AccentColor[];

function resolveAccentColor(themeColor: string): string {
  return MOCHA_ACCENTS[themeColor as AccentColor] ?? MOCHA.yellow;
}

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
  themeColor = "yellow",
  username: string,
): Promise<Buffer> {
  const accent = resolveAccentColor(themeColor);
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
  await drawAvatar(ctx, avatarUrl, accent);

  // --- Username ---
  ctx.fillStyle = MOCHA.text;
  ctx.font = `600 38px "Poppins SemiBold", Poppins, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(stripUnsupportedChars(username), CONTENT_X, 155);

  // --- Rank & Level (top right) ---
  drawStatBlock(
    ctx,
    "LEVEL",
    String(userLevel.level),
    STATS_RIGHT - 160,
    accent,
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

  drawProgressBar(ctx, progress, accent);

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
  accent: string,
): Promise<void> {
  const cx = AVATAR_X + AVATAR_SIZE / 2;
  const cy = AVATAR_Y + AVATAR_SIZE / 2;
  const r = AVATAR_SIZE / 2;

  // Outer ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + AVATAR_RING, 0, Math.PI * 2);
  ctx.fillStyle = accent;
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

function drawProgressBar(
  ctx: SKRSContext2D,
  progress: number,
  accent: string,
): void {
  // Track — semi-transparent dark glass that blends with any background
  ctx.fillStyle = "rgba(0, 0, 0, 0.50)";
  roundedRectPath(ctx, BAR_X, BAR_Y, BAR_WIDTH, BAR_HEIGHT, BAR_RADIUS);
  ctx.fill();

  // Fill
  if (progress > 0) {
    const fillWidth = Math.max(BAR_RADIUS * 2, BAR_WIDTH * progress);

    // Glow effect — soft shadow behind fill
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 4;
    ctx.fillStyle = accent;
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
