import { Link } from "react-router-dom";

const plannedSections = [
  { path: "/admin/search", label: "YouTube Search & Registration" },
  { path: "/admin/music", label: "Music & Music Folders" },
  { path: "/admin/videos", label: "Videos & Video Folders" },
  { path: "/admin/profile", label: "Profile Settings" },
];

/**
 * Placeholder admin home. Search and persistence land in steps 3–4; for now this
 * just documents where those tools will live.
 */
export function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-16">
      <div>
        <h1 className="font-serif text-3xl">Admin</h1>
        <p className="mt-2 text-sm text-muted">
          Management tools arrive in the next steps. Planned sections:
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {plannedSections.map((section) => (
          <li
            key={section.path}
            className="rounded-lg border border-paper/15 px-4 py-3 text-sm text-paper-dim"
          >
            {section.label}
            <span className="ml-2 text-xs text-muted">({section.path})</span>
          </li>
        ))}
      </ul>
      <Link to="/" className="text-sm text-accent hover:underline">
        ← Back to public page
      </Link>
    </main>
  );
}
