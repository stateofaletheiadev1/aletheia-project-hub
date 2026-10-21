// Security headers on every response. The site loads nothing from other origins except
// photographs (images.unsplash.com) and StableChain status (rpc.stateofaletheia.org).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com",
  "font-src 'self' data:",
  "connect-src 'self' https://rpc.stateofaletheia.org",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // The passport page became a design concept (/design/travel-document).
  async redirects() {
    return [
      { source: '/passport', destination: '/design/travel-document', permanent: true },
      { source: '/host-nations', destination: '/development', permanent: true },
      { source: '/:lang(en|de|nl|sr|it)/host-nations', destination: '/:lang/development', permanent: true },
      { source: '/:lang(en|de|nl|sr|it)/passport', destination: '/:lang/design/travel-document', permanent: true },
      // Gazette records renamed when they were rewritten as design and planning records (lib/gazette.ts).
      ...Object.entries({
        'icao-td3-passport-standard': 'travel-document-design-concept',
        'offshore-wind-concession-round': 'offshore-wind-design-study',
        'maritime-environmental-accord': 'marine-environmental-monitoring',
      }).flatMap(([from, to]) => [
        { source: `/news/${from}`, destination: `/news/${to}`, permanent: true },
        { source: `/:lang(en|de|nl|sr|it)/news/${from}`, destination: `/:lang/news/${to}`, permanent: true },
        { source: `/pdf/gazette/${from}`, destination: `/pdf/gazette/${to}`, permanent: true },
      ]),
    ];
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
