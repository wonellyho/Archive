import { useCallback, useEffect, useRef, useState } from "react";
import type { Pin, PinDecoration, PinDraft, PinLayout } from "../types/pin";
import { BOARD_REF_WIDTH } from "../types/pin";
import { MOCK_PINS } from "../components/pinboard/mockPins";

/**
 * Board state (#pinboard). Local-only for now — the backend has no pins table
 * yet, so this persists to localStorage alongside the rest of the app's keys.
 * Every mutation produces a whole `Pin` with the exact shape the API will take,
 * so swapping this for a repository call later is a one-file change.
 */

// v3: pins gained `z`/`decoration` and lost their default tilt. Old boards are
// discarded rather than migrated — nothing on them was worth a migration path.
const STORAGE_KEY = "taste:v3:pins";

/** Only used to reason about vertical overlap when auto-placing a new pin. */
const BOARD_REF_HEIGHT = 800;

/** Dragging fires continuously; don't hit localStorage on every frame. */
const SAVE_DEBOUNCE_MS = 400;

function load(): Pin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return MOCK_PINS;
    const parsed = JSON.parse(raw) as Pin[];
    if (!Array.isArray(parsed) || parsed.length === 0) return MOCK_PINS;
    return normaliseStack(parsed);
  } catch {
    // Corrupted JSON or storage unavailable — start from the seed board.
    return MOCK_PINS;
  }
}

/**
 * Re-numbers `z` to 1..n on load, preserving order. Raising a pin only ever
 * increments, so without this a long-lived board's top value climbs forever and
 * eventually collides with the z-indexes the hover and drag states use.
 */
function normaliseStack(pins: Pin[]): Pin[] {
  const order = pins
    .map((pin, i) => ({ id: pin.id, z: pin.z ?? i, i }))
    .sort((a, b) => a.z - b.z || a.i - b.i);
  const rank = new Map(order.map((entry, i) => [entry.id, i + 1]));
  return pins.map((pin) => ({ ...pin, z: rank.get(pin.id) ?? 1 }));
}

function save(pins: Pin[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
  } catch {
    // Quota exceeded (data-URL images add up) — the board still works in memory.
  }
}

/** Percentage-space bounding box of a pin, for the overlap check below. */
function boxOf(pin: Pin) {
  return {
    left: pin.x,
    top: pin.y,
    right: pin.x + (pin.width / BOARD_REF_WIDTH) * 100,
    bottom: pin.y + (pin.height / BOARD_REF_HEIGHT) * 100,
  };
}

/**
 * Finds somewhere on the board a new pin can go without landing on top of an
 * existing one. Walks a loose lattice rather than a tidy grid so added pins keep
 * the hand-placed feel; falls back to the bottom of the board once it's full.
 */
function findFreeSpot(
  pins: Pin[],
  width: number,
  height: number,
): [number, number] {
  const w = (width / BOARD_REF_WIDTH) * 100;
  const h = (height / BOARD_REF_HEIGHT) * 100;
  const taken = pins.map(boxOf);

  for (let y = 4; y + h <= 96; y += 6) {
    for (let x = 3; x + w <= 97; x += 5) {
      const clear = taken.every(
        (b) => x + w < b.left || x > b.right || y + h < b.top || y > b.bottom,
      );
      if (clear) return [x, y];
    }
  }

  const lowest = taken.reduce((max, b) => Math.max(max, b.bottom), 0);
  return [6, Math.min(lowest + 3, 100 - h)];
}

export interface PinboardApi {
  pins: Pin[];
  /** Move/resize during a drag. Cheap: no persistence until the gesture settles. */
  updateLayout: (id: string, layout: Partial<PinLayout>) => void;
  addPin: (draft: PinDraft) => Pin;
  removePin: (id: string) => void;
  /** Re-stacks a pin on top of the others — called when a drag ends. */
  raisePin: (id: string) => void;
  /** Sticks tape or a tack on a pin, or takes it back off. */
  decoratePin: (id: string, decoration: PinDecoration) => void;
}

export function usePinboard(): PinboardApi {
  const [pins, setPins] = useState<Pin[]>(load);
  const saveTimer = useRef<number | undefined>(undefined);
  // Mirrors `pins` so addPin can look at the current board without taking a
  // dependency on it (a setPins updater can't be read back synchronously).
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => save(pins), SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(saveTimer.current);
  }, [pins]);

  const updateLayout = useCallback((id: string, layout: Partial<PinLayout>) => {
    setPins((current) =>
      current.map((pin) => (pin.id === id ? { ...pin, ...layout } : pin)),
    );
  }, []);

  const raisePin = useCallback((id: string) => {
    // Bumps `z` and leaves the array alone: reordering it would make React move
    // the pin's DOM node, and a moved node replays its entrance animation —
    // which read as the pin vanishing for half a second on drop.
    setPins((current) => {
      const top = current.reduce((max, pin) => Math.max(max, pin.z), 0);
      const target = current.find((pin) => pin.id === id);
      if (!target || target.z === top) return current;
      return current.map((pin) => (pin.id === id ? { ...pin, z: top + 1 } : pin));
    });
  }, []);

  const decoratePin = useCallback((id: string, decoration: PinDecoration) => {
    setPins((current) =>
      current.map((pin) => (pin.id === id ? { ...pin, decoration } : pin)),
    );
  }, []);

  const addPin = useCallback((draft: PinDraft): Pin => {
    const variant = draft.images.length === 0 ? "memo" : "photo";
    const width = variant === "memo" ? 200 : 250;
    const height = variant === "memo" ? 150 : 185;
    const current = pinsRef.current;
    const [x, y] = findFreeSpot(current, width, height);
    const created: Pin = {
      id: `pin-${Date.now().toString(36)}`,
      images: draft.images,
      content: draft.content,
      x,
      y,
      width,
      height,
      // Square-on and bare. Tilt and tape are the owner's to add.
      rotation: 0,
      z: current.reduce((max, pin) => Math.max(max, pin.z), 0) + 1,
      decoration: "none",
      variant,
      createdAt: new Date().toISOString(),
    };
    setPins((pins) => [...pins, created]);
    return created;
  }, []);

  const removePin = useCallback((id: string) => {
    setPins((current) => current.filter((pin) => pin.id !== id));
  }, []);

  return { pins, updateLayout, addPin, removePin, raisePin, decoratePin };
}
