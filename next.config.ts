import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Links to Mixedbread in the browser follow it too.
  env: { MXBAI_PLATFORM_URL: process.env.MXBAI_PLATFORM_URL },
};

export default nextConfig;
