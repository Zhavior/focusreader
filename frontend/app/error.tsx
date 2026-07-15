"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#0b0d10",
      color: "#fff",
      padding: "2rem",
      textAlign: "center"
    }}>
      <div>
        <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Something went wrong</h1>
        <p style={{ marginBottom: "1rem" }}>An unexpected error occurred.</p>
        <button
          onClick={() => reset()}
          style={{
            background: "#fff",
            color: "#000",
            border: "none",
            borderRadius: "10px",
            padding: "0.75rem 1rem",
            cursor: "pointer"
          }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
