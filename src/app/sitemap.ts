import type { MetadataRoute } from "next";

const publicRoutes = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/upgrade",
  "/legal/terms",
  "/legal/privacy",
  "/legal/cookies",
  "/legal/disclaimer",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return publicRoutes.map((route) => ({
    url: `https://clausly.app${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
