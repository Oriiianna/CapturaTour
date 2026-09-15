#!/usr/bin/env node
/**
 * screenshot.js
 * Toma capturas full-page de una URL en 3 viewports (desktop, tablet, mobile)
 * con todas las animaciones/transiciones desactivadas.
 *
 * Uso:
 *   node screenshot.js https://tusitio.com
 *   node screenshot.js https://tusitio.com --out ./capturas --wait 1500
 *
 * Requisitos:
 *   npm install
 *   npx playwright install chromium
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { VIEWPORTS, slugFromUrl, capturePngBuffer } = require("./lib/capture");

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0].startsWith("--")) {
    console.error("❌ Falta la URL. Uso: node screenshot.js https://tusitio.com");
    process.exit(1);
  }

  const url = args[0];
  const opts = {
    url,
    outDir: "./capturas",
    wait: 1000, // espera extra en ms tras cargar (para animaciones de entrada, fuentes, etc)
    fullPage: true,
  };

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--out" && args[i + 1]) {
      opts.outDir = args[i + 1];
      i++;
    } else if (args[i] === "--wait" && args[i + 1]) {
      opts.wait = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--viewport-only" && args[i + 1]) {
      // captura solo el viewport, sin scroll (full-page = false)
      opts.fullPage = false;
      i++;
    }
  }

  return opts;
}

async function captureViewport(browser, url, deviceName, viewport, outDir, opts) {
  try {
    console.log(`  → [${deviceName}] cargando ${url} ...`);

    const buffer = await capturePngBuffer(browser, url, deviceName, viewport, opts);

    const fileName = `${slugFromUrl(url)}-${deviceName}.png`;
    const filePath = path.join(outDir, fileName);
    fs.writeFileSync(filePath, buffer);

    console.log(`  ✔ [${deviceName}] guardada en ${filePath}`);
  } catch (err) {
    console.error(`  ✘ [${deviceName}] error: ${err.message}`);
  }
}

async function main() {
  const opts = parseArgs();

  if (!fs.existsSync(opts.outDir)) {
    fs.mkdirSync(opts.outDir, { recursive: true });
  }

  console.log(`\n📸 Capturando: ${opts.url}`);
  console.log(`   Carpeta de salida: ${path.resolve(opts.outDir)}\n`);

  const browser = await chromium.launch();

  for (const [deviceName, viewport] of Object.entries(VIEWPORTS)) {
    await captureViewport(browser, opts.url, deviceName, viewport, opts.outDir, opts);
  }

  await browser.close();
  console.log("\n✅ Listo. Capturas generadas para desktop, tablet y mobile.\n");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
