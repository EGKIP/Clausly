import { ImageResponse } from "next/og";
import { MarkSvg } from "@/components/brand/mark";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", height: "100%", width: "100%" }}>
        <MarkSvg tile small size={64} />
      </div>
    ),
    size
  );
}
