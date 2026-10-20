/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The passport page became a design concept (/design/travel-document).
  async redirects() {
    return [
      { source: '/passport', destination: '/design/travel-document', permanent: true },
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
