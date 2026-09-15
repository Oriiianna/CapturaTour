const form = document.getElementById("capture-form");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");

function showStatus(message) {
  statusEl.textContent = message;
  statusEl.hidden = false;
}

function hideStatus() {
  statusEl.hidden = true;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError();

  const url = document.getElementById("url").value.trim();
  const projectName = document.getElementById("projectName").value.trim();

  submitBtn.disabled = true;
  showStatus("Generando capturas… esto puede tardar 15–40 segundos.");

  try {
    const response = await fetch("/api/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, projectName }),
    });

    if (!response.ok) {
      let message = `La solicitud falló (${response.status}).`;
      try {
        const data = await response.json();
        if (data.error) message = data.error;
        if (data.detail) {
          message += ` (${data.detail})`;
          console.error("Detalle del error:", data.detail);
        }
      } catch (e) {}
      throw new Error(message);
    }

    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${projectName}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);

    showStatus("¡Listo! Se descargó el .zip con las capturas.");
  } catch (err) {
    hideStatus();
    showError(err.message || "Ocurrió un error inesperado.");
  } finally {
    submitBtn.disabled = false;
  }
});
