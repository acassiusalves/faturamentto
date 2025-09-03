
import 'pdfjs-dist/build/pdf.worker.mjs';
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  webpack(config) {
    // Carrega o 'worker' do pdfjs-dist
    config.module.rules.push({
      test: /pdf\.worker\.mjs/,
      type: "asset/resource",
      generator: {
        filename: "static/chunks/[hash].worker.mjs",
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
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'files-product.magalu.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'http2.mlstatic.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'http2.mlstatic.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.labelary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: "https",
        hostname: "**.mercadolivre.com.br"
      },
      {
        protocol: "https",
        hostname: "**.mercadolibre.com"
      },
    ],
  },
 devIndicators: {
 allowedDevOrigins: [
 'https://*.cluster-duylic2g3fbzerqpzxxbw6helm.cloudworkstations.dev',
 ],
 },
};

export default nextConfig;
