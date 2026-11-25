import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

const isPreview =
  process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ||
  process.env.VERCEL_ENV === "preview" ||
  process.env.NODE_ENV === "development";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: isPreview
            ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)"
            : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: isPreview ? 170 : 220,
          fontWeight: 800,
          letterSpacing: "-0.05em",
          borderRadius: 112,
        }}
      >
        {isPreview ? "DEV" : "PP"}
      </div>
    ),
    { ...size }
  );
}
