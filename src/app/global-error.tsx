"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "#f8fafc",
            color: "#0e1f33",
          }}
        >
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ margin: "0 0 24px" }}>
              Please try again or return to the login page.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 16px",
                  background: "#13aece",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <a
                href="/login"
                style={{
                  borderRadius: 10,
                  padding: "10px 16px",
                  background: "#eef2f7",
                  color: "#0e1f33",
                  textDecoration: "none",
                }}
              >
                Back to login
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
