import { useState } from "react";
import { Button } from "../common/Button";

interface YouTubeSearchFormProps {
  onSearch: (query: string) => void;
  loading: boolean;
}

/** Search only fires on submit (button or Enter), never on keystroke. */
export function YouTubeSearchForm({ onSearch, loading }: YouTubeSearchFormProps) {
  const [query, setQuery] = useState("");

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(query);
      }}
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search YouTube…"
        aria-label="YouTube search query"
        className="flex-1 rounded-full border border-line bg-paper px-5 py-2.5 font-serif text-base outline-none focus-visible:border-accent"
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Searching…" : "Search"}
      </Button>
    </form>
  );
}
