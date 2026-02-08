import puppeteer, { type Browser, type Page } from "puppeteer";
import { VIEWPORT_PRESETS, type ViewportPreset } from "./utils/viewport-presets.js";

export interface ConsoleEntry {
  type: "log" | "warn" | "error" | "info" | "debug";
  text: string;
  timestamp: number;
}

export interface NetworkError {
  url: string;
  method: string;
  errorText: string;
  timestamp: number;
}

const MAX_BUFFER_SIZE = 1000;

export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private targetUrl: string;
  private headless: boolean;
  private viewport: ViewportPreset;
  private connected = false;

  private consoleLogs: ConsoleEntry[] = [];
  private networkErrors: NetworkError[] = [];
  private baselines: Map<string, Buffer> = new Map();

  constructor(targetUrl: string, options: { headless?: boolean; viewport?: ViewportPreset } = {}) {
    this.targetUrl = targetUrl;
    this.headless = options.headless !== false;
    this.viewport = options.viewport ?? "desktop";
  }

  async launch(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: this.headless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport(VIEWPORT_PRESETS[this.viewport]);
    this.attachListeners(this.page);
  }

  /** Navigates to the target URL on first call. Subsequent calls are no-ops. */
  private async ensureConnected(): Promise<void> {
    if (this.connected) return;
    const page = this.page;
    if (!page) throw new Error("Browser not launched. Call launch() first.");

    await page.goto(this.targetUrl, { waitUntil: "networkidle2", timeout: 30000 });
    this.connected = true;
  }

  private attachListeners(page: Page): void {
    page.on("console", (msg) => {
      const type = msg.type() as ConsoleEntry["type"];
      this.consoleLogs.push({
        type: ["log", "warn", "error", "info", "debug"].includes(type) ? type : "log",
        text: msg.text(),
        timestamp: Date.now(),
      });
      if (this.consoleLogs.length > MAX_BUFFER_SIZE) {
        this.consoleLogs.shift();
      }
    });

    page.on("pageerror", (error) => {
      this.consoleLogs.push({
        type: "error",
        text: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
      if (this.consoleLogs.length > MAX_BUFFER_SIZE) {
        this.consoleLogs.shift();
      }
    });

    page.on("requestfailed", (request) => {
      this.networkErrors.push({
        url: request.url(),
        method: request.method(),
        errorText: request.failure()?.errorText ?? "Unknown error",
        timestamp: Date.now(),
      });
      if (this.networkErrors.length > MAX_BUFFER_SIZE) {
        this.networkErrors.shift();
      }
    });
  }

  async getPage(): Promise<Page> {
    if (!this.page) {
      throw new Error("Browser not launched. Call launch() first.");
    }
    await this.ensureConnected();
    return this.page;
  }

  /** Returns collected console logs and clears the buffer. */
  drainConsoleLogs(level?: string): ConsoleEntry[] {
    let entries = this.consoleLogs;
    if (level && level !== "all") {
      entries = entries.filter((e) => e.type === level);
    }
    this.consoleLogs = [];
    return entries;
  }

  /** Returns collected network errors and clears the buffer. */
  drainNetworkErrors(): NetworkError[] {
    const errors = this.networkErrors;
    this.networkErrors = [];
    return errors;
  }

  getBaseline(route: string): Buffer | undefined {
    return this.baselines.get(route);
  }

  setBaseline(route: string, png: Buffer): void {
    this.baselines.set(route, png);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
