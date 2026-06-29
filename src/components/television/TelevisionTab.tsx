import { useState } from "react";
import { useTasteData } from "../../context/tasteDataContext";
import { useAuth } from "../../context/authContext";
import type { TasteContent } from "../../types/content";
import type { TasteFolder } from "../../types/folder";
import { Television } from "./Television";
import { ContentComment } from "../profile/ContentComment";
import { ContentList } from "../common/ContentList";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { Button } from "../common/Button";
import { FolderGrid } from "../folders/FolderGrid";
import { FolderFormModal } from "../folders/FolderFormModal";
import { AddContentPanel } from "../youtube/AddContentPanel";
import { ContentEditModal } from "../youtube/ContentEditModal";

type Pending =
  | { kind: "folder"; folder: TasteFolder; count: number }
  | { kind: "content"; content: TasteContent };

type FolderForm = { mode: "create" } | { mode: "edit"; folder: TasteFolder };

/** "비디오" tab. Folder tiles on top; open one to reveal cards + inline player. */
export function TelevisionTab() {
  const {
    videoFolders,
    videoContents,
    addFolder,
    updateFolder,
    deleteFolder,
    addContent,
    updateContent,
    deleteContent,
    hasContent,
  } = useTasteData();
  const { isOwner } = useAuth();

  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [folderForm, setFolderForm] = useState<FolderForm | null>(null);
  const [editingContent, setEditingContent] = useState<TasteContent | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const countOf = (folderId: string) =>
    videoContents.filter((c) => c.folderId === folderId).length;
  const openFolder = videoFolders.find((f) => f.id === openFolderId) ?? null;
  const selected = videoContents.find((c) => c.id === selectedId) ?? null;
  const items = videoContents
    .filter((c) => c.folderId === openFolderId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function selectFolder(id: string) {
    setSelectedId(null);
    setOpenFolderId((current) => (current === id ? null : id));
  }

  function confirmDelete() {
    if (!pending) return;
    if (pending.kind === "folder") {
      deleteFolder("video", pending.folder.id);
      if (openFolderId === pending.folder.id) {
        setOpenFolderId(null);
        setSelectedId(null);
      }
    } else {
      deleteContent("video", pending.content.id);
      if (selectedId === pending.content.id) setSelectedId(null);
    }
    setPending(null);
  }

  return (
    <section aria-label="비디오" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl text-ink">폴더</h2>
        {isOwner ? (
          <Button onClick={() => setShowAdd((v) => !v)}>＋ 비디오 추가</Button>
        ) : null}
      </div>

      {showAdd && isOwner ? (
        <AddContentPanel
          type="video"
          folders={videoFolders}
          defaultFolderId={openFolderId}
          onAddFolder={(name) => addFolder("video", name)}
          onAddContent={addContent}
          hasContent={(id) => hasContent("video", id)}
          onClose={() => setShowAdd(false)}
        />
      ) : null}

      <FolderGrid
        folders={videoFolders}
        selectedFolderId={openFolderId}
        onSelect={selectFolder}
        onEdit={(folder) => setFolderForm({ mode: "edit", folder })}
        onDelete={(folder) =>
          setPending({ kind: "folder", folder, count: countOf(folder.id) })
        }
        onAddFolder={() => setFolderForm({ mode: "create" })}
        countOf={countOf}
        canEdit={isOwner}
      />

      {openFolder ? (
        <div key={openFolder.id} className="flex flex-col gap-5">
          <h3 className="font-serif text-xl text-ink">📁 {openFolder.name}</h3>
          {selected ? (
            <div
              key={selected.id}
              className="player-reveal flex flex-col gap-5"
            >
              <Television content={selected} />
              <ContentComment content={selected} />
            </div>
          ) : null}
          <ContentList
            label={`${openFolder.name} 비디오`}
            emptyTitle="이 폴더는 비어 있어요."
            contents={items}
            selectedContentId={selectedId}
            playingContentId={selectedId}
            onSelect={(content) => setSelectedId(content.id)}
            onEdit={setEditingContent}
            onDelete={(content) => setPending({ kind: "content", content })}
            open
            canEdit={isOwner}
          />
        </div>
      ) : null}

      {folderForm ? (
        <FolderFormModal
          title={folderForm.mode === "create" ? "새 폴더" : "폴더 편집"}
          initialName={
            folderForm.mode === "edit" ? folderForm.folder.name : undefined
          }
          initialCover={
            folderForm.mode === "edit"
              ? folderForm.folder.coverImageUrl
              : undefined
          }
          onSubmit={(data) => {
            if (folderForm.mode === "create") {
              const folder = addFolder("video", data.name, data.coverImageUrl);
              setOpenFolderId(folder.id);
            } else {
              updateFolder("video", folderForm.folder.id, data);
            }
            setFolderForm(null);
          }}
          onCancel={() => setFolderForm(null)}
        />
      ) : null}

      {editingContent ? (
        <ContentEditModal
          content={editingContent}
          onSave={(patch) => {
            updateContent("video", editingContent.id, patch);
            setEditingContent(null);
          }}
          onCancel={() => setEditingContent(null)}
        />
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "folder" ? "폴더 삭제" : "콘텐츠 삭제"}
        message={
          pending?.kind === "folder"
            ? `‘${pending.folder.name}’ 폴더와 그 안의 콘텐츠 ${pending.count}개가 삭제됩니다. 계속할까요?`
            : "이 콘텐츠를 삭제할까요?"
        }
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}
