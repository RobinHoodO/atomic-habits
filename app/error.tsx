"use client";

// Catches any uncaught error from a page render or server action so the user
// sees a friendly card instead of a raw Next.js stack trace.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md">
      <div className="card flex flex-col items-center gap-3 text-center">
        <div className="text-3xl">😅</div>
        <h1 className="text-lg font-bold">Something went sideways</h1>
        <p className="text-sm text-muted">
          That action didn’t go through. Nothing was lost — give it another try.
        </p>
        <button onClick={reset} className="btn btn-primary mt-1">
          Try again
        </button>
        <a href="/" className="text-xs text-muted hover:text-accent">
          Back to Today
        </a>
      </div>
    </div>
  );
}
