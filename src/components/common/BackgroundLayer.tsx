import { useBackground } from "../../context/backgroundContext";
import { buildFilterCss } from "../../utils/backgroundFilters";

/**
 * The wall the shelves hang on. Two fixed, non-scrolling layers:
 *
 * 1. the custom wallpaper (cover-sized, centered) when one is set — the
 *    default `<body>` paper texture shows through otherwise, and also as the
 *    opacity slider fades the photo out;
 * 2. the scene's lighting — a key light high and slightly left, falling off
 *    toward a darker bottom, plus an edge vignette. This one renders whether
 *    or not there's a photo: it's what keeps the shelves reading as lit
 *    objects in a room rather than flat shapes on a flat field.
 */
export function BackgroundLayer() {
  const { imageUrl, bgOpacity, filter, filterIntensity } = useBackground();

  return (
    <>
      {imageUrl ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            opacity: bgOpacity / 100,
            filter: buildFilterCss(filter, filterIntensity),
            // Blur needs to sample past the element's own edge or a soft rim
            // shows around the viewport — scale up just enough to hide it.
            transform: filter === "blur" ? "scale(1.1)" : undefined,
          }}
        />
      ) : null}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10"
        style={{
          background:
            // Key light: bright near the top, falling away to a dark floor —
            // a dark bottom is what makes the upper shelf read as overhead.
            "radial-gradient(ellipse 120% 80% at 47% 8%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 40%, rgba(0,0,0,0.14) 75%, rgba(0,0,0,0.28) 100%), " +
            // Edge vignette, so the corners don't compete with the shelves.
            "radial-gradient(ellipse at 50% 50%, transparent 58%, rgba(0,0,0,0.20) 100%)",
        }}
      />
    </>
  );
}
