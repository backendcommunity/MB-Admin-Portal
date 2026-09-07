import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * `yarn build:check` builds into its own directory.
   *
   * A verification build and a running `next dev` otherwise share `.next`, and
   * the build rewrites the module graph the dev server is holding — which shows
   * up as the dev server failing to read a file that was legitimately deleted.
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async redirects() {
    return [
      {
        source: '/mock-interviews/templates',
        destination: '/mock-interviews',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
