# Prometeo

> Un lugar para soltar lo que pesa.

Prometeo es un espacio **anónimo y efímero** para desahogarse. Entras, escribes lo que te
pesa, y cuando cierras la pestaña se va. Sin cuentas, sin contraseñas, sin correos, sin base de
datos y sin historial.

No es terapia ni sustituye la atención profesional. Es un lugar para soltar. Si hay peligro
inmediato, la aplicación invita a llamar a emergencias y ofrece una lista de líneas de ayuda por
país, revisada y con fuentes.

El proyecto está reescrito en **Astro 6** con HTML, CSS y JavaScript vainilla, y está preparado
para desplegarse en **Vercel**: las páginas se prerenderizan y solo el proxy del chat se ejecuta
como función serverless.

---

## Índice

1. [Principios](#principios)
2. [Stack](#stack)
3. [Puesta en marcha](#puesta-en-marcha)
4. [Variables de entorno](#variables-de-entorno)
5. [Despliegue en Vercel](#despliegue-en-vercel)
6. [Privacidad](#privacidad)
7. [Seguridad](#seguridad)
8. [Líneas de ayuda](#líneas-de-ayuda)
9. [Interfaz, temas y tipografía](#interfaz-temas-y-tipografía)
10. [Estructura y documentación del código](#estructura-y-documentación-del-código)
11. [Rutas y flujo de una petición](#rutas-y-flujo-de-una-petición)
12. [Pruebas](#pruebas)
13. [Accesibilidad](#accesibilidad)
14. [Limitaciones conocidas](#limitaciones-conocidas)
15. [Historial de la clave filtrada](#historial-de-la-clave-filtrada)
16. [Licencia](#licencia)

---

## Principios

| Principio | Cómo se cumple |
| --- | --- |
| **Anónimo** | No hay registro, login, correo ni identificadores de usuario. |
| **Efímero** | La conversación vive solo en la memoria de la pestaña. |
| **Sin rastro** | Cero `localStorage`, `sessionStorage`, IndexedDB, cookies o analítica. |
| **Sin terceros** | Fuentes, CSS, JS y datos se sirven desde el mismo origen. No hay Google Fonts, CDNs ni píxeles. |
| **Clave protegida** | La clave del proveedor vive solo en el servidor. El navegador habla con `/api/chat`. |
| **Sin base de datos** | El proxy es *stateless*: cada petición lleva su propio historial y no se guarda nada. |
| **Con recursos reales** | Las líneas de ayuda se revisaron y citan fuentes; no son números inventados. |

---

## Stack

- **Astro 6.4** (`output: 'static'`): HTML prerenderizado y cero JavaScript de framework.
- **JavaScript vainilla** para el chat, el tema y el diálogo de ayuda.
- **CSS moderno** con variables, gradientes verde→azul y `prefers-color-scheme`.
- **`@astrojs/vercel` 10** para convertir `src/pages/api/chat.js` en una función serverless.
- **Poppins** autoalojada (licencia OFL) para el texto y **Courier** del sistema para los títulos.
- **Node.js ≥ 22.12** (requisito de Astro 6; Vercel usa Node 22).

> Astro 7 pide Node ≥ 22.23.4. Para que el proyecto funcione también en entornos
> con Node 22.12–22.22, se fija Astro 6.4.8. Actualizar es posible cuando el
> entorno de desarrollo y Vercel usen una versión más reciente.

No hay React, Vue, Svelte, Tailwind ni dependencias de cliente.

---

## Puesta en marcha

Requisitos: Node.js 22.12 o superior y una clave de API compatible con OpenAI.

```bash
git clone https://github.com/Lott-Campuzano/prometeo.git
cd prometeo
npm install

cp .env.example .env
# edita .env y escribe tu OPENAI_API_KEY

npm run dev
```

Abre <http://localhost:4321>. El proxy funciona en `http://localhost:4321/api/chat`.

Comandos disponibles:

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo de Astro con recarga en caliente. |
| `npm run build` | Genera el sitio estático y la función de Vercel en `.vercel/output`. |
| `npm run check` | Alias de `npm run build` para validar el proyecto. |
| `npm start` | Alias de `npm run dev`. |

> El adaptador de Vercel no implementa `astro preview`. Para revisar el resultado en local usa
> `npx vercel dev`, o sube una rama y abre el despliegue de *Preview* de Vercel.
>
> En desarrollo, Astro no aplica la CSP porque Vite inyecta el CSS en línea. La CSP se genera en
> el build y se comprueba en el despliegue.

---

## Variables de entorno

| Variable | Obligatoria | Por defecto | Descripción |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Sí | — | Clave del proveedor. Solo se lee en el servidor. |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Modelo a usar. |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | Para proveedores compatibles. |
| `RATE_LIMIT_PER_MINUTE` | No | `20` | Peticiones por IP y minuto y por instancia. |

Astro carga `.env` automáticamente en desarrollo. En Vercel se configuran en **Project →
Settings → Environment Variables** para Production, Preview y Development.

Nunca subas `.env` al repositorio. `.gitignore` ya lo excluye.

---

## Despliegue en Vercel

### Desde el panel (recomendado)

1. Sube el repositorio a GitHub.
2. En Vercel, **Add New → Project** e importa el repositorio.
3. Vercel detecta Astro. Comprueba:
   - **Framework Preset:** Astro
   - **Build Command:** `npm run build`
   - **Output Directory:** se gestiona con el adaptador (no lo cambies)
   - **Node.js Version:** 22.x
4. Añade `OPENAI_API_KEY` en **Environment Variables**.
5. Pulsa **Deploy**.

El adaptador genera `.vercel/output`, prerenderiza `/`, `/ayuda` y `/404`, y publica
`/api/chat` como función Node.js. La configuración incluye `maxDuration: 60`.

### Desde la CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel env add OPENAI_API_KEY
npm run build
vercel deploy --prebuilt --prod
```

### Comprobaciones después del despliegue

- `/` debe cargar sin peticiones a dominios externos (revisa la pestaña Network).
- `/ayuda` debe funcionar incluso con JavaScript desactivado.
- `/api/chat` sin clave debe responder `503` con un mensaje claro.
- La respuesta debe incluir la cabecera `Content-Security-Policy` generada por Astro.
- Los números de teléfono deben abrir el marcador (`tel:`) en el móvil.

---

## Privacidad

| Qué | Cómo |
| --- | --- |
| Cuentas | No existen. No hay registro, login ni verificación por correo. |
| Conversación | Vive solo en el array `history` de `src/scripts/chat.js`, en memoria. |
| Almacenamiento del navegador | Cero `localStorage`, `sessionStorage`, IndexedDB o cookies. |
| Servidor | Sin sesiones, sin base de datos, sin caché de conversaciones. |
| Proveedor de IA | Se envía `store: false` y solo el historial mínimo para responder. |
| Al cerrar | `pagehide` borra el historial en memoria; al recargar todo empieza de cero. |
| Inactividad | A los 20 minutos sin actividad la conversación se borra sola. |
| Tema | La preferencia de tema también vive solo en memoria: al recargar vuelve al sistema. |
| Rastreo | Sin analítica, sin fuentes externas, sin CDNs de terceros, sin imágenes remotas. |
| Logs | El servidor no registra el contenido de los mensajes ni la clave. |
| Límite de peticiones | Solo se guarda en memoria un hash corto de la IP durante 60 segundos. |

**El botón «Empezar de nuevo»** borra todo al instante. No hay papelera ni forma de recuperarlo.

### ¿Por qué el tema no se guarda?

Guardarlo en `localStorage` o en una cookie dejaría un rastro persistente en el dispositivo.
Para mantener la promesa de «sin rastro», el tema es automático al cargar y el interruptor solo
cambia el estado de la pestaña actual.

### Enlaces externos

Los enlaces a fuentes, a Find A Helpline y al repositorio solo se abren cuando la persona hace
clic. No se cargan recursos de esos dominios. Todas las páginas declaran `no-referrer`, la API
responde con `Referrer-Policy: no-referrer` y los enlaces externos usan
`rel="noopener noreferrer"`.

---

## Seguridad

- La clave **nunca** llega al navegador. Todo pasa por `POST /api/chat`.
- El *system prompt* se impone en el servidor; el cliente no puede sustituirlo ni inyectar
  mensajes con rol `system`.
- Validación estricta del historial: solo roles `user`/`assistant`, texto no vacío, 2.000
  caracteres por mensaje, 24 turnos por petición y 32 KB de cuerpo máximo.
- Límite de peticiones en memoria por IP hasheada para proteger la clave del abuso.
- Comprobación de mismo origen con `Sec-Fetch-Site` y `Origin`.
- `Content-Type: application/json` obligatorio; respuestas de error en JSON y sin caché.
- CSP generada por Astro con hashes de scripts y estilos, más `default-src 'self'`,
  `connect-src 'self'`, `font-src 'self'`, `frame-ancestors 'none'` y `object-src 'none'`.
  El adaptador de Vercel escribe la cabecera para las páginas prerenderizadas.
- `X-Content-Type-Options: nosniff` y `Referrer-Policy: no-referrer` en las respuestas del API.
- No se usa `innerHTML` para pintar mensajes: solo `textContent`.

> **Límite del rate limiting:** al ser funciones serverless, Vercel puede tener varias instancias
> y cada una lleva su propio contador. Es una barrera *best-effort*, no una cuota global. Si
> necesitas una cuota estricta, añade Vercel KV o Upstash; eso implicaría almacenar contadores
> (no conversaciones) y debe documentarse.

### Si algo falla en la CSP

Astro calcula los hashes de sus propios scripts y estilos. Si añades un script inline nuevo,
usa la configuración de `security.csp` o muévelo a un módulo. Revisa la consola del navegador en
el despliegue, no en `npm run dev`.

---

## Líneas de ayuda

Los datos están en `src/data/crisis-lines.json` y se renderizan en el build. No se descargan en
el navegador.

- **Botón del navbar:** en `/` abre un `<dialog>` nativo con búsqueda y detección del país según
  `navigator.language`.
- **Página completa:** `/ayuda` funciona sin JavaScript y muestra fuentes, fecha de revisión y
  el aviso de emergencia.
- **Cobertura:** América, Europa, Asia, África y Oceanía, con números de emergencia y líneas de
  apoyo psicológico.
- **Fecha de revisión:** 24 de noviembre de 2026.
- **Fuentes globales:** Find A Helpline, la lista de líneas de crisis de Wikipedia y la OMS. Cada
  país puede incluir un enlace oficial en el campo `source`.

### Cómo actualizar un número

1. Edita `src/data/crisis-lines.json`.
2. Cada país tiene esta forma:

```json
{
  "code": "MX",
  "name": "México",
  "region": "América",
  "source": "https://www.gob.mx/salud/conasama",
  "emergency": [{ "label": "Emergencias", "number": "911" }],
  "lines": [
    {
      "name": "Línea de la Vida",
      "number": "800 911 2000",
      "note": "24 h · CONASAMA"
    }
  ]
}
```

3. Campos opcionales:
   - `source`: enlace oficial que se muestra con el icono de fuente.
   - `mode: "sms"`: el número se enlaza con `sms:` en lugar de `tel:` (por ejemplo, Shout en
     Reino Unido).
4. Actualiza `reviewed` (ISO) y `reviewedLabel` (texto visible).
5. Ejecuta `npm run build` y revisa `/ayuda`.

**Reglas de seguridad:** no inventes números, no pongas líneas sin verificar y mantén siempre un
número de emergencias por país. Si una línea no responde, la interfaz recomienda llamar a
emergencias o consultar Find A Helpline. Los números pueden cambiar: la fecha de revisión y las
fuentes son parte del producto, no un adorno.

---

## Interfaz, temas y tipografía

- **Marca:** solo el texto «Prometeo» en Courier. No hay icono de llama ni imágenes de fuego.
- **Degradado:** verde esmeralda → azul, tanto en el fondo como en los botones y el texto
  destacado. El fondo tiene dos halos suaves, uno verde y otro azul.
- **Temas:** claro, oscuro y automático. El automático sigue `prefers-color-scheme`; el
  interruptor del navbar cicla entre los tres estados y se apoya en `data-theme` + `color-scheme`.
- **Tipografía:** Poppins (400/500/600) para el texto; Courier del sistema para títulos, marca,
  cifras y etiquetas. No se descarga ninguna fuente de terceros.
- **Botón de reinicio:** «Empezar de nuevo» (antes «Nuevo fuego»).
- **Estados vacíos:** el bloque inicial se renderiza en Astro y el cliente lo clona al borrar,
  sin reconstruir HTML a mano.
- **Diálogo:** `<dialog>` nativo, cierre con `Esc`, clic en el fondo o botón; búsqueda sin acentos
  y sin mayúsculas; banner «Parece que estás en…» si el idioma del navegador incluye región.

---

## Estructura y documentación del código

```text
prometeo/
├── astro.config.mjs          # Astro + Vercel + CSP + salida estática
├── .nvmrc                     # Node 22 para nvm/fnm
├── package.json
├── .env.example
├── public/
│   ├── favicon.svg           # Monograma P con degradado verde→azul
│   └── fonts/
│       ├── poppins-400.woff2
│       ├── poppins-500.woff2
│       ├── poppins-600.woff2
│       └── OFL.txt
└── src/
    ├── config.js             # Marca, límites del chat e ideas iniciales
    ├── data/
    │   └── crisis-lines.json # Datos revisados de líneas de ayuda
    ├── layouts/
    │   └── BaseLayout.astro  # <html>, metadatos, fuentes, cabecera y pie
    ├── pages/
    │   ├── index.astro       # Portada + chat + diálogo
    │   ├── ayuda.astro       # Página completa de líneas de ayuda
    │   ├── 404.astro
    │   └── api/
    │       └── chat.js       # Endpoint serverless (prerender = false)
    ├── lib/
    │   ├── prometeo.js       # Prompt, validación, rate limit y proxy
    │   ├── crisis.js         # Agrupación, enlaces tel: y búsqueda
    │   └── text.js           # Normalización de texto
    ├── components/
    │   ├── Header.astro
    │   ├── Footer.astro
    │   ├── ThemeToggle.astro
    │   ├── Icon.astro
    │   ├── Chat.astro
    │   ├── CrisisDialog.astro
    │   └── CrisisList.astro
    ├── scripts/
    │   ├── chat.js           # Conversación en memoria + diálogo
    │   └── theme.js          # Tema automático/claro/oscuro en memoria
    └── styles/
        └── global.css        # Tokens, temas, componentes y responsive
```

### Archivos clave y responsabilidades

| Archivo | Responsabilidad |
| --- | --- |
| `src/pages/api/chat.js` | Declara `prerender = false` y delega en `handleChat`. |
| `src/lib/prometeo.js` | `SYSTEM_PROMPT`, `sanitizeHistory`, `isSameOrigin`, `checkRateLimit`, `handleChat`. |
| `src/lib/crisis.js` | `groupByRegion`, `telHref`, `countrySearchText`; importa el JSON en build. |
| `src/lib/text.js` | `normalize`: quita acentos y mayúsculas para la búsqueda. |
| `src/scripts/chat.js` | `initChat` (envío, borrado, inactividad) e `initCrisisDialog` (apertura, filtro, país detectado). |
| `src/scripts/theme.js` | Ciclo `auto → light → dark`; nunca escribe en almacenamiento. |
| `src/components/CrisisList.astro` | Renderiza países, emergencias y líneas con enlaces `tel:`/`sms:`. |
| `src/data/crisis-lines.json` | Fuente única de verdad de las líneas de ayuda. |

### Convenciones

- Todos los archivos llevan comentarios en español explicando el porqué, no solo el qué.
- Los componentes de Astro renderizan HTML; la interactividad está en `src/scripts`.
- No se usa `innerHTML` con datos del usuario.
- Los textos visibles están en español; el tono es cercano y sin jerga clínica.
- Los límites del chat se comparten entre cliente y servidor desde `src/config.js`.

---

## Rutas y flujo de una petición

| Ruta | Tipo | Descripción |
| --- | --- | --- |
| `/` | Estática | Chat, portada y diálogo de ayuda. |
| `/ayuda` | Estática | Líneas de ayuda completas y fuentes. |
| `/api/chat` | Serverless `POST` | Proxy al proveedor. Sin estado. |
| `/404` | Estática | Página no encontrada. |

Flujo del chat:

1. El navegador guarda el mensaje en el array `history` (memoria).
2. `fetch('/api/chat', { credentials: 'omit', cache: 'no-store' })` envía solo los últimos 24
   turnos.
3. El endpoint comprueba origen, límite, tipo y tamaño; valida el historial.
4. El servidor añade el *system prompt* y llama al proveedor con `store: false`.
5. Devuelve `{ reply }`; el cliente lo pinta con `textContent`.
6. Al cerrar, recargar, pulsar «Empezar de nuevo» o pasar 20 minutos sin actividad, se borra.

---

## Pruebas

### Build y comprobación de sintaxis

```bash
npm run build
```

Debe terminar sin errores y generar `.vercel/output`.

### Desarrollo

```bash
npm run dev
```

Prueba:

- Enviar un mensaje con la clave configurada.
- Pulsar «Empezar de nuevo» y comprobar que el estado vacío vuelve.
- Recargar: no debe quedar nada.
- Abrir «Líneas de ayuda»: búsqueda, enlace `tel:`, cierre con `Esc`.
- Cambiar el tema tres veces y recargar: vuelve al automático.
- Abrir `/ayuda` con JavaScript desactivado.
- Revisar que no hay peticiones a dominios externos.

### Sin clave (respuesta esperada)

```bash
curl -i -X POST http://localhost:4321/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hola"}]}'
```

Debe devolver `503` con un mensaje claro y sin exponer detalles internos.

### Con un proveedor simulado

Puedes apuntar `OPENAI_BASE_URL` a un servidor local que implemente
`POST /v1/chat/completions` y devuelva:

```json
{ "choices": [{ "message": { "content": "Respuesta de prueba" } }] }
```

Así se prueba el flujo completo sin gastar tokens ni usar la clave real.

---

## Accesibilidad

- HTML semántico, un solo `<h1>` por página y jerarquía de encabezados coherente.
- Enlace «Saltar al contenido», `aria-live` en el registro del chat y etiquetas en todos los
  controles.
- Diálogo nativo con trampa de foco y cierre con `Esc`.
- Enlaces `tel:` con `aria-label` que incluyen el nombre de la línea y el número.
- Contraste alto en ambos temas, foco visible y soporte de `prefers-reduced-motion`.
- La página `/ayuda` no depende de JavaScript.

---

## Limitaciones conocidas

- El límite de peticiones es por instancia y en memoria; no es una cuota global.
- El proveedor recibe la conversación para responder. Aunque se envía `store: false`, la
  política de retención del proveedor depende de él; usa uno de confianza.
- El país detectado depende del idioma del navegador y puede fallar. La búsqueda y la lista
  completa siempre están disponibles.
- Los números de ayuda cambian. La fecha de revisión y las fuentes están visibles, pero no hay
  verificación automática.
- El tema no persiste entre recargas por decisión de privacidad.
- La página principal prerenderizada puede ser cacheada por la CDN de Vercel; no contiene datos
  personales. Las respuestas del API sí llevan `Cache-Control: no-store`.
- `npm audit` marca avisos de `sharp` en la cadena de Astro 6. Este sitio no procesa imágenes:
  el favicon es un SVG y el servicio de imágenes está desactivado, así que `sharp` no se incluye
  en la función desplegada (3 MB frente a 20 MB con el servicio por defecto). Actualizar a
  Astro 7 requiere Node ≥ 22.23.4.

---

## Historial de la clave filtrada

La versión anterior de este proyecto tenía una clave de API escrita directamente en
`js/funciones.js` y en el historial de Git. **Si esa clave fue real, revócala ahora** en
<https://platform.openai.com/api-keys> y genera una nueva. Borrarla del código no basta:
cualquiera puede leerla en el historial.

Esta versión no contiene claves en el repositorio. `.env` está ignorado y la clave solo se lee
en el servidor desde `process.env`.

---

## Licencia

Código: **CC0 1.0 Universal**. Ver [`LICENSE`](LICENSE).

Tipografía Poppins: **SIL Open Font License 1.1**. Ver [`public/fonts/OFL.txt`](public/fonts/OFL.txt).

Los datos de líneas de ayuda pertenecen a sus fuentes originales; se citan en la aplicación y en
[`src/data/crisis-lines.json`](src/data/crisis-lines.json).
