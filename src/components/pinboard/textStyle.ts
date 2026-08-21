import type { CSSProperties } from "react";
import type { PinTextStyle } from "../../types/pin";
import { TEXT_FONT_STACK, TEXT_SCALE } from "../../types/pin";

/**
 * Turns a pin's text settings into custom properties. Handed to CSS as
 * variables rather than as finished declarations so each surface can decide its
 * own base size and have the user's choice scale on top of it — a memo on the
 * board sizes itself against the pin's width, the detail view against the page.
 */
export function textStyleVars(style: PinTextStyle): CSSProperties {
  return {
    "--text-scale": TEXT_SCALE[style.size],
    "--text-align": style.align,
    "--text-font": TEXT_FONT_STACK[style.font],
  } as CSSProperties;
}
