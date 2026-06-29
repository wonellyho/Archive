import { useState } from "react";
import { useAuth } from "../../context/authContext";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";

interface LoginModalProps {
  onClose: () => void;
}

const field =
  "rounded-2xl border border-line bg-paper px-4 py-2.5 text-base outline-none focus-visible:border-accent";

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
    <Modal open title="관리자 로그인" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <p className="text-sm text-ink-faint">
          로그인하면 편집·추가·삭제 기능이 켜집니다. 방문자에게는 보이지
          않습니다.
        </p>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">이메일</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="text-ink-soft">비밀번호</span>
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
            취소
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "로그인 중…" : "로그인"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
