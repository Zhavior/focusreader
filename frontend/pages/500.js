export default function Custom500() {
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
        <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>500</h1>
        <p>Internal server error.</p>
      </div>
    </main>
  );
}
