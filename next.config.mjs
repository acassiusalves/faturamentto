/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESSENCIAL para VPS e Firebase
  output: 'standalone',
  
  // Configuração para Firebase Functions
  trailingSlash: true,
  
  webpack(config, { isServer }) {
    // PDF.js worker configuration
    if (!isServer) {
      config.module.rules.push({
        test: /pdf\.worker\.(js|mjs)$/,
        type: "asset/resource",
        generator: {
          filename: "static/chunks/[hash].worker.js",
        },
      });
    }
    
    // Firebase compatibility
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
    };

    // Exclude Firebase Admin from client bundle
    if (!isServer) {
      config.externals = config.externals || [];
      config.externals.push('firebase-admin');
    }

    return config;
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Otimizações
  swcMinify: true,
  
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

  experimental: {
    serverComponentsExternalPackages: ['firebase-admin']
  },
};

export default nextConfig;
