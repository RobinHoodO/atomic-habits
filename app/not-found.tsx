import Link from "next/link";

// Friendly 404 — also where notFound() lands when a user requests a habit they
// can't view (the authz boundary calls notFound() rather than leaking existence).
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md">
      <div className="card flex flex-col items-center gap-3 text-center">
        <div className="text-3xl">🔍</div>
        <h1 className="text-lg font-bold">Not found</h1>
        <p className="text-sm text-muted">
          This page doesn’t exist, or it isn’t yours to see.
        </p>
        <Link href="/" className="btn btn-primary mt-1">
          Back to Today
        </Link>
      </div>
    </div>
  );
}
