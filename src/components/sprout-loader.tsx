"use client";

// SproutLoader: a small 8-bit pixel-art sprout that grows into a flower
// while the app loads its data, Stardew Valley style. Four frames on a
// 16x16 grid (seed -> sprout -> tall stem -> bloom), played once in
// order with CSS, then holds on the bloom until the app is ready.
// Rendered only by the loading state in CouplesApp; it disappears as
// soon as content renders and adds no delay of its own.

// One pixel rect: [x, y, width, height, fill]. Grid is 16x16, one cell
// is 8 units in the 128x128 viewBox.
type Rect = [number, number, number, number, string];

const SOIL: Rect[] = [
  [6, 13, 4, 1, "#8a5a3b"],
  [4, 14, 8, 1, "#8a5a3b"],
  [3, 15, 10, 1, "#6b4429"],
  [5, 14, 1, 1, "#6b4429"],
  [10, 14, 1, 1, "#6b4429"],
];

// Frame 0: a seed resting on the soil, with a tiny green nub.
const FRAME_SEED: Rect[] = [
  [7, 11, 2, 2, "#b07d2b"],
  [8, 11, 1, 1, "#8a6d3b"],
  [8, 10, 1, 1, "#7fbf6a"],
];

// Frame 1: a little sprout with two leaves.
const FRAME_SPROUT: Rect[] = [
  [7, 11, 2, 3, "#5da24a"],
  [5, 11, 2, 1, "#5da24a"],
  [9, 11, 2, 1, "#5da24a"],
  [7, 10, 2, 1, "#7fbf6a"],
];

// Frame 2: a taller stem, two leaf pairs, and a bud on top.
const FRAME_STEM: Rect[] = [
  [7, 8, 2, 6, "#5da24a"],
  [4, 10, 3, 1, "#5da24a"],
  [9, 10, 3, 1, "#5da24a"],
  [4, 10, 1, 1, "#3e7a33"],
  [11, 10, 1, 1, "#3e7a33"],
  [5, 12, 2, 1, "#5da24a"],
  [9, 12, 2, 1, "#5da24a"],
  [7, 6, 2, 2, "#7fbf6a"],
  [7, 6, 1, 1, "#a5d68f"],
];

// Frame 3: the bloom. A coral flower with a gold center on the full stem.
const FRAME_BLOOM: Rect[] = [
  [7, 8, 2, 6, "#5da24a"],
  [4, 11, 3, 1, "#5da24a"],
  [9, 11, 3, 1, "#5da24a"],
  [4, 11, 1, 1, "#3e7a33"],
  [11, 11, 1, 1, "#3e7a33"],
  [7, 3, 2, 1, "#ff776a"],
  [6, 4, 4, 1, "#ff776a"],
  [5, 5, 6, 2, "#ff776a"],
  [7, 5, 2, 2, "#f6d49b"],
  [10, 6, 1, 1, "#e05a52"],
  [7, 7, 2, 1, "#ff776a"],
];

const FRAMES: Rect[][] = [FRAME_SEED, FRAME_SPROUT, FRAME_STEM, FRAME_BLOOM];

export default function SproutLoader() {
  return (
    <div
      className="flex min-h-[70vh] flex-col items-center justify-center gap-3"
      role="status"
      aria-label="Loading your book"
    >
      <div className="sprout-loader relative h-24 w-24" aria-hidden="true">
        {FRAMES.map((rects, i) => (
          <svg
            key={i}
            viewBox="0 0 128 128"
            className={`sprout-frame sprout-frame-${i}`}
          >
            {[...SOIL, ...rects].map(([x, y, w, h, fill], j) => (
              <rect key={j} x={x * 8} y={y * 8} width={w * 8} height={h * 8} fill={fill} />
            ))}
          </svg>
        ))}
      </div>
      <p className="text-center text-sm text-[var(--dim)]">Growing your book…</p>
      <style>{`
        .sprout-loader { animation: sprout-bob 2.4s ease-in-out infinite; }
        .sprout-loader svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          image-rendering: auto;
          opacity: 0;
        }
        .sprout-loader svg.sprout-frame-0 { animation: sprout-frame 1.2s linear 0s forwards; }
        .sprout-loader svg.sprout-frame-1 { animation: sprout-frame 1.2s linear 0.3s forwards; }
        .sprout-loader svg.sprout-frame-2 { animation: sprout-frame 1.2s linear 0.6s forwards; }
        .sprout-loader svg.sprout-frame-3 { animation: sprout-bloom 1.2s linear 0.9s forwards; }
        @keyframes sprout-frame {
          0%, 24.9% { opacity: 1; }
          25%, 100% { opacity: 0; }
        }
        @keyframes sprout-bloom {
          0%, 100% { opacity: 1; }
        }
        @keyframes sprout-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sprout-loader { animation: none; }
          .sprout-loader svg { animation: none; opacity: 0; }
          .sprout-loader svg.sprout-frame-3 { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
