# Capturador de Proyectos

Capturas full-page de una web en **desktop**, **tablet** y **mobile**, en formato
**WebP**, con todas las animaciones/transiciones desactivadas y con auto-scroll
para que el contenido lazy-load / scroll-reveal también quede capturado (no solo
el hero).

Disponible como **web app** (deploy en Vercel, entrega un `.zip` descargable) y
como **CLI local** (para uso rápido desde la terminal, genera PNG en disco).

## Web app (uso principal)

1. Entrá a la URL donde esté deployada la app (ver "Deploy en Vercel" más abajo).
2. Completá la **URL del sitio** y un **nombre de proyecto**.
3. Al enviar, el backend genera las 3 capturas (desktop/tablet/mobile) en WebP y
   descarga automáticamente un `<nombre-proyecto>.zip` con las 3 imágenes adentro.
4. La generación puede tardar 15–40 segundos (carga real de la página + scroll +
   conversión + zip), especialmente en cold start.

### Deploy en Vercel

```bash
npm install
```

Subí el repo a GitHub y conectalo en [vercel.com](https://vercel.com) (o usá
`vercel` / `vercel --prod` con la CLI de Vercel). No hace falta configuración
adicional: `vercel.json` ya define el timeout y memoria de la función
`api/screenshot.js`.

**Nota**: el binario de Chromium (`@sparticuz/chromium`) es Linux-only, así que
esta función no se puede probar completa en Windows con `vercel dev` — usá un
Preview Deployment de Vercel (push a una rama) o WSL2 para probar el flujo real
de captura.

Si el tiempo de generación se acerca al límite configurado (`maxDuration: 60`
en `vercel.json`), puede ser necesario subirlo o pasar a un plan de Vercel con
más tiempo/memoria disponible.

## CLI local (legacy)

### Instalación

```bash
npm install
npx playwright install chromium
```

### Uso

```bash
node screenshot.js https://tusitio.com
```

Esto genera 3 archivos PNG en `./capturas`:
- `tusitio-com-desktop.png` (1920×1080)
- `tusitio-com-tablet.png` (768×1024)
- `tusitio-com-mobile.png` (390×844)

### Opciones

```bash
node screenshot.js https://tusitio.com --out ./mis-capturas --wait 2000
```

- `--out <carpeta>`: carpeta de salida (por defecto `./capturas`)
- `--wait <ms>`: espera extra en milisegundos tras cargar (por defecto 1000ms)
- `--viewport-only`: captura solo lo visible sin scrollear la página entera
  (por defecto hace full-page)

### Capturar varias webs de una

```bash
for url in https://sitio1.com https://sitio2.com https://sitio3.com; do
  node screenshot.js "$url"
done
```

## Cómo evita que las animaciones y el lazy-load rompan la captura

La lógica de captura vive en [`lib/capture.js`](lib/capture.js) y la comparten
el CLI y la web app:

1. **CSS inyectado**: fuerza `animation-duration`, `transition-duration` y
   `scroll-behavior` a `0s`/`auto` en todos los elementos.
2. **`prefers-reduced-motion`**: se simula vía `matchMedia` y
   `context.reducedMotion`, para librerías (como Framer Motion) que respetan
   esa media query.
3. **Auto-scroll**: antes de la captura, la página se scrollea hasta el fondo
   en pasos (con pausas entre cada uno) para disparar imágenes `lazy`,
   `IntersectionObserver` y animaciones de reveal por scroll (AOS, GSAP
   ScrollTrigger, etc), y después vuelve arriba. Esto es lo que evita que la
   captura full-page quede cortada en el hero.
4. **`animations: "disabled"` de Playwright**: congela animaciones CSS y Web
   Animations API nativas al momento exacto del screenshot.
5. **Videos pausados**: cualquier `<video>` se pausa antes de capturar (y de
   nuevo después del auto-scroll, por si alguno se montó recién).
6. **Espera configurable**: da tiempo a que el layout se asiente antes de la
   foto, por si hay animaciones controladas 100% por JS.
7. **Conversión a WebP**: la captura sale como PNG de Playwright y se convierte
   a WebP con `sharp` antes de entregarse (mejor peso para web).
