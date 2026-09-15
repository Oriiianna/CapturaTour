/**
 * api/screenshot.js
 * POST /api/screenshot — función serverless de Vercel.
 * Lanza Chromium vía @sparticuz/chromium (Linux-only, para el entorno
 * serverless) y delega el resto a lib/respondWithZip.js, compartido con
 * dev-server.js (que usa el Chromium de escritorio de Playwright en local).
 */

const { chromium: pw } = require("playwright-core");
const { handleScreenshotRequest } = require("../lib/respondWithZip");

// @sparticuz/chromium es ESM-only (sin build CommonJS), se carga con
// import() dinámico desde este módulo CJS.
function loadChromium() {
  return import("@sparticuz/chromium").then((m) => m.default);
}

async function launchBrowser() {
  const chromium = await loadChromium();
  return pw.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

module.exports = (req, res) => handleScreenshotRequest(req, res, launchBrowser);
