import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Custom loader (lib/image-loader.ts): remote CDN images serve direct /
    // via Sanity's CDN so they don't consume Vercel image transformations;
    // local images still route through the optimizer, so remotePatterns
    // stay as the endpoint's allow-list.
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
    remotePatterns: [
      { protocol: "https", hostname: "*.ytimg.com" },
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "cdn.sanity.io" },
    ],
  },
  outputFileTracingIncludes: { "/api/**/*": ["./prompts/**"] },
  // The community product renamed from "The Porch" to "The Quad"; /porch was a
  // published, indexed route, so it keeps its equity with a 308.
  redirects() {
    return [
      { source: "/porch", destination: "/quad", permanent: true },
      { source: "/porch/:path*", destination: "/quad/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
