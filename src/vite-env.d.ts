/// <reference types="vite/client" />

// Typed build-time configuration. Everything here is public by construction:
// VITE_-prefixed values are inlined into the client bundle, so never put a
// secret in one.
interface ImportMetaEnv {
  readonly VITE_CONVEX_URL?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  /**
   * JSON array of portfolio variants — see portfolioVariants.ts for the shape.
   * Optional and personal: absent in a fresh clone, which disables the feature.
   */
  readonly VITE_PORTFOLIO_VARIANTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
