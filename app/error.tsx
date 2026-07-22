"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ui] page failed", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="glass-panel w-full max-w-lg rounded-[32px] border border-white/70 px-6 py-8 text-center shadow-[var(--shadow)] md:px-9">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">EchoTrace is unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          The data could not be loaded right now. Please try again in a moment.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-full bg-[var(--text)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-85"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
