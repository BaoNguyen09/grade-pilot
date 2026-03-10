import { ImageResponse } from "next/og";

export const alt = "GradePilot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
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
          gap: 18,
          padding: 64,
          background: "radial-gradient(circle at 0% 0%, #fdf6e9 0%, #f6efe3 32%, #efe7d8 100%)",
        }}
      >
        <div
          style={{
            fontSize: 104,
            fontWeight: 800,
            color: "#3b2207",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          GradePilot
        </div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 600,
            color: "rgba(59,34,7,0.75)",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            textAlign: "center",
            maxWidth: 980,
          }}
        >
          plan your semesters, model weighted grades, and estimate your best‑case term GPA
        </div>
      </div>
    ),
    size
  );
}
