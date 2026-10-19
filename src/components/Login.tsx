import { useState, type FormEvent } from "react";
import { api } from "../api.ts";
import { Icon } from "../icons.tsx";

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <span className="brand">
          <span className="brand-mark">
            <Icon name="plane" size={15} />
          </span>
          Trip Workshop
        </span>
        <h1>Welcome back</h1>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" required />
        </label>
        {error && <p className="error small">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Checking…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
