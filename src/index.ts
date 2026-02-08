#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BrowserManager } from "./browser.js";
import { createServer } from "./server.js";
import type { ViewportPreset } from "./utils/viewport-presets.js";

function printUsage(): void {
  console.error(`
PageLens — MCP server that gives AI agents eyes on your frontend app

Usage:
  pagelens <url> [options]

Arguments:
  url                  The URL of your running dev server (e.g. http://localhost:3000)

Options:
  --no-headless        Show the browser window (useful for debugging)
  --viewport <preset>  Initial viewport: mobile | tablet | desktop (default: desktop)
  -h, --help           Show this help message

Examples:
  pagelens http://localhost:3000
  pagelens http://localhost:5173 --no-headless
  pagelens http://localhost:3000 --viewport mobile
`);
}

function parseArgs(argv: string[]): {
  url: string;
  headless: boolean;
  viewport: ViewportPreset;
} {
  const args = argv.slice(2); // strip node + script path

  if (args.includes("-h") || args.includes("--help")) {
    printUsage();
    process.exit(0);
  }

  // Find the URL (first positional arg that isn't a flag)
  const url = args.find((a) => !a.startsWith("--"));
  if (!url) {
    console.error("Error: No URL provided.\n");
    printUsage();
    process.exit(1);
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    console.error(`Error: Invalid URL "${url}".\n`);
    printUsage();
    process.exit(1);
  }

  const headless = !args.includes("--no-headless");

  let viewport: ViewportPreset = "desktop";
  const vpIdx = args.indexOf("--viewport");
  if (vpIdx !== -1 && args[vpIdx + 1]) {
    const val = args[vpIdx + 1];
    if (val === "mobile" || val === "tablet" || val === "desktop") {
      viewport = val;
    } else {
      console.error(`Error: Invalid viewport preset "${val}". Use mobile, tablet, or desktop.\n`);
      process.exit(1);
    }
  }

  return { url, headless, viewport };
}

async function main(): Promise<void> {
  const { url, headless, viewport } = parseArgs(process.argv);

  console.error(`PageLens starting...`);
  console.error(`  Target URL: ${url}`);
  console.error(`  Headless:   ${headless}`);
  console.error(`  Viewport:   ${viewport}`);

  const browser = new BrowserManager(url, { headless, viewport });

  // Graceful shutdown
  const cleanup = async () => {
    console.error("PageLens shutting down...");
    await browser.close();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Launch browser (but don't navigate yet — that happens lazily on first tool call)
  await browser.launch();
  console.error("Browser launched. Will connect to target URL on first tool call.");

  // Start MCP server immediately so the agent can connect
  const server = createServer(browser);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("PageLens MCP server running on stdio. Waiting for tool calls...");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
