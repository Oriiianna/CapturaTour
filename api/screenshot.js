/**
 * api/screenshot.js
 * POST /api/screenshot
 * Body: { url: string, projectName: string }
 * Respuesta: application/zip con <slug>-desktop.webp, <slug>-tablet.webp, <slug>-mobile.webp
 */

const { chromium: pw } = require("playwright-core");
const sharp = require("sharp");
const { VIEWPORTS, slugFromUrl, capturePngBuffer } = require("../lib/capture");

// @sparticuz/chromium y archiver (v8+) son paquetes ESM-only (sin build
// CommonJS), así que se cargan con import() dinámico desde este módulo CJS.
function loadChromium() {
  return import("@sparticuz/chromium").then((m) => m.default);
}
function loadZipArchive() {
  return import("archiver").then((m) => m.ZipArchive);
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (e) {
    return false;
  }
}

module.exports = async (req, res) => {
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
    const chromium = await loadChromium();

    browser = await pw.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

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
};
