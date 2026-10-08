import { ImageResponse } from "next/og";
import { MarkSvg } from "@/components/brand/mark";
import { MARK_COLORS } from "@/components/brand/mark-geometry";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

/* iOS applies its own corner mask, so this is a full-bleed square rather than the rounded tile. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: MARK_COLORS.tile,
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <MarkSvg size={180} />
      </div>
    ),
    size
  );
}
