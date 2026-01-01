import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Minimal configuration for build success
  experimental: {
    optimizePackageImports: [
      'lucide-react'
    ],
  },

  // Basic image configuration
  images: {
    formats: ['image/webp'],
  },

  // Compression configuration
  compress: true,
};

export default nextConfig;