/**
 * A pin is one memory post on the board — some photos plus the note written
 * about them. Not one photo per post: `images` is a carousel, like an Instagram
 * multi-image post.
 */
export interface Pin {
  id: string;
  /** Ordered carousel images. Empty for a `memo`, which is text only. */
  images: string[];
  content: string;
  /**
   * Whether `content` is plain text or markup from the note editor. Explicit
   * rather than sniffed, so a plain note that happens to contain a `<` is never
   * mistaken for markup. Everything written since the editor landed is "html";
   * boards saved before it stay "text" and render the old way.
   */
  format: ContentFormat;
  /**
   * Top-left corner as a percentage of the board (0–100 on each axis), so a
   * saved layout survives the board being rendered at any width.
   */
  x: number;
  y: number;
  /**
   * Size in board-reference pixels (see BOARD_REF_WIDTH). Rendered as a
   * percentage of the live board width with the pin's own aspect-ratio, so
   * these two numbers describe a shape, never a fixed on-screen size.
   */
  width: number;
  height: number;
  /** Degrees of tilt. Always 0 until somebody deliberately turns the pin. */
  rotation: number;
  /**
   * Stacking order. Kept as data rather than as array position so that raising
   * a pin never moves its DOM node — moving one restarts its CSS animations,
   * which showed up as the pin blinking out the moment you dropped it.
   */
  z: number;
  /** Optional tape or tack the owner stuck on. Nothing by default. */
  decoration: PinDecoration;
  /** How the written part is set — chosen per memory, not site-wide. */
  textStyle: PinTextStyle;
  variant: PinVariant;
  createdAt: string;
}

/**
 * The note's baseline setting — what applies to anything the editor's inline
 * markup doesn't override. Also what pre-editor boards are rendered with.
 */
export interface PinTextStyle {
  size: TextSize;
  align: TextAlign;
  font: TextFont;
}

export type TextSize = "s" | "m" | "l";
export type TextAlign = "left" | "center" | "right";

/**
 * Crimson Text is the only face the site ships (see index.css); the other two
 * are system stacks. Three genuinely different textures, no fake variety.
 */
export type TextFont = "serif" | "sans" | "mono";

export const TEXT_SIZES: TextSize[] = ["s", "m", "l"];
export const TEXT_ALIGNS: TextAlign[] = ["left", "center", "right"];
export const TEXT_FONTS: TextFont[] = ["serif", "sans", "mono"];

/** Multipliers on whatever base size the context sets. */
export const TEXT_SCALE: Record<TextSize, number> = { s: 0.82, m: 1, l: 1.3 };

export const TEXT_FONT_STACK: Record<TextFont, string> = {
  serif: 'var(--font-serif)',
  sans: 'ui-sans-serif, system-ui, "Segoe UI", Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
};

export const DEFAULT_TEXT_STYLE: PinTextStyle = {
  size: "m",
  align: "left",
  font: "serif",
};

export type ContentFormat = "text" | "html";

/** A photo post, or a written note with no image. */
export type PinVariant = "photo" | "memo";

/** How the pin is stuck to the board — the owner's choice, not automatic. */
export type PinDecoration = "none" | "pin" | "tape";

export const DECORATIONS: PinDecoration[] = ["none", "pin", "tape"];

/** Fields the user can change by dragging, resizing or turning a pin. */
export type PinLayout = Pick<Pin, "x" | "y" | "width" | "height" | "rotation">;

/** What the add form collects; everything else is filled in on the board. */
export interface PinDraft {
  images: string[];
  /** Markup from the note editor — always sanitised before it is rendered. */
  content: string;
  textStyle: PinTextStyle;
}

/** Inline size range the note editor's slider spans, in em of the base size. */
export const MIN_TEXT_EM = 0.6;
export const MAX_TEXT_EM = 2.6;

/**
 * The coordinate space `width`/`height` are expressed in. The board scales this
 * space to whatever width it actually gets, so a 260-wide pin is always the same
 * fraction of the board.
 */
export const BOARD_REF_WIDTH = 1400;

/**
 * Size limits, in the same reference space. Width and height are clamped
 * separately because they're dragged separately — a pin's box is a crop window
 * over its photo, not a frame locked to the photo's proportions.
 */
/* Deliberately small: a note trimmed right down to its words is a legitimate
   thing to want, and the board shouldn't hold empty margin open for you. */
export const MIN_PIN_WIDTH = 56;
export const MAX_PIN_WIDTH = 500;
export const MIN_PIN_HEIGHT = 36;
export const MAX_PIN_HEIGHT = 520;

/**
 * The board's own dimensions and tint, which the owner can drag and dial the
 * same way they arrange what's on it.
 */
export interface BoardSettings {
  /** Board width as a percentage of the space the page gives it. */
  widthPct: number;
  /** width ÷ height. Stored as a ratio, not pixels, so it holds on any screen. */
  aspect: number;
  /** Surface opacity, 0–100 — independent of the nav bar's own setting. */
  opacity: number;
}

export const DEFAULT_BOARD: BoardSettings = {
  widthPct: 100,
  aspect: 1600 / 920,
  opacity: 90,
};

export const MIN_BOARD_WIDTH_PCT = 45;
export const MIN_BOARD_ASPECT = 0.85;
export const MAX_BOARD_ASPECT = 3.4;
