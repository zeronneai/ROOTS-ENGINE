import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remotion and the Claude SDK are only used on the server or inside client
  // components; keep the native renderer packages out of the Next bundle.
  serverExternalPackages: ["@remotion/renderer", "@remotion/bundler"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
