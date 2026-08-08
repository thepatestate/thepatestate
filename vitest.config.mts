import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    env: {
      PLAYBOOK_SIGNING_KEY: "test-playbook-signing-key",
    },
  },
});
