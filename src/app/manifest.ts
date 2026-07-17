import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clausly",
    short_name: "Clausly",
    description:
      "Contract intelligence, clause summaries, grounded answers, and reminders for documents you signed.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f8f5ee",
    theme_color: "#111827",
    icons: [
      {
        src: "/icon",
        sizes: "64x64",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/brand/clausly-mark.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
