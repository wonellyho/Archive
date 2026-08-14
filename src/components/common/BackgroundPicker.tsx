import { useRef, useState } from "react";
import { useAuth } from "../../context/authContext";
import { useBackground } from "../../context/backgroundContext";
import type { BackgroundFilter, ToneOverride } from "../../context/backgroundContext";
import { buildFilterCss } from "../../utils/backgroundFilters";
import { Modal } from "./Modal";

const TONE_OPTIONS: { id: ToneOverride; label: string; icon: string }[] = [
  { id: "auto", label: "Auto", icon: "✨" },
  { id: "light", label: "Light", icon: "☀️" },
  { id: "dark", label: "Dark", icon: "🌙" },
];

const FILTER_OPTIONS: { id: BackgroundFilter; label: string }[] = [
  { id: "none", label: "None" },
  { id: "blur", label: "Blur" },
  { id: "noir", label: "Noir" },
  { id: "warm", label: "Warm" },
];

/** Numbered, bolder section heading — each section but the first gets a
 * divider above it, so Nav bar / Wallpaper / Filter / Text contrast read as
 * clearly separate groups rather than one continuous list. */
function SectionHeading({ n, title }: { n: number; title: string }) {
  return (
    <p className="text-base font-bold text-ink">
      {n}. {title}
    </p>
  );
}

/**
 * Palette icon in the nav — owner-only. Opens a centered "Appearance"
 * settings modal: nav bar opacity, a personal wallpaper with opacity/filter
 * controls and a live preview, and text-contrast tone.
 */
export function BackgroundPicker() {
  const { isOwner } = useAuth();
  const {
    imageUrl,
    tone,
    toneOverride,
    bgOpacity,
    filter,
    filterIntensity,
    navOpacity,
    isProcessing,
    error,
    setImageFromFile,
    setToneOverride,
    setBgOpacity,
    setFilter,
    setFilterIntensity,
    setNavOpacity,
    clear,
  } = useBackground();
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isOwner) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Appearance settings"
        title="Appearance"
        className="grid size-8 place-items-center rounded-full text-base text-ink-soft transition-colors hover:bg-cream-deep hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      >
        🎨
      </button>

      <Modal
        open={open}
        title="Appearance"
        onClose={() => setOpen(false)}
        widthClassName="max-w-2xl"
      >
        <div className="flex flex-col gap-6">
          {/* Live preview — a screen-shaped (16:9) mock, centered and sized to
              read clearly rather than stretched full-width. Reflects nav
              opacity, wallpaper opacity and filter as they change. */}
          <div className="relative mx-auto aspect-video w-full max-w-sm overflow-hidden rounded-xl border border-[color:var(--surface-border)] shadow-sm">
            <div className="absolute inset-0 bg-[#ededec]" aria-hidden="true" />
            {imageUrl ? (
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: bgOpacity / 100,
                  filter: buildFilterCss(filter, filterIntensity),
                }}
              />
            ) : null}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 py-2"
              style={{
                background: `color-mix(in srgb, var(--surface) ${navOpacity}%, transparent)`,
                backdropFilter: "blur(6px)",
              }}
            >
              <span className="h-2 w-10 rounded-full bg-ink/70" />
              <span className="ml-auto h-2 w-5 rounded-full bg-ink/35" />
              <span className="h-2 w-5 rounded-full bg-ink/35" />
              <span className="h-2 w-5 rounded-full bg-ink/35" />
            </div>
          </div>

          {/* 1. Nav bar opacity — independent of the wallpaper, shown first. */}
          <section>
            <SectionHeading n={1} title="Nav bar opacity" />
            <div className="mt-2 flex items-center justify-between">
              <input
                type="range"
                min={10}
                max={100}
                value={navOpacity}
                onChange={(e) => setNavOpacity(Number(e.target.value))}
                className="w-full accent-accent"
                aria-label="Nav bar opacity"
              />
              <span className="ml-3 w-10 shrink-0 text-right text-xs text-ink-faint">
                {navOpacity}%
              </span>
            </div>
          </section>

          {/* 2. Wallpaper */}
          <section className="border-t border-line pt-5">
            <SectionHeading n={2} title="Wallpaper" />

            <details className="mt-2 text-xs text-ink-faint">
              <summary className="cursor-pointer select-none font-medium text-ink-soft hover:text-ink">
                What image works best?
              </summary>
              <p className="mt-1.5 leading-relaxed">
                A personal background behind the whole site, saved on this
                browser. For the sharpest result on most screens, use an
                image at least 1920×1080 (16:9) — it's resized automatically,
                so larger just means more detail, not a bigger download.
              </p>
            </details>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isProcessing}
                className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-paper transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50"
              >
                {isProcessing
                  ? "Processing…"
                  : imageUrl
                    ? "Change image"
                    : "Upload image"}
              </button>
              {imageUrl ? (
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-cream hover:text-ink"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void setImageFromFile(file);
              }}
            />

            {error ? <p className="mt-2 text-xs text-accent">{error}</p> : null}

            {imageUrl ? (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm font-medium text-ink">Opacity</p>
                <span className="text-xs text-ink-faint">{bgOpacity}%</span>
              </div>
            ) : null}
            {imageUrl ? (
              <input
                type="range"
                min={0}
                max={100}
                value={bgOpacity}
                onChange={(e) => setBgOpacity(Number(e.target.value))}
                className="mt-2 w-full accent-accent"
                aria-label="Wallpaper opacity"
              />
            ) : null}
          </section>

          {imageUrl ? (
            <>
              {/* 3. Filter + its strength */}
              <section className="border-t border-line pt-5">
                <SectionHeading n={3} title="Filter" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setFilter(option.id)}
                      aria-pressed={filter === option.id}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        filter === option.id
                          ? "bg-ink text-paper"
                          : "border border-line text-ink-faint hover:text-ink"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {filter !== "none" ? (
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-ink-faint">Strength</p>
                      <span className="text-xs text-ink-faint">{filterIntensity}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={filterIntensity}
                      onChange={(e) => setFilterIntensity(Number(e.target.value))}
                      className="mt-2 w-full accent-accent"
                      aria-label="Filter strength"
                    />
                  </div>
                ) : null}
              </section>

              {/* 4. Text contrast — segmented control */}
              <section className="border-t border-line pt-5">
                <SectionHeading n={4} title="Text contrast" />
                <div className="mt-2 flex gap-1 rounded-full border border-line bg-cream/50 p-1">
                  {TONE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setToneOverride(option.id)}
                      aria-pressed={toneOverride === option.id}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-all duration-200 ${
                        toneOverride === option.id
                          ? "bg-ink text-paper shadow-sm"
                          : "text-ink-faint hover:text-ink"
                      }`}
                    >
                      <span aria-hidden="true">{option.icon}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-faint">
                  Currently reading as <span className="font-medium">{tone}</span>.
                </p>
              </section>
            </>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
