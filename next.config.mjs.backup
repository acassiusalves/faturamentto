/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  webpack(config, { isServer }) {
    // Configuração específica para PDF.js worker
    config.module.rules.push({
      test: /pdf\.worker\.(js|mjs)$/,
      type: "asset/resource",
      generator: {
        filename: "static/chunks/[hash].worker.js",
      },
    });

    // Excluir PDF worker do processamento do Terser
    config.optimization = config.optimization || {};
    config.optimization.minimizer = config.optimization.minimizer || [];
    
    // Encontrar e configurar o TerserPlugin
    const terserPlugin = config.optimization.minimizer.find(
      (plugin) => plugin.constructor.name === 'TerserPlugin'
    );
    
    if (terserPlugin) {
      terserPlugin.options.exclude = /pdf\.worker\.(js|mjs)$/;
    }

    // Configuração para resolver problemas com Firebase
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

    // Excluir Firebase Admin do bundle do cliente
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
