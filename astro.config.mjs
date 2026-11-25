// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

/**
 * Estamos compilando (`astro build`) o sirviendo en desarrollo (`astro dev`).
 *
 * La CSP se activa solo al compilar. El servidor de desarrollo de Vite inyecta
 * el CSS como un `<style>` inline, que una CSP estricta bloquearía y dejaría la
 * página sin estilos. Comprobamos el comando en `process.argv`, que es estable
 * tanto con `npm run build` como con `npx astro build` y en Vercel.
 */
const isBuild = process.argv[2] === 'build';

/**
 * Configuración de Prometeo en Astro.
 *
 * - `output: 'static'`: la página principal y la de ayuda se prerenderizan.
 * - El endpoint `/api/chat` se marca con `prerender = false`, así que solo esa
 *   ruta se convierte en una función serverless de Vercel.
 * - `staticHeaders`: escribe las cabeceras de seguridad (incluida la CSP) en la
 *   configuración de Vercel para las páginas estáticas.
 * - `security.csp`: Astro calcula los hashes de sus scripts y estilos y añade
 *   una Política de Seguridad de Contenido restrictiva. Todo es local.
 */
export default defineConfig({
  output: 'static',
  adapter: vercel({
    maxDuration: 60,
    staticHeaders: true,
  }),
  ...(isBuild
    ? {
        security: {
          csp: {
            directives: [
              "default-src 'self'",
              "base-uri 'none'",
              "connect-src 'self'",
              "font-src 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "img-src 'self' data:",
              "object-src 'none'",
              "worker-src 'none'",
            ],
          },
        },
      }
    : {}),
  image: {
    // El sitio no usa imágenes optimizadas: el favicon es un SVG estático.
    // Desactivar el servicio evita cargar sharp en la función serverless y
    // reduce la superficie de ataque del endpoint /_image.
    service: { entrypoint: 'astro/assets/services/noop' },
  },
  markdown: {
    // No hay bloques de código en el sitio. Desactivar Shiki evita estilos
    // inline que chocarían con la CSP.
    syntaxHighlight: false,
  },
  build: {
    // El CSS es pequeño; dejarlo inline ahorra una petición. Astro añade su
    // hash a la CSP automáticamente.
    inlineStylesheets: 'auto',
  },
  devToolbar: {
    enabled: false,
  },
});
