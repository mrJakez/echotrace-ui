import { redirect } from "next/navigation";

import { readSession } from "@/lib/auth/session";
import { env } from "@/lib/env";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await readSession();
  if (session) {
    redirect("/");
  }

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-panel rounded-[36px] border border-white/70 px-6 py-8 shadow-[var(--shadow)] md:px-8">
          <span className="rounded-full border border-white/80 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
            EchoTrace
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.05em] text-[var(--text)]">
            Sign in with your passkey.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)] md:text-[15px]">
            Use a device-bound passkey to unlock the weekly recording view. Registration can be turned off after the
            first account is created.
          </p>
        </section>

        <LoginForm allowRegistration={env.authAllowRegistration} />
      </div>
    </main>
  );
}
