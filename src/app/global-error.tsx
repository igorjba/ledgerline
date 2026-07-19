"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#08090c",
          color: "#e8ecf2",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>A aplicação travou.</h1>
        <p style={{ color: "#a2adbd", maxWidth: "28rem" }}>
          Ocorreu um erro fatal fora do console. Recarregar costuma resolver.
        </p>
        <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#7a8698" }}>{error.digest}</p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            border: "1px solid #2b3543",
            background: "#141821",
            color: "#e8ecf2",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            cursor: "pointer",
          }}
        >
          Recarregar
        </button>
      </body>
    </html>
  );
}
