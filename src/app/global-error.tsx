"use client";

// Last-resort boundary: catches errors in the root layout itself.
// Must render its own <html>/<body> because it replaces the root layout.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          fontFamily: "Tahoma, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#f3f5fa",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>مشکلی پیش آمد</h1>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>
            خطایی غیرمنتظره رخ داد. لطفاً دوباره تلاش کنید.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#b08400",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            تلاش مجدد
          </button>
        </div>
      </body>
    </html>
  );
}
