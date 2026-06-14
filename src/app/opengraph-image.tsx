import { ImageResponse } from "next/og";

export const alt = "meow.wild — how high do cats live?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
          padding: 64,
          background:
            "linear-gradient(180deg, #e9f1f6 0%, #9fb1a3 26%, #43734a 52%, #143726 72%, #9c7d3f 90%, #6f5230 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.92)",
            fontWeight: 700,
            padding: "10px 26px",
            border: "2px solid rgba(255,255,255,0.6)",
            borderRadius: 999,
          }}
        >
          meow.wild
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 96,
            fontWeight: 800,
            color: "#fdfaf2",
            textAlign: "center",
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          How high do cats live?
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 30,
            fontSize: 34,
            color: "rgba(255,248,235,0.95)",
            textAlign: "center",
          }}
        >
          5,500 m → 0 m · a scroll down past every wild cat
        </div>
      </div>
    ),
    { ...size },
  );
}
