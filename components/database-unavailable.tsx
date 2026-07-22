"use client";

export function DatabaseUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="glass-panel w-full max-w-lg rounded-[32px] border border-white/70 px-6 py-8 text-center shadow-[var(--shadow)] md:px-9">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-xl" aria-hidden="true">
          !
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">
          Database unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          EchoTrace could not connect to the database. Please check that PostgreSQL is running and try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full bg-[var(--text)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-85"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
