import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import vinext from "vinext";

export default defineConfig({
  plugins: [
    // Cloudflare owns the build output; ignore Next's Node-only `output: "standalone"`.
    vinext({ nextConfig: {} }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
