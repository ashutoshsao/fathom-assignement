import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The seed data is read at runtime with a path built from `process.cwd()`, which Next's output
   * file tracing cannot follow statically — it only sees literal imports. Without this, the
   * prerendered call pages would still work (their JSON is inlined at build time) but every
   * dynamic route that reads seed data at runtime would find nothing on Vercel: Ask, search and
   * the public share pages. Locally it all works, because the files are simply there.
   */
  outputFileTracingIncludes: {
    "/**": ["./content/**/*"],
  },
  // In a monorepo, tracing otherwise walks up and guesses; point it at this app.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
