"use client";

// Last-resort error boundary: renders its own document, styled inline so it works
// even if the stylesheet failed to load.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body style={{ margin: 0, minHeight: "100vh", background: "#0B1628", color: "#F4EEDF", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center" }}>
        <main style={{ maxWidth: "36rem", padding: "2rem" }}>
          <p style={{ color: "#D8B877", letterSpacing: "0.12em", textTransform: "uppercase", fontSize: "0.8125rem", fontWeight: 600 }}>The Government of Aletheia</p>
          <h1 style={{ fontWeight: 300, fontSize: "2.5rem", lineHeight: 1.1, margin: "1.5rem 0" }}>The public record is temporarily unavailable.</h1>
          <p style={{ color: "#C9CED8", lineHeight: 1.6 }}>Nothing has been lost. Please try again in a moment.</p>
          <button type="button" onClick={reset} style={{ marginTop: "1.5rem", background: "none", border: "1px solid #C49A4E", color: "#F4EEDF", padding: "0.75rem 1.25rem", font: "inherit", cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
