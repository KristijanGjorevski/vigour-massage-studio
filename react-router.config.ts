import type { Config } from "@react-router/dev/config";

export default {
  future: {
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
    // Off on purpose: Shopify's auth matches paths like `/auth/login` with
    // `endsWith`, which fails on raw `.data` request URLs. Revisit when
    // @shopify/shopify-app-react-router supports it.
    v8_passThroughRequests: false,
    v8_trailingSlashAwareDataRequests: true,
  },
} satisfies Config;
