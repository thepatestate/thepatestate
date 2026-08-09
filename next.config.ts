import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.ytimg.com" },
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "cdn.sanity.io" },
    ],
  },
  outputFileTracingIncludes: { "/api/**/*": ["./prompts/**"] },
};

export default nextConfig;
