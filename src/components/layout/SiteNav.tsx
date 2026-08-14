import type { ReactNode } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon: string;
}

interface SiteNavProps<T extends string> {
  /** Wordmark shown at the far left of the bar. */
  brand: string;
  tabs: TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  /** Right-aligned slot (e.g. owner/login controls). */
  actions?: ReactNode;
}

/**
 * Full-width top navigation: wordmark + left-aligned section tabs, with an
 * actions slot on the right. Sticky and translucent so content scrolls under it.
 */
export function SiteNav<T extends string>({
  brand,
  tabs,
  activeId,
  onChange,
  actions,
}: SiteNavProps<T>) {
  return (
    <header className="glass site-nav sticky top-0 z-30 border-b border-[color:var(--surface-border)]">
      <div className="mx-auto flex w-full max-w-375 items-center gap-4 px-5 py-3 sm:gap-6 sm:px-10">
        <span className="shrink-0 font-serif text-xl font-bold tracking-tight text-ink">
          {brand}
        </span>

        <nav
          role="tablist"
          aria-label="Sections"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        >
          {tabs.map((tab) => {
            const active = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(tab.id)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  active
                    ? "bg-ink text-paper"
                    : "text-ink-faint hover:bg-cream-deep hover:text-ink"
                }`}
              >
                <span aria-hidden="true">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}
