import { useCallback, useEffect, useRef, useState } from "react";
import { useTasteData } from "../context/tasteDataContext";
import type {
  BoardSettings,
  Pin,
  PinColor,
  PinDecoration,
  PinDraft,
  PinLayout,
} from "../types/pin";
import {
  BOARD_REF_WIDTH,
  DEFAULT_BOARD,
  DEFAULT_TEXT_STYLE,
} from "../types/pin";

const MOCK_PIN_IDS = new Set(Array.from({ length: 12 }, (_, i) => `pin-${i + 1}`));
const LEGACY_PIN_STORAGE_KEY = "taste:v3:pins";
const LEGACY_BOARD_STORAGE_KEY = "taste:v3:board";
const BOARD_REF_HEIGHT = BOARD_REF_WIDTH / DEFAULT_BOARD.aspect;
const SAVE_DEBOUNCE_MS = 400;

function fillDefaults(pin: Pin): Pin {
  return {
    ...pin,
    decoration: pin.decoration ?? "none",
    pinColor: pin.pinColor ?? "red",
    photoTexts:
      pin.photoTexts ??
      pin.images.map((_, i) =>
        i === 0 ? { content: pin.content ?? "" } : { content: "" },
      ),
    detailSpacing: pin.detailSpacing ?? 1,
    aspectRatio:
      pin.aspectRatio ??
      (pin.images.length > 0 && pin.height > 0 ? pin.width / pin.height : undefined),
    format: pin.format ?? "text",
    textStyle: { ...DEFAULT_TEXT_STYLE, ...pin.textStyle },
  };
}

function normaliseStack(pins: Pin[]): Pin[] {
  const order = pins
    .map((pin, i) => ({ id: pin.id, z: pin.z ?? i, i }))
    .sort((a, b) => a.z - b.z || a.i - b.i);
  const rank = new Map(order.map((entry, i) => [entry.id, i + 1]));
  return pins.map((pin) => ({ ...pin, z: rank.get(pin.id) ?? 1 }));
}

function normalisePins(pins: Pin[]): Pin[] {
  return normaliseStack(
    pins.filter((pin) => !MOCK_PIN_IDS.has(pin.id)).map(fillDefaults),
  );
}

// Pins lived in this browser before the database tables existed. Keep that
// source visible until the API starts returning the user's pin rows.
function loadLegacyPins(): Pin[] {
  try {
    const raw = localStorage.getItem(LEGACY_PIN_STORAGE_KEY);
    return raw ? normalisePins(JSON.parse(raw) as Pin[]) : [];
  } catch {
    return [];
  }
}

function loadLegacyBoard(): BoardSettings {
  try {
    const raw = localStorage.getItem(LEGACY_BOARD_STORAGE_KEY);
    return raw
      ? { ...DEFAULT_BOARD, ...(JSON.parse(raw) as Partial<BoardSettings>) }
      : DEFAULT_BOARD;
  } catch {
    return DEFAULT_BOARD;
  }
}

function isDefaultBoard(board: BoardSettings): boolean {
  return (
    board.widthPct === DEFAULT_BOARD.widthPct &&
    board.aspect === DEFAULT_BOARD.aspect &&
    board.opacity === DEFAULT_BOARD.opacity
  );
}

function saveLegacyPins(pins: Pin[]): void {
  try {
    localStorage.setItem(LEGACY_PIN_STORAGE_KEY, JSON.stringify(pins));
  } catch {
    // The current session stays usable if an image exceeds browser storage.
  }
}

function saveLegacyBoard(board: BoardSettings): void {
  try {
    localStorage.setItem(LEGACY_BOARD_STORAGE_KEY, JSON.stringify(board));
  } catch {
    // The current session stays usable if browser storage is unavailable.
  }
}

function boxOf(pin: Pin) {
  return {
    left: pin.x,
    top: pin.y,
    right: pin.x + (pin.width / BOARD_REF_WIDTH) * 100,
    bottom: pin.y + (pin.height / BOARD_REF_HEIGHT) * 100,
  };
}

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
  updateLayout: (id: string, layout: Partial<PinLayout>) => void;
  addPin: (draft: PinDraft) => Pin;
  removePin: (id: string) => void;
  raisePin: (id: string) => void;
  decoratePin: (id: string, decoration: PinDecoration) => void;
  updatePinColor: (id: string, color: PinColor) => void;
  updatePin: (id: string, draft: PinDraft) => void;
  board: BoardSettings;
  updateBoard: (patch: Partial<BoardSettings>) => void;
}

export function usePinboard(): PinboardApi {
  const {
    pins: storedPins,
    pinBoard,
    addPin: persistAddPin,
    updatePin: persistUpdatePin,
    deletePin: persistDeletePin,
    savePinBoard,
  } = useTasteData();
  const [pins, setPins] = useState<Pin[]>(() =>
    storedPins.length > 0 ? normalisePins(storedPins) : loadLegacyPins(),
  );
  const [board, setBoard] = useState<BoardSettings>(() =>
    isDefaultBoard(pinBoard) ? loadLegacyBoard() : pinBoard,
  );
  const pinsRef = useRef(pins);
  const boardRef = useRef(board);
  const pinTimer = useRef<number | undefined>(undefined);
  const boardTimer = useRef<number | undefined>(undefined);
  const pendingPinPatches = useRef(new Map<string, Partial<Pin>>());

  pinsRef.current = pins;
  boardRef.current = board;

  useEffect(() => {
    if (storedPins.length > 0 || pinsRef.current.length === 0) {
      setPins(storedPins.length > 0 ? normalisePins(storedPins) : loadLegacyPins());
    }
  }, [storedPins]);

  useEffect(() => {
    if (!isDefaultBoard(pinBoard) || isDefaultBoard(boardRef.current)) {
      setBoard(isDefaultBoard(pinBoard) ? loadLegacyBoard() : pinBoard);
    }
  }, [pinBoard]);

  useEffect(() => {
    saveLegacyPins(pins);
  }, [pins]);

  useEffect(() => {
    saveLegacyBoard(board);
  }, [board]);

  useEffect(
    () => () => {
      window.clearTimeout(pinTimer.current);
      window.clearTimeout(boardTimer.current);
    },
    [],
  );

  const flushPinPatches = useCallback(() => {
    const patches = pendingPinPatches.current;
    pendingPinPatches.current = new Map();
    patches.forEach((patch, id) => persistUpdatePin(id, patch));
  }, [persistUpdatePin]);

  const schedulePinPatch = useCallback(
    (id: string, patch: Partial<Pin>) => {
      const current = pendingPinPatches.current.get(id) ?? {};
      pendingPinPatches.current.set(id, { ...current, ...patch });
      window.clearTimeout(pinTimer.current);
      pinTimer.current = window.setTimeout(flushPinPatches, SAVE_DEBOUNCE_MS);
    },
    [flushPinPatches],
  );

  const scheduleBoard = useCallback(
    (next: BoardSettings) => {
      window.clearTimeout(boardTimer.current);
      boardTimer.current = window.setTimeout(
        () => savePinBoard(next),
        SAVE_DEBOUNCE_MS,
      );
    },
    [savePinBoard],
  );

  const updateBoard = useCallback(
    (patch: Partial<BoardSettings>) => {
      const next = { ...boardRef.current, ...patch };
      setBoard(next);
      scheduleBoard(next);
    },
    [scheduleBoard],
  );

  const updateLayout = useCallback(
    (id: string, layout: Partial<PinLayout>) => {
      setPins((current) =>
        current.map((pin) => (pin.id === id ? { ...pin, ...layout } : pin)),
      );
      schedulePinPatch(id, layout);
    },
    [schedulePinPatch],
  );

  const raisePin = useCallback(
    (id: string) => {
      let patch: Partial<Pin> | null = null;
      setPins((current) => {
        const top = current.reduce((max, pin) => Math.max(max, pin.z), 0);
        const target = current.find((pin) => pin.id === id);
        if (!target || target.z === top) return current;
        patch = { z: top + 1 };
        return current.map((pin) => (pin.id === id ? { ...pin, ...patch } : pin));
      });
      if (patch) schedulePinPatch(id, patch);
    },
    [schedulePinPatch],
  );

  const decoratePin = useCallback(
    (id: string, decoration: PinDecoration) => {
      setPins((current) =>
        current.map((pin) => (pin.id === id ? { ...pin, decoration } : pin)),
      );
      persistUpdatePin(id, { decoration });
    },
    [persistUpdatePin],
  );

  const updatePinColor = useCallback(
    (id: string, color: PinColor) => {
      setPins((current) =>
        current.map((pin) => (pin.id === id ? { ...pin, pinColor: color } : pin)),
      );
      persistUpdatePin(id, { pinColor: color });
    },
    [persistUpdatePin],
  );

  const updatePin = useCallback(
    (id: string, draft: PinDraft) => {
      const patch: Partial<Pin> = {
        images: draft.images,
        aspectRatio: draft.aspectRatio,
        photoTexts: draft.photoTexts ?? [],
        detailSpacing: draft.detailSpacing ?? 1,
        content: draft.content,
        textStyle: draft.textStyle,
        variant: draft.images.length === 0 ? "memo" : "photo",
        format: "html",
      };
      setPins((current) =>
        current.map((pin) => (pin.id === id ? { ...pin, ...patch } : pin)),
      );
      persistUpdatePin(id, patch);
    },
    [persistUpdatePin],
  );

  const addPin = useCallback(
    (draft: PinDraft): Pin => {
      const variant = draft.images.length === 0 ? "memo" : "photo";
      const ratio =
        draft.aspectRatio && Number.isFinite(draft.aspectRatio)
          ? draft.aspectRatio
          : 250 / 185;
      const width = variant === "memo" ? 200 : Math.round(ratio < 1 ? 190 : 250);
      const height =
        variant === "memo"
          ? 150
          : Math.round(Math.min(360, Math.max(120, width / ratio)));
      const current = pinsRef.current;
      const [x, y] = findFreeSpot(current, width, height);
      const created: Pin = {
        id: `pin-${Date.now().toString(36)}`,
        images: draft.images,
        aspectRatio: draft.aspectRatio,
        photoTexts: draft.photoTexts ?? [],
        detailSpacing: draft.detailSpacing ?? 1,
        content: draft.content,
        format: "html",
        x,
        y,
        width,
        height,
        rotation: 0,
        z: current.reduce((max, pin) => Math.max(max, pin.z), 0) + 1,
        decoration: "none",
        pinColor: "red",
        textStyle: draft.textStyle,
        variant,
        createdAt: new Date().toISOString(),
      };
      setPins((currentPins) => [...currentPins, created]);
      persistAddPin(created);
      return created;
    },
    [persistAddPin],
  );

  const removePin = useCallback(
    (id: string) => {
      setPins((current) => current.filter((pin) => pin.id !== id));
      persistDeletePin(id);
    },
    [persistDeletePin],
  );

  return {
    pins,
    updateLayout,
    addPin,
    removePin,
    raisePin,
    decoratePin,
    updatePinColor,
    updatePin,
    board,
    updateBoard,
  };
}
