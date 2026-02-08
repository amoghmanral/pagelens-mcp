import { type BrowserManager } from "../browser.js";

export function consoleLogs(
  browser: BrowserManager,
  args: { level?: string }
) {
  return browser.drainConsoleLogs(args.level);
}

export function networkErrors(browser: BrowserManager) {
  return browser.drainNetworkErrors();
}
