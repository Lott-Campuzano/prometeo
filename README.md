# Prometeo

> El titán que robó el fuego para los mortales. Aquí el fuego es la palabra que alguien necesita soltar.

Prometeo es un espacio **anónimo y efímero** para desahogarse. Entras, escribes lo que te pesa, y cuando cierras la pestaña, se apaga. Sin cuentas, sin contraseñas, sin correos, sin base de datos, sin historial.

No es terapia ni sustituye atención profesional. Es un lugar para soltar.

## Cómo funciona la privacidad

| Qué | Cómo |
| --- | --- |
| Cuentas | No existen. No hay registro, login ni verificación por correo. |
| Conversación | Vive solo en la memoria RAM del navegador (`history` en `public/js/app.js`). |
| Almacenamiento | Cero `localStorage`, `sessionStorage`, IndexedDB o cookies. |
| Servidor | Sin sesiones ni base de datos. Cada petición es independiente (*stateless*). |
| Proveedor de IA | Se envía `store: false` y solo el historial mínimo necesario para responder. |
| Al cerrar | `pagehide` borra el historial en memoria; al recargar, todo empieza de cero. |
| Inactividad | A los 20 minutos sin actividad la conversación se borra sola. |
| Rastreo | Sin analítica, sin fuentes externas, sin CDNs de terceros. |
| Caché | El HTML y las respuestas de la API se sirven con `Cache-Control: no-store`. |

El botón **Nuevo fuego** borra todo al instante. No hay papelera ni forma de recuperarlo.

## Puesta en marcha

Requisitos: Node.js 18 o superior y una clave de API de OpenAI.

```bash
git clone https://github.com/Lott-Campuzano/prometeo.git
cd prometeo
npm install

cp .env.example .env
# edita .env y pon tu clave

npm start
```

Abre `http://localhost:3000`.

### Variables de entorno

| Variable | Obligatoria | Por defecto | Descripción |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Sí | — | Tu clave. Vive solo en el servidor. |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Modelo a usar. |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | Para proveedores compatibles. |
| `PORT` | No | `3000` | Puerto del servidor. |
| `RATE_LIMIT_PER_MINUTE` | No | `20` | Mensajes por IP y minuto (en memoria). |
| `TRUST_PROXY` | No | — | Saltos de proxy si despliegas detrás de uno. |

## Seguridad

- La clave de API **nunca** llega al navegador: todas las llamadas pasan por `/api/chat` en el servidor.
- El servidor impone el *system prompt*; el cliente no puede sustituirlo ni inyectar mensajes de sistema.
- Hay límite de 2000 caracteres por mensaje, 24 turnos por petición y un límite de peticiones por IP en memoria para proteger la clave del abuso.
- Cabeceras CSP, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` y `Permissions-Policy` restrictiva.
- El origen de las peticiones se valida para que otros sitios no puedan usar tu clave a través del navegador de tus visitantes.

> **Importante:** la versión anterior de este proyecto tenía una clave de API escrita directamente en `js/funciones.js` y en el historial de Git. Si esa clave fue real, **revócala ahora** en <https://platform.openai.com/api-keys> y genera una nueva. Borrarla del código no basta: cualquiera puede leerla en el historial.

## Estructura

```
prometeo/
├── server.js           # Proxy a la API + estáticos + límites (sin estado)
├── public/
│   ├── index.html
│   ├── favicon.svg
│   ├── css/style.css
│   └── js/app.js       # Conversación solo en memoria
├── .env.example
└── package.json
```

## Qué se eliminó

- `php/login.php`, `register.php`, `verificar.php`, `process.php`, `sign.php`, `logout.php`: todo el sistema de cuentas, tokens y bloqueos por IP.
- `PHPMailer-master/` y `vendor/`: envío de tokens por correo.
- Base de datos MySQL, sesiones PHP y el botón de "Cerrar sesión".
- La clave de API del cliente y `store: true`.
- `node_modules/` del repositorio (se instala con `npm install`).

## Licencia

ISC. Ver `LICENSE`.
