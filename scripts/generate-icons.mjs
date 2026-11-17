// Generates the PWA icon PNGs from the text SVG source (public/icon.svg).
//
// Why: the GitHub push tool can only push UTF-8 text files, so the binary
// PNGs cannot be committed. The SVG is the committed source of truth;
// this script renders the PNGs at build time (it runs as the "prebuild"
// script, so Vercel produces them before `next build`). The PNGs are
// build artifacts: they are gitignored and never committed.
//
// Outputs (all into public/, paths the manifest and layout already use):
//   icon-192.png          192x192
//   icon-512.png          512x512
//   icon-maskable-512.png 512x512, artwork at ~80% on a solid cream
//                         background so the OS mask never crops the book
//                         or the heart (maskable safe zone)
//   apple-touch-icon.png  180x180 (iPhone home screen)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
const svg = readFileSync(join(pub, "icon.svg"));

const CREAM = "#fff7ed";

async function main() {
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

main().catch((error) => {
  console.error("Failed to generate PWA icons:", error);
  process.exit(1);
});
