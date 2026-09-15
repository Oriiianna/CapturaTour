#!/usr/bin/env node
/**
 * dev-server.js
 * Servidor local para probar la web app SIN depender de Vercel.
 * Sirve public/ como estático y expone POST /api/screenshot usando el
 * Chromium de escritorio de Playwright (no el binario Linux-only de
 * @sparticuz/chromium que usa api/screenshot.js en producción).
 *
 * Uso:
 *   npm run dev
 *   → http://localhost:3000
 */

const path = require("path");
const express = require("express");
const { chromium } = require("playwright");
const { handleScreenshotRequest } = require("./lib/respondWithZip");

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/screenshot", (req, res) => {
  handleScreenshotRequest(req, res, () => chromium.launch({ headless: true }));
});

app.listen(PORT, () => {
  console.log(`\n🖥  Dev server corriendo en http://localhost:${PORT}\n`);
});
