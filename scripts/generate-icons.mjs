// Generates the PWA icon PNGs and the iPhone launch-image PNGs from text
// SVG sources.
//
// Why: the GitHub push tool can only push UTF-8 text files, so the binary
// PNGs cannot be committed. The SVGs are the committed sources of truth;
// this script renders the PNGs at build time (it runs as the "prebuild"
// script, so Vercel produces them before `next build`). The PNGs are
// build artifacts: they are gitignored and never committed.
//
// Icons (from public/icon.svg, the 8-bit pixel-art book + heart):
//   icon-192.png          192x192
//   icon-512.png          512x512
//   icon-maskable-512.png 512x512, artwork at ~80% on a solid cream
//                         background so the OS mask never crops the book
//                         or the heart (maskable safe zone)
//   apple-touch-icon.png  180x180 (iPhone home screen)
//
// iPhone launch images (from scripts/launch-template.svg, filled in per
// size below): full-screen cream background, the pixel book artwork, and
// "Co-op Mode" in pixel letters. The letters are drawn from a small
// built-in 5x7 pixel font defined here, because a real font file is not
// available at prebuild time — next/font only downloads fonts during
// `next build`, which runs after this script. Each PNG is wired up in
// src/app/layout.tsx with an apple-touch-startup-image link tag carrying
// the media query for its device size. Android ignores them: Chrome draws
// its own splash from the manifest instead.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
const svg = readFileSync(join(pub, "icon.svg"));

const CREAM = "#fff7ed";

// --- 5x7 pixel font (only the glyphs "Co-op Mode" needs) -------------------
// Each glyph is 7 rows of 5 cells; "1" is filled, "0" is empty.
const FONT = {
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  p: ["00000", "00000", "01110", "10001", "10001", "11110", "10000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  d: ["00001", "00001", "01101", "10001", "10001", "10001", "01111"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
};

const LAUNCH_TEXT = "Co-op Mode";

// Standard portrait iPhone launch sizes (width x height in device pixels)
// with the CSS-pixel device size and pixel ratio their media query matches.
const LAUNCH_SIZES = [
  { w: 1290, h: 2796, dw: 430, dh: 932, dpr: 3 },
  { w: 1179, h: 2556, dw: 393, dh: 852, dpr: 3 },
  { w: 1284, h: 2778, dw: 428, dh: 926, dpr: 3 },
  { w: 1170, h: 2532, dw: 390, dh: 844, dpr: 3 },
  { w: 1125, h: 2436, dw: 375, dh: 812, dpr: 3 },
  { w: 828, h: 1792, dw: 414, dh: 896, dpr: 2 },
  { w: 750, h: 1334, dw: 375, dh: 667, dpr: 2 },
  { w: 640, h: 1136, dw: 320, dh: 568, dpr: 2 },
];

// Pull the artwork rects out of public/icon.svg, dropping the full-canvas
// background rect (the launch screen draws its own #fff7ed background).
function iconArtworkRects() {
  const rects = [];
  for (const match of svg.toString().matchAll(/<rect\s+([^>]*?)\/>/g)) {
    const attrs = match[1];
    const get = (name) => {
      const m = attrs.match(new RegExp(`${name}="([^"]+)"`));
      return m ? m[1] : null;
    };
    if (get("width") === "512" && get("height") === "512") continue;
    rects.push(match[0]);
  }
  return rects.join("\n    ");
}

// Render LAUNCH_TEXT as pixel rects with its top-left corner at (x0, y0)
// and the given cell size in pixels. One cell of spacing between letters,
// so the text is 59 cells wide (10 glyphs x 5 + 9 gaps x 1).
function textRects(x0, y0, unit) {
  const out = [];
  let cx = x0;
  for (const ch of LAUNCH_TEXT) {
    const glyph = FONT[ch];
    if (!glyph) throw new Error(`No 5x7 glyph for ${JSON.stringify(ch)}`);
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === "1") {
          out.push(
            `<rect x="${cx + col * unit}" y="${y0 + row * unit}" width="${unit}" height="${unit}"/>`,
          );
        }
      }
    }
    cx += 6 * unit;
  }
  return out.join("\n    ");
}

async function generateIcons() {
  // Standard icons: the artwork fills the frame.
  await sharp(svg).resize(192, 192).png().toFile(join(pub, "icon-192.png"));
  await sharp(svg).resize(512, 512).png().toFile(join(pub, "icon-512.png"));

  // Maskable icon: artwork at ~80% (410px) centered on a solid cream
  // 512x512 canvas. The SVG already has a cream background, so the
  // result is cream edge to edge with the book and heart safely inside
  // the maskable safe zone.
  const artwork = await sharp(svg).resize(410, 410).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: CREAM },
  })
    .composite([{ input: artwork, left: 51, top: 51 }])
    .png()
    .toFile(join(pub, "icon-maskable-512.png"));

  // Apple touch icon.
  await sharp(svg)
    .resize(180, 180)
    .png()
    .toFile(join(pub, "apple-touch-icon.png"));

  console.log("PWA icons generated in public/.");
}

async function generateLaunchImages() {
  const template = readFileSync(
    join(root, "scripts", "launch-template.svg"),
    "utf8",
  );
  const artwork = iconArtworkRects();
  for (const { w, h } of LAUNCH_SIZES) {
    // Book roughly a quarter of the screen width; text sized to read well
    // on tall screens; book and text vertically centered as one group.
    const bookW = Math.round(w * 0.28);
    const unit = Math.max(7, Math.round(w * 0.011));
    const textW = LAUNCH_TEXT.length * 6 * unit - unit;
    const gap = Math.round(h * 0.022);
    const groupH = bookW + gap + 7 * unit;
    const startY = Math.round((h - groupH) / 2);
    const bookX = Math.round((w - bookW) / 2);
    const textX = Math.round((w - textW) / 2);
    const textY = startY + bookW + gap;
    const filled = template
      .replaceAll("{{WIDTH}}", String(w))
      .replaceAll("{{HEIGHT}}", String(h))
      .replaceAll("{{BOOK_X}}", String(bookX))
      .replaceAll("{{BOOK_Y}}", String(startY))
      .replaceAll("{{BOOK_SCALE}}", String(bookW / 512))
      .replaceAll("{{ARTWORK}}", artwork)
      .replaceAll("{{TEXT}}", textRects(textX, textY, unit));
    await sharp(Buffer.from(filled))
      .png()
      .toFile(join(pub, `launch-${w}x${h}.png`));
  }
  console.log("iPhone launch images generated in public/.");
}

async function main() {
  await generateIcons();
  await generateLaunchImages();
}

main().catch((error) => {
  console.error("Failed to generate PWA icons:", error);
  process.exit(1);
});
