// The officer console's own address (see lib/hosts.ts and proxy.ts). Set ADMIN_HOST and
// PUBLIC_SITE_URL in the hosting environment; both are read at build time for links.
const adminHost = (process.env.ADMIN_HOST ?? '').trim().toLowerCase();
const siteOrigin = process.env.PUBLIC_SITE_URL ? new URL(process.env.PUBLIC_SITE_URL).origin : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_ADMIN_ORIGIN: adminHost ? `https://${adminHost}` : '',
    NEXT_PUBLIC_SITE_ORIGIN: adminHost ? siteOrigin : '',
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'source.unsplash.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
