import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  // PDF parsing/rendering touches native canvas packages on the server. Keep
  // them external so Vercel traces the packages into the function instead of
  // trying to bundle native binaries.
  serverExternalPackages: ["canvas", "@napi-rs/canvas"],
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
