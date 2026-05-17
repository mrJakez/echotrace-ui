"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useState } from "react";

type LoginFormProps = {
  allowRegistration: boolean;
};

export function LoginForm({ allowRegistration }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">(allowRegistration ? "register" : "login");
  const [pending, setPending] = useState(false);

  async function register() {
    setPending(true);
    setMessage(null);

    try {
      const optionsResponse = await fetch("/api/auth/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name })
      });

      if (!optionsResponse.ok) {
        const payload = (await optionsResponse.json()) as { message?: string };
        throw new Error(payload.message || "Registration failed");
      }

      const options = await optionsResponse.json();
      const response = await startRegistration({ optionsJSON: options });
      const verifyResponse = await fetch("/api/auth/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response)
      });

      if (!verifyResponse.ok) {
        const payload = (await verifyResponse.json()) as { message?: string };
        throw new Error(payload.message || "Registration verification failed");
      }

      window.location.href = "/";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setPending(false);
    }
  }

  async function login() {
    setPending(true);
    setMessage(null);

    try {
      const optionsResponse = await fetch("/api/auth/login/options", { method: "POST" });
      if (!optionsResponse.ok) {
        const payload = (await optionsResponse.json()) as { message?: string };
        throw new Error(payload.message || "Login failed");
      }

      const options = await optionsResponse.json();
      const response = await startAuthentication({ optionsJSON: options });
      const verifyResponse = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response)
      });

      if (!verifyResponse.ok) {
        const payload = (await verifyResponse.json()) as { message?: string };
        throw new Error(payload.message || "Login verification failed");
      }

      window.location.href = "/";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="glass-panel rounded-[36px] border border-white/70 px-6 py-6 shadow-[var(--shadow)] md:px-8">
      <div className="flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.84)] p-1">
        <button
          className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
            mode === "login" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
          }`}
          onClick={() => setMode("login")}
          type="button"
        >
          Login
        </button>
        {allowRegistration ? (
          <button
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
              mode === "register" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
            }`}
            onClick={() => setMode("register")}
            type="button"
          >
            Register
          </button>
        ) : null}
      </div>

      {mode === "register" ? (
        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text)]" htmlFor="register-name">
              Name
            </label>
            <input
              className="w-full rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgba(59,130,246,0.55)]"
              id="register-name"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text)]" htmlFor="register-email">
              Email
            </label>
            <input
              className="w-full rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgba(59,130,246,0.55)]"
              id="register-email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </div>
          <button
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending || !email.trim() || !name.trim()}
            onClick={register}
            type="button"
          >
            {pending ? "Registering..." : "Create passkey"}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-sm leading-6 text-[var(--muted)]">
            Sign in with a saved passkey from this device or password manager.
          </p>
          <button
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            onClick={login}
            type="button"
          >
            {pending ? "Waiting for passkey..." : "Continue with passkey"}
          </button>
        </div>
      )}

      {message ? (
        <p className="mt-4 rounded-2xl border border-[rgba(251,191,36,0.28)] bg-[rgba(255,251,235,0.92)] px-4 py-3 text-sm text-[rgba(146,64,14,0.92)]">
          {message}
        </p>
      ) : null}
    </section>
  );
}
