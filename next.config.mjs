/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  
  webpack(config, { isServer }) {
    // Ignorar completamente arquivos PDF worker
    config.module.rules.push({
      test: /pdf\.worker\.(js|mjs)$/,
      use: "ignore-loader",
    });

    // Configuração para resolver problemas com Firebase
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };

    if (!isServer) {
      config.externals = config.externals || [];
      config.externals.push("firebase-admin");
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
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.mlstatic.com",
      },
    ],
  },

  experimental: {
    serverComponentsExternalPackages: ["firebase-admin"]
  },
};

export default nextConfig;
