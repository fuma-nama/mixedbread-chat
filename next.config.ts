import type { NextConfig } from "next";

export default {
  // The build may register the client ID, and the browser reads the others.
  env: {
    MXBAI_CLIENT_ID: process.env.MXBAI_CLIENT_ID,
    MXBAI_PLATFORM_URL: process.env.MXBAI_PLATFORM_URL,
    ANSWERS_PER_DAY: process.env.ANSWERS_PER_DAY,
  },
  reactCompiler: true,
  experimental: { turbopackRustReactCompiler: true },
  // Keeps `next dev` from writing AGENTS.md and CLAUDE.md.
  agentRules: false,
} satisfies NextConfig;
