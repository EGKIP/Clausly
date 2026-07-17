import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
        alignItems: "center",
        background: "#111827",
        borderRadius: 40,
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
      >
      <svg width="180" height="180" viewBox="0 0 180 180" fill="none">
        <rect width="180" height="180" rx="40" fill="#111827" />
        <path d="M116 43v29.5h29.5" stroke="#F8F5EE" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity=".78" />
        <path d="M53 58h46M53 90h73M53 122h41" stroke="#F8F5EE" strokeWidth="9.5" strokeLinecap="round" />
        <path d="M53 90h55" stroke="#C8A65A" strokeWidth="12.5" strokeLinecap="round" />
        <circle cx="132" cy="124" r="13.7" fill="#C8A65A" stroke="#F8F5EE" strokeWidth="6.7" />
      </svg>
      </div>
    ),
    size
  );
}
