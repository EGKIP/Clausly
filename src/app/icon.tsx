import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
        alignItems: "center",
        background: "#111827",
        borderRadius: 14,
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
      >
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <rect width="64" height="64" rx="14" fill="#111827" />
        <path d="M41 15v10.5h10.5" stroke="#F8F5EE" strokeWidth="2.9" strokeLinecap="round" strokeLinejoin="round" opacity=".78" />
        <path d="M19 20.5h16.5M19 32h26M19 43.5h14.5" stroke="#F8F5EE" strokeWidth="3.3" strokeLinecap="round" />
        <path d="M19 32h19.5" stroke="#C8A65A" strokeWidth="4.4" strokeLinecap="round" />
        <circle cx="47" cy="44" r="4.9" fill="#C8A65A" stroke="#F8F5EE" strokeWidth="2.4" />
      </svg>
      </div>
    ),
    size
  );
}
