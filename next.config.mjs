/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    ppr: false,
  },
  webpack(config) {
    config.module.rules.push({
      test: /pdf\.worker\.mjs/,
      type: 'asset/resource',
      generator: {
        filename: 'static/chunks/[hash].worker.mjs',
      },
    });
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'files-product.magalu.com',
      },
      {
        protocol: 'https',
        hostname: '**.mlstatic.com',
      },
      {
        protocol: 'http',
        hostname: '**.mlstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'api.labelary.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: '**.mercadolivre.com.br',
      },
      {
        protocol: 'https',
        hostname: '**.mercadolibre.com',
      },
    ],
  },
};

export default nextConfig;
