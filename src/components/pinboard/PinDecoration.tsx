import type { PinDecoration as Kind } from "../../types/pin";

interface PinDecorationProps {
  kind: Kind;
}

/**
 * What's holding the pin up, if the owner chose anything. Nothing is applied by
 * default — a board of untouched photos should look like photos, not like a
 * stationery sample. Both options are drawn flat (a plain disc, a plain
 * translucent strip) rather than rendered as objects with highlights and
 * needles; at this size the illustrated version reads as clip art.
 *
 * The shapes themselves live in index.css so they scale with the pin.
 */
export function PinDecoration({ kind }: PinDecorationProps) {
  if (kind === "none") return null;
  return <span className="pin-deco" data-kind={kind} aria-hidden="true" />;
}

/** Small preview used in the picker, so the choice isn't made from a word. */
export function PinDecorationSwatch({ kind }: PinDecorationProps) {
  return <span className="pin-deco-swatch" data-kind={kind} aria-hidden="true" />;
}
