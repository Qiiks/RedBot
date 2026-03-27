/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    outputFileTracingRoot: new URL("../../", import.meta.url).pathname
  },
  transpilePackages: ["@redbot/db", "@redbot/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com"
      },
      {
        protocol: "https",
        hostname: "media.discordapp.net"
      }
    ]
  }
};

export default nextConfig;
