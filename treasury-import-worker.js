"use strict";

// Same-origin, pinned scripts only. File bytes are received from the page and
// parsed locally; no file content is sent over the network.
importScripts("vendor/xlsx-0.20.3.mini.min.js", "treasury-import.js");

self.addEventListener("message", async (event) => {
  if (event.data?.type !== "read-xlsx") return;
  try {
    const document = await TreasuryImport.readXlsx(event.data.bytes);
    self.postMessage({ ok: true, document });
  } catch (error) {
    self.postMessage({ ok: false, error: {
      code: error?.code || "READ_ERROR",
      message: error?.message || "No se pudo leer el archivo Excel.",
    } });
  }
});
