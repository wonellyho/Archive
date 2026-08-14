import { useState } from "react";
import { useAuth } from "../../context/authContext";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";

interface LoginModalProps {
  onClose: () => void;
}

const field =
  "rounded-2xl border border-line bg-paper px-4 py-2.5 font-serif text-base outline-none focus-visible:border-accent";

export function LoginModal({ onClose }: LoginModalProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    const message = await signIn(email.trim(), password);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    onClose();
  }

  return (
    <Modal open title="Admin Login" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <p className="text-sm text-ink-faint">
          Logging in enables editing, adding, and deleting. Visitors won't see
          these controls.
        </p>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={field}
          />
        </label>

        {error ? <p className="text-base text-accent">{error}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
