import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/login",
        "/signup",
        "/forgot-password",
        "/upgrade",
        "/legal/",
      ],
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard/",
        "/share/",
      ],
    },
    sitemap: "https://clausly.app/sitemap.xml",
  };
}
