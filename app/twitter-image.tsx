import { ImageResponse } from "next/og";

// Mirrors app/opengraph-image.tsx. Kept as its own self-contained file
// (rather than importing a shared render function) because Next's file
// convention resolves opengraph-image/twitter-image per-route via their own
// static alt/size/contentType exports and default export in this exact file.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The Pate State — The Front Porch of College Football";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F1B2D",
          color: "#F3EFE6",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 96, fontWeight: 800, textTransform: "uppercase", letterSpacing: -2 }}>
          The Pate{" "}
          <span style={{ color: "#E8A33D" }}>State</span>
        </div>
        <div style={{ display: "flex", width: 220, height: 2, background: "#E8A33D", marginTop: 28 }} />
        <div style={{ display: "flex", fontSize: 32, color: "#B9B4A6", marginTop: 24, letterSpacing: 4, textTransform: "uppercase" }}>
          The Front Porch of College Football.
        </div>
      </div>
    ),
    size
  );
}
