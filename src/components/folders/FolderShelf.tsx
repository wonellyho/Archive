import { useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import type { TasteFolder } from "../../types/folder";
import { PencilIcon, TrashIcon } from "../common/icons";

interface FolderShelfProps {
  folders: TasteFolder[];
  selectedFolderId: string | null;
  onSelect: (folderId: string) => void;
  onEdit: (folder: TasteFolder) => void;
  onDelete: (folder: TasteFolder) => void;
  onAddFolder: () => void;
  countOf: (folderId: string) => number;
  /** Persist a new folder order (drag to reorder). */
  onReorder?: (orderedIds: string[]) => void;
  /** When false, edit/delete/reorder controls and the add tile are hidden. */
  canEdit: boolean;
  /** Icon + label for this shelf's content type (e.g. 🎵 음악). */
  typeIcon: string;
  typeLabel: string;
  /** Show a vinyl disc sliding out behind each sleeve (music shelves). */
  showDisc?: boolean;
}

/** How many sleeves stand on one shelf before a new plank starts (desktop). */
const PER_SHELF = 4;

/** Fallback sleeve gradients — this app's own warm/cool tones, not any brand's. */
const COVER_GRADIENTS = [
  "linear-gradient(150deg, #b5531d 0%, #7a2f12 100%)",
  "linear-gradient(150deg, #3b6ea5 0%, #23405f 100%)",
  "linear-gradient(150deg, #4f7d5a 0%, #2c4a34 100%)",
  "linear-gradient(150deg, #8a6bb0 0%, #4d3a70 100%)",
  "linear-gradient(150deg, #c08a2e 0%, #7c5514 100%)",
  "linear-gradient(150deg, #4a4a52 0%, #23232a 100%)",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length];
}

/** A small, deterministic per-sleeve tilt in [-0.8, 0.8]deg — so a row reads
 * as hand-placed rather than machine-aligned, without shuffling on re-render. */
function leanFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 33 + id.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 160) / 100 - 0.8;
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function moveId(list: string[], fromId: string, toId: string): string[] {
  const from = list.indexOf(fromId);
  const to = list.indexOf(toId);
  if (from === -1 || to === -1 || from === to) return list;
  const next = [...list];
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * 폴더를 벽 선반 위 레코드 슬리브로 전시한다. 콜백 인터페이스만 받는 표현 컴포넌트로,
 * 데이터·API 로직은 상위(탭)가 소유한다. 소유자는 드래그로 순서를 바꿀 수 있다.
 */
export function FolderShelf({
  folders,
  selectedFolderId,
  onSelect,
  onEdit,
  onDelete,
  onAddFolder,
  countOf,
  onReorder,
  canEdit,
  typeIcon,
  typeLabel,
  showDisc = false,
}: FolderShelfProps) {
  const draggable = canEdit && onReorder !== undefined;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  // True once a drag begins, so the trailing click doesn't open the folder.
  const draggedRef = useRef(false);

  const baseIds = folders.map((f) => f.id);
  const orderIds = dragOrder ?? baseIds;
  const byId = new Map(folders.map((f) => [f.id, f]));
  const ordered = orderIds
    .map((id) => byId.get(id))
    .filter((f): f is TasteFolder => f !== undefined);

  const rows = chunk(ordered, PER_SHELF);
  // The add tile lives at the very end — append it to the last shelf (or start a
  // fresh shelf if the last one is already full).
  const showAdd = canEdit;
  if (showAdd) {
    if (rows.length === 0 || rows[rows.length - 1].length === PER_SHELF) {
      rows.push([]);
    }
  }
  const addRowIndex = showAdd ? rows.length - 1 : -1;

  function handleDragStart(event: DragEvent<HTMLLIElement>, id: string) {
    draggedRef.current = true;
    setDraggingId(id);
    setDragOrder(baseIds);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>, overId: string) {
    if (draggingId === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (overId === draggingId) return;
    setDragOrder((prev) => moveId(prev ?? baseIds, draggingId, overId));
  }

  function handleDragEnd() {
    if (dragOrder && !sameOrder(dragOrder, baseIds)) onReorder?.(dragOrder);
    setDraggingId(null);
    setDragOrder(null);
  }

  return (
    <div className="shelf-showcase">
      <div className="shelf-rows">
        {rows.map((shelf, rowIndex) => (
          <div
            key={rowIndex}
            className="shelf-shelf"
            // One shared eye-level for the whole showcase: the first of several
            // rows sits above it (seen from below — underside showing), every
            // row after sits below it (seen from above — top surface showing).
            // A lone row reads better looked-down-on than overhead.
            data-level={rowIndex === 0 && rows.length > 1 ? "above" : "below"}
          >
            <div aria-hidden="true" className="shelf-backlight" />
            <ul className="shelf-track">
              {shelf.map((folder) => {
                const count = countOf(folder.id);
                const active = folder.id === selectedFolderId;
                const isDragging = folder.id === draggingId;
                return (
                  <li
                    key={folder.id}
                    className="shelf-slot"
                    draggable={draggable}
                    onPointerDown={
                      draggable ? () => (draggedRef.current = false) : undefined
                    }
                    onDragStart={
                      draggable ? (e) => handleDragStart(e, folder.id) : undefined
                    }
                    onDragOver={
                      draggable ? (e) => handleDragOver(e, folder.id) : undefined
                    }
                    onDrop={draggable ? (e) => e.preventDefault() : undefined}
                    onDragEnd={draggable ? handleDragEnd : undefined}
                    style={{ opacity: isDragging ? 0.4 : undefined }}
                  >
                    <span aria-hidden="true" className="shelf-shadow-soft" />
                    <span aria-hidden="true" className="shelf-shadow" />
                    <div
                      className={`shelf-card${
                        folder.id === openingId ? " is-opening" : ""
                      }`}
                      style={{ "--card-lean": `${leanFor(folder.id)}deg` } as CSSProperties}
                      onAnimationEnd={() =>
                        setOpeningId((prev) =>
                          prev === folder.id ? null : prev,
                        )
                      }
                    >
                      {showDisc ? (
                        <span aria-hidden="true" className="shelf-disc-wrap">
                          <span className="shelf-disc" />
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className={`shelf-cover${
                          draggable ? " cursor-grab active:cursor-grabbing" : ""
                        }`}
                        data-active={active}
                        aria-pressed={active}
                        onClick={() => {
                          if (draggedRef.current) {
                            draggedRef.current = false;
                            return;
                          }
                          setOpeningId(folder.id);
                          onSelect(folder.id);
                        }}
                        aria-label={`Open ${folder.name} — ${typeLabel} folder (${count} items)`}
                      >
                        {folder.coverImageUrl ? (
                          <img
                            className="shelf-img"
                            src={folder.coverImageUrl}
                            alt=""
                          />
                        ) : (
                          <span
                            className="shelf-fallback"
                            style={{ background: gradientFor(folder.id) }}
                          >
                            <span className="shelf-fallback-emoji" aria-hidden="true">
                              {typeIcon}
                            </span>
                            <span className="shelf-fallback-name">
                              {folder.name}
                            </span>
                          </span>
                        )}
                        <span className="shelf-overlay">
                          <span className="shelf-overlay-title">{folder.name}</span>
                          <span className="shelf-overlay-open">{count} · Open</span>
                        </span>
                      </button>
                    </div>

                    {canEdit ? (
                      <div className="shelf-actions">
                        <div className="flex items-center gap-0.5 rounded-full bg-paper/85 p-1 shadow-md backdrop-blur">
                          <button
                            type="button"
                            onClick={() => onEdit(folder)}
                            aria-label={`Edit ${folder.name} folder`}
                            className="grid size-7 place-items-center rounded-full text-[0.95rem] text-ink-soft transition-colors hover:bg-cream-deep hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(folder)}
                            aria-label={`Delete ${folder.name} folder`}
                            className="grid size-7 place-items-center rounded-full text-[0.95rem] text-ink-faint transition-colors hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}

              {showAdd && rowIndex === addRowIndex ? (
                <li className="shelf-slot">
                  <span aria-hidden="true" className="shelf-shadow-soft" />
                  <span aria-hidden="true" className="shelf-shadow" />
                  <button type="button" className="shelf-add" onClick={onAddFolder}>
                    <span className="shelf-add-icon" aria-hidden="true">
                      ＋
                    </span>
                    <span className="text-sm">New folder</span>
                  </button>
                </li>
              ) : null}
            </ul>
            <div aria-hidden="true" className="shelf-wall-shadow" />
            <div aria-hidden="true" className="shelf-top" />
            <div aria-hidden="true" className="shelf-face" />
            <div aria-hidden="true" className="shelf-bevel shelf-bevel-1" />
            <div aria-hidden="true" className="shelf-bevel shelf-bevel-2" />
            <div aria-hidden="true" className="shelf-under" />
          </div>
        ))}
      </div>
    </div>
  );
}
