/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@redbot/db"],
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
