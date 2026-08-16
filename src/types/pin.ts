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
  variant: PinVariant;
  createdAt: string;
}

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
  content: string;
}

/**
 * The coordinate space `width`/`height` are expressed in. The board scales this
 * space to whatever width it actually gets, so a 260-wide pin is always the same
 * fraction of the board.
 */
export const BOARD_REF_WIDTH = 1400;

/** Size limits, in the same reference space — keeps a pin readable but sane. */
export const MIN_PIN_WIDTH = 120;
export const MAX_PIN_WIDTH = 500;
