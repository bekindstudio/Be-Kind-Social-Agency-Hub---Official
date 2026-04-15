export function RouteErrorFallback() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem",
        textAlign: "center",
        gap: "1rem",
      }}
    >
      <p
        style={{
          fontSize: "15px",
          color: "var(--color-text-secondary)",
        }}
      >
        Qualcosa è andato storto in questa sezione.
      </p>
      <button onClick={() => window.location.reload()} style={{ cursor: "pointer" }}>
        Ricarica pagina
      </button>
    </div>
  );
}
