import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@garimpo/contracts', '@garimpo/db'],
};

export default nextConfig;
