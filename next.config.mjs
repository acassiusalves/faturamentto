/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Essencial para deployment em VPS
  
  webpack(config, { isServer }) {
    // Configuração para PDF.js worker
    if (!isServer) {
      config.module.rules.push({
        test: /pdf\.worker\.(js|mjs)$/,
        type: "asset/resource",
        generator: {
          filename: "static/chunks/[hash].worker.js",
        },
      });
    }
    
    // Resolver problemas com Firebase em ambiente de build
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };

    return config;
  },

  // Configurações mais restritivas para produção
  typescript: {
    ignoreBuildErrors: false, // Mudado para false
  },
  eslint: {
    ignoreDuringBuilds: false, // Mudado para false
  },

  // Otimizações para build
  swcMinify: true,
  
  // Configuração de imagens
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'files-product.magalu.com',
        pathname: '/**',
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
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
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

  // Remover devIndicators para produção
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin']
  },

  // Variáveis de ambiente
  env: {
    NODE_ENV: process.env.NODE_ENV,
  }
};

export default nextConfig;
