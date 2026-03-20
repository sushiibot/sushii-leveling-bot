/**
 * Interactive preview server — renders rank cards on demand.
 *
 * Usage:
 *   bun src/features/rank-card/preview.ts [--port 3000]
 */

import logger from "../../logger";
import { UserLevel } from "../leveling/leveling.types";
import { totalXpForLevel, xpToNextLevel } from "../leveling/xp";
import { renderRankCard } from "./rank-card.service";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const port = parseInt(arg("port") ?? "3000", 10);

// ---------------------------------------------------------------------------
// Render endpoint — GET /render?username=&level=&progress=&rank=&avatar=&background=
// avatar and background can be any URL (including data: URLs)
// ---------------------------------------------------------------------------
async function handleRender(url: URL): Promise<Response> {
  const username = url.searchParams.get("username") ?? "preview";
  const level = Math.max(
    0,
    parseInt(url.searchParams.get("level") ?? "10", 10),
  );
  const progress = Math.max(
    0,
    Math.min(1, parseFloat(url.searchParams.get("progress") ?? "0.5")),
  );
  const rankParam = url.searchParams.get("rank");
  const rank =
    rankParam === "" || rankParam === null ? null : parseInt(rankParam, 10);
  const avatarUrl =
    url.searchParams.get("avatar") ??
    "https://cdn.discordapp.com/embed/avatars/0.png";
  const bgParam = url.searchParams.get("background") ?? "";

  const base = totalXpForLevel(level);
  const needed = xpToNextLevel(level);
  const xp = base + Math.floor(needed * progress);

  // Decode background data URL → Buffer if provided
  let background: Buffer | null = null;
  if (bgParam) {
    if (bgParam.startsWith("data:")) {
      const b64 = bgParam.split(",")[1];
      if (b64) background = Buffer.from(b64, "base64");
    } else {
      const res = await fetch(bgParam);
      background = Buffer.from(await res.arrayBuffer());
    }
  }

  try {
    const buf = await renderRankCard(
      "preview",
      new UserLevel("preview", "preview", xp, 0, new Date(0)),
      Number.isNaN(rank as number) ? null : rank,
      avatarUrl,
      background,
      "yellow",
      username,
    );
    return new Response(buf, {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (err) {
    logger.error(err, "Render error");
    return new Response(`Render failed: ${String(err)}`, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// HTML UI
// ---------------------------------------------------------------------------
const HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Rank Card Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #181825;
      color: #cdd6f4;
      font-family: "Segoe UI", system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem;
      gap: 2rem;
    }

    h1 { font-size: 1rem; color: #6c7086; letter-spacing: 0.08em; text-transform: uppercase; }

    /* Preview */
    #preview-wrap {
      width: 100%;
      max-width: 934px;
    }
    #preview {
      width: 100%;
      border-radius: 14px;
      display: block;
      min-height: 140px;
      background: #11111b;
    }
    #status { margin-top: 0.5rem; font-size: 0.75rem; color: #6c7086; min-height: 1em; }

    /* Controls */
    .controls {
      width: 100%;
      max-width: 934px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 600px) { .controls { grid-template-columns: 1fr; } }

    .field { display: flex; flex-direction: column; gap: 0.35rem; }
    .field.full { grid-column: 1 / -1; }

    label { font-size: 0.75rem; color: #a6adc8; letter-spacing: 0.05em; text-transform: uppercase; }

    input[type="text"],
    input[type="number"],
    input[type="range"] {
      background: #1e1e2e;
      border: 1px solid #313244;
      border-radius: 6px;
      color: #cdd6f4;
      font-size: 0.9rem;
      padding: 0.45rem 0.65rem;
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus { border-color: #f9e2af; }

    input[type="range"] {
      padding: 0.25rem 0;
      accent-color: #f9e2af;
      cursor: pointer;
    }

    .range-row { display: flex; align-items: center; gap: 0.6rem; }
    .range-row input[type="range"] { flex: 1; }
    .range-val { font-size: 0.8rem; color: #f9e2af; min-width: 3ch; text-align: right; }

    .avatar-row { display: flex; gap: 0.5rem; align-items: flex-start; }
    .avatar-row input[type="text"] { flex: 1; }
    .avatar-thumb {
      width: 44px; height: 44px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #313244;
      flex-shrink: 0;
    }

    .file-btn {
      display: inline-block;
      padding: 0.4rem 0.75rem;
      background: #313244;
      border-radius: 6px;
      font-size: 0.8rem;
      color: #cdd6f4;
      cursor: pointer;
      border: 1px solid #45475a;
      transition: background 0.15s;
      white-space: nowrap;
    }
    .file-btn:hover { background: #45475a; }
    input[type="file"] { display: none; }

    .bg-row { display: flex; gap: 0.5rem; align-items: center; }
    .bg-row input[type="text"] { flex: 1; }
    .bg-clear {
      padding: 0.4rem 0.6rem;
      background: #313244;
      border: 1px solid #45475a;
      border-radius: 6px;
      color: #f38ba8;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .bg-clear:hover { background: #45475a; }
  </style>
</head>
<body>
  <h1>Rank Card Preview</h1>

  <div id="preview-wrap">
    <img id="preview" src="" alt="rank card preview" />
    <div id="status">Loading…</div>
  </div>

  <div class="controls">
    <!-- Username -->
    <div class="field">
      <label for="username">Username</label>
      <input id="username" type="text" value="tzuwy" maxlength="32" />
    </div>

    <!-- Rank -->
    <div class="field">
      <label for="rank">Rank (blank = N/A)</label>
      <input id="rank" type="number" value="54" min="1" />
    </div>

    <!-- Level -->
    <div class="field">
      <label>Level — <span id="level-val">10</span></label>
      <div class="range-row">
        <input id="level" type="range" min="0" max="100" value="10" />
        <span class="range-val" id="level-display">10</span>
      </div>
    </div>

    <!-- Progress -->
    <div class="field">
      <label>XP Progress — <span id="progress-val">50%</span></label>
      <div class="range-row">
        <input id="progress" type="range" min="0" max="100" value="50" />
        <span class="range-val" id="progress-display">50%</span>
      </div>
    </div>

    <!-- Avatar -->
    <div class="field full">
      <label>Avatar</label>
      <div class="avatar-row">
        <input id="avatar" type="text" placeholder="https://... or upload →" />
        <label class="file-btn" for="avatar-file">Upload</label>
        <input id="avatar-file" type="file" accept="image/*" />
        <img id="avatar-thumb" class="avatar-thumb" src="https://cdn.discordapp.com/embed/avatars/0.png" alt="" />
      </div>
    </div>

    <!-- Background -->
    <div class="field full">
      <label>Background image</label>
      <div class="bg-row">
        <input id="background" type="text" placeholder="https://... or upload →" />
        <label class="file-btn" for="bg-file">Upload</label>
        <input id="bg-file" type="file" accept="image/*" />
        <button class="bg-clear" id="bg-clear" title="Clear background">✕</button>
      </div>
    </div>
  </div>

  <script>
    const $ = id => document.getElementById(id);
    let debounceTimer = null;
    let bgDataUrl = "";

    function debounce(fn, ms = 300) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fn, ms);
    }

    function update() {
      const username  = $("username").value || "preview";
      const level     = $("level").value;
      const progress  = ($("progress").value / 100).toFixed(3);
      const rankRaw   = $("rank").value.trim();
      const avatar    = $("avatar").value.trim() || "https://cdn.discordapp.com/embed/avatars/0.png";
      const bg        = bgDataUrl || $("background").value.trim();

      const params = new URLSearchParams({ username, level, progress, rank: rankRaw, avatar });
      if (bg) params.set("background", bg);

      const url = "/render?" + params.toString();
      $("status").textContent = "Rendering…";

      const img = new Image();
      img.onload = () => {
        $("preview").src = img.src;
        $("status").textContent = "";
      };
      img.onerror = () => {
        $("status").textContent = "Render failed — check console";
      };
      img.src = url;
    }

    // Sliders
    $("level").addEventListener("input", e => {
      $("level-display").textContent = e.target.value;
      debounce(update);
    });
    $("progress").addEventListener("input", e => {
      $("progress-display").textContent = e.target.value + "%";
      debounce(update);
    });

    // Text inputs
    ["username", "rank", "avatar", "background"].forEach(id => {
      $(id).addEventListener("input", () => debounce(update));
    });

    // Avatar file upload
    $("avatar-file").addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target.result;
        $("avatar").value = "";
        $("avatar-thumb").src = dataUrl;
        // store directly in the avatar field as data URL
        $("avatar").value = dataUrl;
        update();
      };
      reader.readAsDataURL(file);
    });

    // Sync avatar thumb with URL field
    $("avatar").addEventListener("change", e => {
      if (e.target.value.startsWith("http")) $("avatar-thumb").src = e.target.value;
    });

    // Background file upload
    $("bg-file").addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        bgDataUrl = ev.target.result;
        $("background").value = "";
        $("background").placeholder = file.name;
        update();
      };
      reader.readAsDataURL(file);
    });

    // Clear background
    $("bg-clear").addEventListener("click", () => {
      bgDataUrl = "";
      $("background").value = "";
      $("background").placeholder = "https://... or upload →";
      $("bg-file").value = "";
      update();
    });

    update();
  </script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const server = Bun.serve({
  port,
  routes: {
    "/": () => new Response(HTML, { headers: { "Content-Type": "text/html" } }),
    "/render": (req) => handleRender(new URL(req.url)),
  },
});

logger.info(`Rank card preview → http://localhost:${server.port}`);
logger.info("Open in browser. Ctrl+C to stop.");
