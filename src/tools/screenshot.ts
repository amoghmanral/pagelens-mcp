import { type BrowserManager } from "../browser.js";

export async function screenshot(
  browser: BrowserManager,
  args: { route?: string; fullPage?: boolean }
): Promise<string> {
  const page = await browser.getPage();

  if (args.route) {
    const url = new URL(args.route, page.url());
    await page.goto(url.href, { waitUntil: "networkidle2", timeout: 15000 });
  }

  const buffer = await page.screenshot({
    fullPage: args.fullPage ?? false,
    encoding: "base64",
  });

  return buffer as string;
}

export async function screenshotElement(
  browser: BrowserManager,
  args: { selector: string }
): Promise<string> {
  const page = await browser.getPage();

  const element = await page.$(args.selector);
  if (!element) {
    throw new Error(`Element not found: ${args.selector}`);
  }

  const buffer = await element.screenshot({ encoding: "base64" });
  return buffer as string;
}

export interface RouteScreenshot {
  route: string;
  base64: string;
}

export async function multiRouteScreenshot(
  browser: BrowserManager,
  args: { routes: string[] }
): Promise<RouteScreenshot[]> {
  const page = await browser.getPage();
  const results: RouteScreenshot[] = [];

  for (const route of args.routes) {
    const url = new URL(route, page.url());
    await page.goto(url.href, { waitUntil: "networkidle2", timeout: 15000 });

    const buffer = await page.screenshot({ encoding: "base64" });
    results.push({ route, base64: buffer as string });
  }

  return results;
}
