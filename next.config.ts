import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "*.ytimg.com" }] },
  outputFileTracingIncludes: { "/api/**/*": ["./prompts/**"] },
};

export default nextConfig;
