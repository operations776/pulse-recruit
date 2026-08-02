import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. A package-lock.json exists in the cockpit folder
  // above this repo, so Next would otherwise infer that folder as the root and
  // widen file tracing well beyond this app.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
