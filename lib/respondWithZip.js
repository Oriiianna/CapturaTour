/**
 * lib/respondWithZip.js
 * Lógica compartida entre api/screenshot.js (Vercel) y dev-server.js (local):
 * valida el request, captura los 3 viewports, convierte a WebP y responde
 * con un .zip. Recibe `launchBrowser` como parámetro para no acoplarse a
 * cómo se lanza Chromium en cada entorno.
 */

const sharp = require("sharp");
const { VIEWPORTS, slugFromUrl, capturePngBuffer } = require("./capture");

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (e) {
    return false;
  }
}

// archiver (v8+) es ESM-only, se carga con import() dinámico.
function loadZipArchive() {
  return import("archiver").then((m) => m.ZipArchive);
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {() => Promise<import('playwright-core').Browser>} launchBrowser
 */
async function handleScreenshotRequest(req, res, launchBrowser) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido. Usá POST." });
    return;
  }

  const { url, projectName } = req.body || {};

  if (typeof url !== "string" || !isValidUrl(url)) {
    res.status(400).json({ error: "URL inválida. Debe ser una URL http(s) completa." });
    return;
  }

  if (typeof projectName !== "string" || !projectName.trim()) {
    res.status(400).json({ error: "Falta el nombre del proyecto." });
    return;
  }

  const slug = slugFromUrl(projectName);
  if (!slug) {
    res.status(400).json({ error: "El nombre del proyecto no genera un nombre de archivo válido." });
    return;
  }

  let browser;
  try {
    browser = await launchBrowser();

    const results = await Promise.all(
      Object.entries(VIEWPORTS).map(async ([deviceName, viewport]) => {
        const pngBuffer = await capturePngBuffer(browser, url, deviceName, viewport, {});
        const webpBuffer = await sharp(pngBuffer).webp({ quality: 82 }).toBuffer();
        return { deviceName, buffer: webpBuffer };
      })
    );

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${slug}.zip"`);

    const ZipArchive = await loadZipArchive();
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on("error", (err) => {
      throw err;
    });
    archive.pipe(res);

    for (const { deviceName, buffer } of results) {
      archive.append(buffer, { name: `${slug}/${slug}-${deviceName}.webp` });
    }

    await archive.finalize();
  } catch (err) {
    console.error("Error generando capturas:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error generando las capturas.", detail: err.message });
    } else {
      res.destroy();
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { handleScreenshotRequest };
