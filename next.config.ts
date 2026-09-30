import type { NextConfig } from "next";

export default {
  env: {
    // The build may register it, see scripts/register-client.ts.
    MXBAI_CLIENT_ID: process.env.MXBAI_CLIENT_ID,
    // Links to Mixedbread in the browser follow it too.
    MXBAI_PLATFORM_URL: process.env.MXBAI_PLATFORM_URL,
    // The limit notice in the browser names it.
    ANSWERS_PER_DAY: process.env.ANSWERS_PER_DAY,
  },
  reactCompiler: true,
  experimental: { turbopackRustReactCompiler: true },
  // Keeps `next dev` from writing AGENTS.md and CLAUDE.md into the project.
  agentRules: false,
} satisfies NextConfig;
