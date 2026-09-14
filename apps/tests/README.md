# Integration tests

Browser tests against a real build of `apps/web`.

    bun run test:install        # once — downloads chromium
    bun run test:integration

Unit tests live next to the code they test (`apps/web/lib/*.test.ts`, run with `bun test`).
The split is deliberate: units cover pure logic where being wrong is invisible — timeline maths,
citation resolution — and these cover the joins between parts, which is where this product
actually breaks.

Point at an already-running server with `BASE_URL=http://localhost:3000`.
