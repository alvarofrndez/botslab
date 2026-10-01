import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // The canvas is intentionally empty; keep the dev badge out of the corners.
  // Compile and runtime errors are still surfaced.
  devIndicators: false,
};

export default nextConfig;
