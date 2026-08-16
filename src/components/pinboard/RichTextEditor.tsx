import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  MAX_TEXT_EM,
  MIN_TEXT_EM,
  TEXT_ALIGNS,
  TEXT_FONTS,
  TEXT_FONT_STACK,
} from "../../types/pin";
import type { TextAlign, TextFont } from "../../types/pin";

const FONT_LABEL: Record<TextFont, string> = {
  serif: "Serif",
  sans: "Sans",
  mono: "Mono",
};

const ALIGN_COMMAND: Record<TextAlign, string> = {
  left: "justifyLeft",
  center: "justifyCenter",
  right: "justifyRight",
};

interface RichTextEditorProps {
  /** Initial markup. The field is uncontrolled after mount — see below. */
  initialHtml: string;
  onChange: (html: string) => void;
}

/**
 * The note field. Formatting applies to whatever is selected, so one sentence
 * can be centred or set larger without the rest of the note following.
 *
 * Built on `contenteditable` + `document.execCommand`. execCommand is formally
 * deprecated, and the honest reason it's here is that the alternative for
 * per-selection formatting is either a rich-text framework as a new dependency
 * or a document model written from scratch — both far past what this prototype
 * needs. Every current browser still implements it. Font size is the one thing
 * execCommand can't express (it only takes 1–7), so that wraps a span directly.
 */
export function RichTextEditor({ initialHtml, onChange }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  // The slider takes focus while you drag it, which drops the selection in the
  // editor; this is what gets put back before the size is applied.
  const saved = useRef<Range | null>(null);
  const [sizeEm, setSizeEm] = useState(1);
  // Read on mount only — see below. Held in a ref so the effect below has no
  // reactive dependency to declare.
  const seed = useRef(initialHtml);

  // Written once. React must not own this subtree: re-setting innerHTML on
  // every keystroke would collapse the caret to the start of the field.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = seed.current;
  }, []);

  function report() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function remember() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    if (!ref.current?.contains(sel.anchorNode)) return;
    saved.current = sel.getRangeAt(0).cloneRange();
  }

  /** The range to format: what's highlighted, or the whole note if nothing is. */
  function targetRange(): Range | null {
    const el = ref.current;
    if (!el) return null;
    const sel = window.getSelection();
    if (!sel) return null;

    let range = saved.current;
    if (sel.rangeCount > 0 && el.contains(sel.anchorNode) && !sel.isCollapsed) {
      range = sel.getRangeAt(0);
    }
    if (!range || range.collapsed) {
      range = document.createRange();
      range.selectNodeContents(el);
    }
    sel.removeAllRanges();
    sel.addRange(range);
    return range;
  }

  function exec(command: string, value?: string) {
    const el = ref.current;
    if (!el) return;
    el.focus();
    targetRange();
    // Emit CSS rather than <font>/<b> tags, so the sanitiser's style allowlist
    // is enough to describe what a note is allowed to contain.
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
    remember();
    report();
  }

  function applySize(em: number) {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const range = targetRange();
    if (!range) return;

    const span = document.createElement("span");
    span.style.fontSize = `${em}em`;
    span.appendChild(range.extractContents());
    // em compounds, and a size set deeper would win anyway — clear both problems
    // by stripping sizes from everything now inside the new span.
    span
      .querySelectorAll<HTMLElement>("[style*='font-size']")
      .forEach((node) => node.style.removeProperty("font-size"));
    range.insertNode(span);

    const sel = window.getSelection();
    if (sel) {
      const after = document.createRange();
      after.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(after);
      saved.current = after.cloneRange();
    }
    report();
  }

  // Buttons must not take focus, or the selection they act on disappears first.
  const hold = (e: ReactMouseEvent) => e.preventDefault();

  return (
    <div className="flex flex-col gap-3">
      <div className="rich-toolbar" role="toolbar" aria-label="Text formatting">
        <div className="pin-choices">
          <button
            type="button"
            className="pin-choice font-bold"
            onMouseDown={hold}
            onClick={() => exec("bold")}
            aria-label="Bold"
          >
            B
          </button>
          <button
            type="button"
            className="pin-choice italic"
            onMouseDown={hold}
            onClick={() => exec("italic")}
            aria-label="Italic"
          >
            I
          </button>
          <button
            type="button"
            className="pin-choice underline"
            onMouseDown={hold}
            onClick={() => exec("underline")}
            aria-label="Underline"
          >
            U
          </button>
        </div>

        <div className="pin-choices">
          {TEXT_FONTS.map((font) => (
            <button
              key={font}
              type="button"
              className="pin-choice"
              style={{ fontFamily: TEXT_FONT_STACK[font] }}
              onMouseDown={hold}
              onClick={() => exec("fontName", TEXT_FONT_STACK[font])}
            >
              {FONT_LABEL[font]}
            </button>
          ))}
        </div>

        <div className="pin-choices">
          {TEXT_ALIGNS.map((align) => (
            <button
              key={align}
              type="button"
              className="pin-choice"
              onMouseDown={hold}
              onClick={() => exec(ALIGN_COMMAND[align])}
              aria-label={`Align ${align}`}
            >
              <AlignIcon align={align} />
            </button>
          ))}
        </div>

        <label className="rich-size">
          <span>Size</span>
          <input
            type="range"
            min={MIN_TEXT_EM * 100}
            max={MAX_TEXT_EM * 100}
            step={5}
            value={Math.round(sizeEm * 100)}
            // Applied on release, not on every frame of the drag: each apply
            // rewrites the selection's markup, and doing that per pixel would
            // both churn the DOM and lose the caret.
            onChange={(e) => {
              const em = Number(e.target.value) / 100;
              setSizeEm(em);
              applySize(em);
            }}
            onInput={(e) => setSizeEm(Number(e.currentTarget.value) / 100)}
            className="accent-accent"
            aria-label="Text size"
          />
          <output>{Math.round(sizeEm * 100)}%</output>
        </label>
      </div>

      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label="Memory"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="What do you want to remember about this?"
        className="rich-editor"
        onInput={report}
        onBlur={report}
        onKeyUp={remember}
        onMouseUp={remember}
      />

      <p className="text-xs text-ink-faint">
        Select some words first to format only those — with nothing selected it
        applies to the whole note.
      </p>
    </div>
  );
}

/** Three rules, with the short one hugging whichever edge the text will. */
function AlignIcon({ align }: { align: TextAlign }) {
  const x = align === "left" ? 3 : align === "center" ? 6.5 : 10;
  return (
    <svg viewBox="0 0 24 14" width="1.15em" height="0.68em" aria-hidden="true">
      <rect x="3" y="1" width="18" height="1.6" rx="0.8" fill="currentColor" />
      <rect x={x} y="5.2" width="11" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="3" y="9.4" width="18" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  );
}
