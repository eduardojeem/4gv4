import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  "stories": [
    "../src/stories/Introduction.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-docs",
    "@storybook/addon-onboarding",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest"
  ],
  "framework": {
    "name": "@storybook/nextjs-vite",
    "options": {}
  },
  "staticDirs": [
    "../public"
  ],
  // Storybook owns staticDirs. Avoid Vite copying public concurrently into the same output.
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    publicDir: false,
    build: { ...viteConfig.build, copyPublicDir: false },
  }),
};
export default config;
