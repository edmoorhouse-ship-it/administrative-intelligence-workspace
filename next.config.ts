import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-mode badge so `npm run dev` looks like the finished UI.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
