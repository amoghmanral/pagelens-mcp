import { type BrowserManager } from "../browser.js";
import { VIEWPORT_PRESETS, type ViewportPreset } from "../utils/viewport-presets.js";

async function takeScreenshot(browser: BrowserManager): Promise<string> {
  const page = await browser.getPage();
  const buffer = await page.screenshot({ encoding: "base64" });
  return buffer as string;
}

export async function click(
  browser: BrowserManager,
  args: { selector: string }
): Promise<string> {
  const page = await browser.getPage();

  await page.waitForSelector(args.selector, { timeout: 5000 });
  await page.click(args.selector);

  // Wait for any navigation or network activity to settle
  await page.waitForNetworkIdle({ timeout: 3000 }).catch(() => {});

  return takeScreenshot(browser);
}

export async function type(
  browser: BrowserManager,
  args: { selector: string; text: string; clear?: boolean }
): Promise<string> {
  const page = await browser.getPage();

  await page.waitForSelector(args.selector, { timeout: 5000 });

  if (args.clear) {
    // Triple-click to select all text in the field, then typing replaces it
    await page.click(args.selector, { count: 3 });
  }

  await page.type(args.selector, args.text);

  return takeScreenshot(browser);
}

export async function navigate(
  browser: BrowserManager,
  args: { url: string }
): Promise<string> {
  const page = await browser.getPage();

  const resolved = new URL(args.url, page.url());
  await page.goto(resolved.href, { waitUntil: "networkidle2", timeout: 15000 });

  return takeScreenshot(browser);
}

export async function setViewport(
  browser: BrowserManager,
  args: { preset?: ViewportPreset; width?: number; height?: number }
): Promise<string> {
  const page = await browser.getPage();

  if (args.preset) {
    await page.setViewport(VIEWPORT_PRESETS[args.preset]);
  } else if (args.width && args.height) {
    await page.setViewport({ width: args.width, height: args.height });
  } else {
    throw new Error("Provide either a preset (mobile/tablet/desktop) or both width and height.");
  }

  return takeScreenshot(browser);
}

export async function scroll(
  browser: BrowserManager,
  args: { direction?: "up" | "down"; pixels?: number; selector?: string }
): Promise<string> {
  const page = await browser.getPage();
  const distance = args.pixels ?? 500;
  const sign = args.direction === "up" ? -1 : 1;

  if (args.selector) {
    await page.waitForSelector(args.selector, { timeout: 5000 });
    await page.evaluate(
      (sel: string, d: number) => {
        const el = document.querySelector(sel);
        if (el) el.scrollBy({ top: d, behavior: "smooth" });
      },
      args.selector,
      distance * sign
    );
  } else {
    await page.evaluate((d: number) => {
      window.scrollBy({ top: d, behavior: "smooth" });
    }, distance * sign);
  }

  // Wait for scroll to settle
  await new Promise((r) => setTimeout(r, 300));

  return takeScreenshot(browser);
}

export async function hover(
  browser: BrowserManager,
  args: { selector: string }
): Promise<string> {
  const page = await browser.getPage();

  await page.waitForSelector(args.selector, { timeout: 5000 });
  await page.hover(args.selector);

  // Brief pause for hover effects / tooltips to appear
  await new Promise((r) => setTimeout(r, 200));

  return takeScreenshot(browser);
}

export async function select(
  browser: BrowserManager,
  args: { selector: string; value: string }
): Promise<string> {
  const page = await browser.getPage();

  await page.waitForSelector(args.selector, { timeout: 5000 });
  await page.select(args.selector, args.value);

  return takeScreenshot(browser);
}
