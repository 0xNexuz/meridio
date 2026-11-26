import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    resolveAlias: {
      // @anchor-lang/core's browser build still mentions fs in an unused Node-only path.
      fs: { browser: "./src/lib/empty.ts" },
    },
  },
};

export default nextConfig;
