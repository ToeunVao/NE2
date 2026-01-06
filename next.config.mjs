/** @type {import('next').NextConfig} */
const nextConfig = {
  // This line tells Next.js 16 you're happy to use the new fast engine
  experimental: {
    turbopack: {},
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
};

export default nextConfig;