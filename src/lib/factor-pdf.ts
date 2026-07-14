import puppeteer from "puppeteer-core";
import JSZip from "jszip";
import { factorInvoiceHtml, type InvoiceFactor } from "@/lib/factor-invoice-html";

// System chromium path (Docker installs it at /usr/bin/chromium). Overridable.
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/usr/bin/chromium";

/** Render one invoice HTML to a PDF buffer on an already-open browser page. */
async function renderPdf(
  page: import("puppeteer-core").Page,
  factor: InvoiceFactor,
): Promise<Uint8Array> {
  await page.setContent(factorInvoiceHtml(factor), { waitUntil: "load" });
  return page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
  });
}

/** Render a SINGLE factor to a PDF buffer (for the per-factor share/download). */
export async function renderFactorPdf(factor: InvoiceFactor): Promise<Uint8Array> {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    const pdf = await renderPdf(page, factor);
    await page.close();
    return pdf;
  } finally {
    await browser.close();
  }
}

/**
 * Build a ZIP for a month's backup: the JSON snapshot plus one A4 PDF per
 * factor, rendered from the exact invoice layout (embedded Persian font, so
 * text shapes correctly without any system font). Returns the zip bytes.
 */
export async function buildBackupZip(
  month: string,
  jsonPayload: unknown,
  factors: InvoiceFactor[],
): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(`backup-${month}.json`, JSON.stringify(jsonPayload, null, 2));

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    const folder = zip.folder("factors")!;
    for (const f of factors) {
      const pdf = await renderPdf(page, f);
      folder.file(`factor-${f.number}.pdf`, pdf);
    }
    await page.close();
  } finally {
    await browser.close();
  }

  return zip.generateAsync({ type: "uint8array" });
}
