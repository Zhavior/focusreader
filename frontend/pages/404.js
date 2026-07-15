export default function Custom404() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b0d10",
        color: "#fff",
        fontFamily: "sans-serif",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div>
        <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>404</h1>
        <p>Page not found.</p>
      </div>
    </main>
  );
}
