/** @type {import('next').NextConfig} */

const nextConfig = {
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      oneOf: [
        {
          // Match imports in JS/TS files and use @svgr/webpack
          issuer: /\.[jt]sx?$/,
          use: [
            {
              loader: "@svgr/webpack",
              options: {
                // Add any @svgr options here if you need them
                // e.g. icon: true,
              },
            },
          ],
        },
        {
          // Fallback to asset/resource if not imported in JS/TS
          // (allows <img src="file.svg" /> usage)
          type: "asset/resource",
        },
      ],
    });

    return config;
  },
  eslint:{
    ignoreDuringBuilds: true,
    rules: {
      'react/no-unescaped-entities': 'off'
    }
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

export default nextConfig;
