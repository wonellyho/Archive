import { useState } from "react";

/** 취향 키워드 후보 — 선택(토글)해서 활성화한다. 쉼표 입력 대신 사용. */
const KEYWORD_CANDIDATES = [
  "잔잔함",
  "감성",
  "신남",
  "위로",
  "설렘",
  "몽환",
  "드라이브",
  "밤",
  "새벽",
  "집중",
  "운동",
  "여행",
  "자연",
  "동기부여",
  "사랑",
  "이별",
  "힐링",
  "레트로",
  "록",
  "발라드",
  "힙합",
  "재즈",
  "인디",
  "JPOP",
  "시티팝",
  "클래식",
  "EDM",
  "R&B",
  "영화",
  "브이로그",
  "다큐",
  "예능",
  "드라마",
  "애니",
  "공연",
];

interface KeywordSelectorProps {
  value: string[];
  onChange: (next: string[]) => void;
}

export function KeywordSelector({ value, onChange }: KeywordSelectorProps) {
  const [draft, setDraft] = useState("");
  // 사용자가 이번 세션에 직접 추가한 후보(선택 해제해도 목록에 남게).
  const [added, setAdded] = useState<string[]>([]);

  // 기본 후보 + 사용자 추가 후보 + 기존 저장 키워드(후보에 없어도 유지)를 함께 노출.
  const options = Array.from(
    new Set([...KEYWORD_CANDIDATES, ...added, ...value]),
  );

  function toggle(keyword: string) {
    onChange(
      value.includes(keyword)
        ? value.filter((k) => k !== keyword)
        : [...value, keyword],
    );
  }

  function addDraft() {
    const keyword = draft.trim();
    if (!keyword) return;
    if (!options.includes(keyword)) setAdded((prev) => [...prev, keyword]);
    if (!value.includes(keyword)) onChange([...value, keyword]); // 추가 즉시 선택
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {options.map((keyword) => {
          const active = value.includes(keyword);
          return (
            <button
              key={keyword}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(keyword)}
              className={`rounded-full border px-3 py-1.5 text-sm tracking-wide transition-colors ${
                active
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line bg-cream text-ink-soft hover:border-ink/30 hover:text-ink"
              }`}
            >
              {keyword}
            </button>
          );
        })}
      </div>

      <div className="flex items-stretch gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder="직접 입력해 후보 추가"
          className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-1.5 text-sm outline-none focus-visible:border-accent"
        />
        <button
          type="button"
          onClick={addDraft}
          disabled={!draft.trim()}
          className="shrink-0 rounded-full border border-line bg-cream px-4 py-1.5 text-sm text-ink-soft transition-colors hover:border-ink/30 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          추가
        </button>
      </div>
    </div>
  );
}
