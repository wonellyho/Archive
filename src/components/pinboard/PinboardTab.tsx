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
    updatePinColor,
    updatePin,
    board,
    updateBoard,
  } = usePinboard();
  const { isOwner } = useAuth();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Pin | null>(null);
  const [pending, setPending] = useState<Pin | null>(null);

  return (
    // Let the floating nav breathe above the board; the board still reaches
    // through the page gutters, but it no longer tucks underneath the nav.
    <section
      aria-label="Pinboard"
      className="-mx-5 mt-2 flex flex-col gap-2 sm:-mx-10 sm:mt-2"
    >
      <Pinboard
        pins={pins}
        board={board}
        canEdit={isOwner}
        onLayout={updateLayout}
        onRaise={raisePin}
        onDecorate={decoratePin}
        onPinColor={updatePinColor}
        onEdit={setEditing}
        onDelete={setPending}
        onBoard={updateBoard}
        onAdd={() => setAdding(true)}
      />

      {isOwner ? (
        <p className="px-5 text-xs text-ink-faint sm:px-10">
          Drag to move. Edges and corners resize — the board's too. The dot
          changes how a memory is stuck up.
        </p>
      ) : null}

      {adding ? (
        <AddPinModal onAdd={addPin} onClose={() => setAdding(false)} />
      ) : null}

      {editing ? (
        <AddPinModal
          pin={editing}
          onSave={(draft) => updatePin(editing.id, draft)}
          onClose={() => setEditing(null)}
        />
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
