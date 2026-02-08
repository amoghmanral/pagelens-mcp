import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { type BrowserManager } from "../browser.js";

export interface VisualDiffResult {
  isBaseline: boolean;
  diffBase64?: string;
  percentChanged?: number;
  pixelsDifferent?: number;
  totalPixels?: number;
}

async function takeScreenshotBuffer(
  browser: BrowserManager,
  route?: string
): Promise<Buffer> {
  const page = browser.getPage();

  if (route) {
    const url = new URL(route, page.url());
    await page.goto(url.href, { waitUntil: "networkidle2", timeout: 15000 });
  }

  const buffer = await page.screenshot({ encoding: "binary" });
  return buffer as Buffer;
}

export async function visualDiff(
  browser: BrowserManager,
  args: { route?: string }
): Promise<VisualDiffResult> {
  const routeKey = args.route ?? "/";
  const currentPng = await takeScreenshotBuffer(browser, args.route);

  const baselinePng = browser.getBaseline(routeKey);

  if (!baselinePng) {
    browser.setBaseline(routeKey, currentPng);
    return { isBaseline: true };
  }

  const baseline = PNG.sync.read(baselinePng);
  const current = PNG.sync.read(currentPng);

  // If dimensions changed, replace baseline and report it
  if (baseline.width !== current.width || baseline.height !== current.height) {
    browser.setBaseline(routeKey, currentPng);
    return {
      isBaseline: true,
    };
  }

  const { width, height } = current;
  const diff = new PNG({ width, height });

  const pixelsDifferent = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );

  const totalPixels = width * height;
  const percentChanged = Number(((pixelsDifferent / totalPixels) * 100).toFixed(2));

  const diffBuffer = PNG.sync.write(diff);
  const diffBase64 = diffBuffer.toString("base64");

  // Update baseline to current
  browser.setBaseline(routeKey, currentPng);

  return {
    isBaseline: false,
    diffBase64,
    percentChanged,
    pixelsDifferent,
    totalPixels,
  };
}
