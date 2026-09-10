import { fileURLToPath } from "node:url";
import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";

const FRAME_SIZE = 1024;

export interface FrameStyle {
  id: string;
  name: string;
  assetPath: string;
}

// Sawadika Game reward frames (https://www.lalisaofficial.com/sawadikagame/)
export const FRAME_STYLES: FrameStyle[] = [
  { id: "gloves", name: "Gloves", assetPath: "./assets/gloves.png" },
  { id: "lisa-flex", name: "Lisa Flex", assetPath: "./assets/lisa-flex.png" },
  { id: "pray", name: "Pray", assetPath: "./assets/pray.png" },
  {
    id: "victory-pose",
    name: "Victory Pose",
    assetPath: "./assets/victory-pose.png",
  },
  { id: "sawadika", name: "Sawadika", assetPath: "./assets/sawadika.png" },
  { id: "tuktuk", name: "Tuk Tuk", assetPath: "./assets/tuktuk.png" },
];

const frameImageCache = new Map<
  string,
  Promise<Awaited<ReturnType<typeof loadImage>>>
>();

function loadFrameImage(style: FrameStyle) {
  let cached = frameImageCache.get(style.id);
  if (!cached) {
    cached = loadImage(fileURLToPath(import.meta.resolve(style.assetPath)));
    frameImageCache.set(style.id, cached);
  }
  return cached;
}

export function randomFrameStyle(): FrameStyle {
  // biome-ignore lint/style/noNonNullAssertion: index is always in bounds
  return FRAME_STYLES[Math.floor(Math.random() * FRAME_STYLES.length)]!;
}

export function frameStyleById(id: string): FrameStyle | undefined {
  return FRAME_STYLES.find((style) => style.id === id);
}

export async function renderAvatarFrame(
  avatarUrl: string,
  style: FrameStyle,
): Promise<Buffer> {
  const [avatar, frame] = await Promise.all([
    loadImage(avatarUrl),
    loadFrameImage(style),
  ]);

  const canvas = createCanvas(FRAME_SIZE, FRAME_SIZE);
  const ctx = canvas.getContext("2d");

  drawCover(ctx, avatar);
  ctx.drawImage(frame, 0, 0, FRAME_SIZE, FRAME_SIZE);

  return canvas.encode("png");
}

// Scales the avatar to fill the canvas, cropping to a centered square.
function drawCover(
  ctx: SKRSContext2D,
  image: Awaited<ReturnType<typeof loadImage>>,
): void {
  const scale = Math.max(FRAME_SIZE / image.width, FRAME_SIZE / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const x = (FRAME_SIZE - w) / 2;
  const y = (FRAME_SIZE - h) / 2;
  ctx.drawImage(image, x, y, w, h);
}
