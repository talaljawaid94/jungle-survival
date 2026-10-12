import { defineConfig } from 'vite';

// Social previews need an absolute image URL: on Vercel the production domain is known at build time, elsewhere the path stays relative.
const siteUrl = () => (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.SITE_URL || '');
const siteMeta = () => ({ name: 'site-meta', transformIndexHtml: (html) => html.replaceAll('__SITE__', siteUrl()) });

export default defineConfig({
  base: './',
  plugins: [siteMeta()],
  build: { chunkSizeWarningLimit: 1000 },
});
