/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.spoonacular.com',
        port: '',
        pathname: '/ingredients_*/**',
      },
      {
        protocol: 'https',
        hostname: 'img.spoonacular.com',
        port: '',
        pathname: '/recipes/**',
      },
    ],
  },
};

module.exports = nextConfig;