import { ImageResponse } from "next/og";
import { MarkSvg } from "@/components/brand/mark";

export const alt = "Clausly contract intelligence workspace";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
        background: "#F8F5EE",
        color: "#111827",
        display: "flex",
        fontFamily: "Inter, Arial, sans-serif",
        height: "100%",
        padding: 72,
        width: "100%",
      }}
      >
      <div
        style={{
          alignItems: "stretch",
          border: "1px solid #D9D1C1",
          borderRadius: 36,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: 56,
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
          <MarkSvg tile size={72} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 46, lineHeight: 1 }}>Clausly</div>
            <div style={{ color: "#6B6258", fontSize: 18, letterSpacing: 2, textTransform: "uppercase" }}>
              Contract intelligence
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 760 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 74, lineHeight: 0.96 }}>
            Understand what you signed.
          </div>
          <div style={{ color: "#403A34", fontSize: 28, lineHeight: 1.35 }}>
            Clear summaries, surfaced clauses, grounded answers, and reminders for the documents that matter.
          </div>
        </div>
      </div>
      </div>
    ),
    size
  );
}
