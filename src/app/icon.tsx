import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #43734a, #143726)",
          borderRadius: 16,
        }}
      >
        <svg width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="29" r="9" fill="#f1e7cf" />
          <circle cx="11" cy="20" r="3.6" fill="#f1e7cf" />
          <circle cx="19" cy="15" r="3.6" fill="#f1e7cf" />
          <circle cx="27" cy="15" r="3.6" fill="#f1e7cf" />
          <circle cx="34" cy="20" r="3.6" fill="#f1e7cf" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
