export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon: string;
}

interface TabBarProps<T extends string> {
  tabs: TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
}

/** Index-style tab switcher. Uses real tab semantics for keyboard/SR users. */
export function TabBar<T extends string>({
  tabs,
  activeId,
  onChange,
}: TabBarProps<T>) {
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className="mx-auto flex w-full max-w-md items-center gap-1 rounded-full border border-line bg-cream p-1.5 shadow-sm"
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
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-base font-medium transition-all duration-200 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              active
                ? "bg-ink text-paper shadow"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
