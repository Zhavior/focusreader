"use client";

export default function GlobalError() {
  return (
    <html>
      <body style={{
        margin: 0,
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b0d10",
        color: "#fff",
        fontFamily: "sans-serif",
        padding: "2rem",
        textAlign: "center"
      }}>
        <div>
          <h1>Application error</h1>
          <p>Something went wrong.</p>
        </div>
      </body>
    </html>
  );
}
