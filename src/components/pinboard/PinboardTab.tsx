import { useState } from "react";
import { useAuth } from "../../context/authContext";
import { usePinboard } from "../../hooks/usePinboard";
import type { Pin } from "../../types/pin";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { Pinboard } from "./Pinboard";
import { AddPinModal } from "./AddPinModal";

/**
 * "Pinboard" tab — the wall where photos and notes live, as opposed to the
 * shelves (Vinyl) and the set (Video). Board state is local for now; see
 * hooks/usePinboard.
 */
export function PinboardTab() {
  const {
    pins,
    updateLayout,
    addPin,
    removePin,
    raisePin,
    decoratePin,
    board,
    updateBoard,
  } = usePinboard();
  const { isOwner } = useAuth();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pin | null>(null);

  return (
    // Pulled up under the nav and out through the page gutters: the board is
    // the page here, not a card sitting on it.
    <section
      aria-label="Pinboard"
      className="-mx-5 -mt-2 flex flex-col gap-3 sm:-mx-10 sm:-mt-3"
    >
      <Pinboard
        pins={pins}
        board={board}
        canEdit={isOwner}
        onLayout={updateLayout}
        onRaise={raisePin}
        onDecorate={decoratePin}
        onDelete={setPending}
        onBoard={updateBoard}
        onAdd={() => setAdding(true)}
      />

      {isOwner ? (
        <p className="px-5 text-sm text-ink-faint sm:px-10">
          Drag to move. Edges and corners resize — the board's too. The dot
          changes how a memory is stuck up.
        </p>
      ) : null}

      {adding ? (
        <AddPinModal onAdd={addPin} onClose={() => setAdding(false)} />
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        title="Remove from board"
        message="This memory will be taken off the board. Continue?"
        onConfirm={() => {
          if (pending) removePin(pending.id);
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}
