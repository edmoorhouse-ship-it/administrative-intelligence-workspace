import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-mode badge so `npm run dev` looks like the finished UI.
  devIndicators: false,
  // Which client profile the interface shows (profiles/). Read at start-up, so a change needs a restart.
  env: { WORKSPACE_PROFILE: process.env.WORKSPACE_PROFILE || "macs" },
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
