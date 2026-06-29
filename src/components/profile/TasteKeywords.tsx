interface TasteKeywordsProps {
  keywords: string[];
}

export function TasteKeywords({ keywords }: TasteKeywordsProps) {
  if (keywords.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {keywords.map((keyword) => (
        <li
          key={keyword}
          className="rounded-full border border-line bg-cream px-4 py-1.5 text-sm tracking-wide text-ink-soft transition-transform duration-200 hover:scale-105"
        >
          {keyword}
        </li>
      ))}
    </ul>
  );
}
