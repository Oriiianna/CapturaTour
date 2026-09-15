/**
 * lib/capture.js
 * Lógica de captura compartida entre el CLI local (screenshot.js) y el
 * endpoint serverless (api/screenshot.js).
 */

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 }, // similar a iPhone 12/13/14
};

const DEFAULT_WAIT = 1000;

// Se inyecta ANTES de que cargue cualquier script de la página (addInitScript)
// y también después, por si algo la re-agrega dinámicamente.
const KILL_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }
  /* Frena scroll-triggered / reveal libs comunes (AOS, ScrollTrigger, etc) */
  [data-aos] {
    opacity: 1 !important;
    transform: none !important;
  }
`;

function slugFromUrl(url) {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function stubReducedMotion(context) {
  await context.addInitScript(() => {
    try {
      Object.defineProperty(window, "matchMedia", {
        value: (query) => ({
          matches: query.includes("prefers-reduced-motion") ? true : false,
          media: query,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    } catch (e) {}
  });
}

async function pauseVideos(page) {
  await page.evaluate(() => {
    document.querySelectorAll("video").forEach((v) => {
      try {
        v.pause();
      } catch (e) {}
    });
  });
}

/**
 * Scrollea la página hasta el fondo en pasos, esperando entre cada uno,
 * para disparar lazy-load de imágenes y animaciones de reveal por scroll
 * (IntersectionObserver, AOS, GSAP ScrollTrigger, loading="lazy", etc).
 * Sin esto, page.screenshot({ fullPage: true }) puede capturar solo el
 * hero: el contenido debajo nunca llegó a cargar porque el navegador
 * nunca lo puso en viewport.
 */
async function autoScroll(page, { delay = 200, maxSteps = 60 } = {}) {
  await page.evaluate(
    async ({ delay, maxSteps }) => {
      await new Promise((resolve) => {
        let steps = 0;
        const distance = Math.floor(window.innerHeight * 0.9); // leve solape entre pasos
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          steps++;
          if (window.scrollY + window.innerHeight >= scrollHeight || steps >= maxSteps) {
            clearInterval(timer);
            resolve();
          }
        }, delay);
      });
    },
    { delay, maxSteps }
  );

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300); // deja asentar layout/imágenes al volver arriba
}

/**
 * Captura un viewport y devuelve un buffer PNG en memoria (sin escribir a disco).
 */
async function capturePngBuffer(browser, url, deviceName, viewport, opts = {}) {
  const wait = opts.wait ?? DEFAULT_WAIT;
  const fullPage = opts.fullPage ?? true;

  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: deviceName === "mobile" ? 3 : deviceName === "tablet" ? 2 : 1,
    reducedMotion: "reduce",
  });

  await stubReducedMotion(context);

  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });

    await page.addStyleTag({ content: KILL_ANIMATIONS_CSS });
    await pauseVideos(page);

    await autoScroll(page);
    await pauseVideos(page); // por si algún <video> se montó recién durante el scroll

    await page.waitForTimeout(wait);

    const buffer = await page.screenshot({
      fullPage,
      animations: "disabled",
      type: "png",
    });

    return buffer;
  } finally {
    await context.close();
  }
}

module.exports = {
  VIEWPORTS,
  DEFAULT_WAIT,
  KILL_ANIMATIONS_CSS,
  slugFromUrl,
  autoScroll,
  capturePngBuffer,
};
