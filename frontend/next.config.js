/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    useTypeScriptCli: true,
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/leads',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
