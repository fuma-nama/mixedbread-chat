import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // The build may register it, see scripts/register-client.ts.
    MXBAI_CLIENT_ID: process.env.MXBAI_CLIENT_ID,
    // Links to Mixedbread in the browser follow it too.
    MXBAI_PLATFORM_URL: process.env.MXBAI_PLATFORM_URL,
  },
};

export default nextConfig;
