import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type BrowserManager } from "./browser.js";
import { screenshot, screenshotElement } from "./tools/screenshot.js";
import { consoleLogs, networkErrors } from "./tools/console.js";

export function createServer(browser: BrowserManager): McpServer {
  const server = new McpServer({
    name: "devlens",
    version: "0.1.0",
  });

  // --- screenshot ---
  server.tool(
    "screenshot",
    "Takes a screenshot of the current page. Returns a PNG image.",
    {
      route: z.string().optional().describe("Navigate to this path first (e.g. '/dashboard')"),
      fullPage: z.boolean().optional().describe("Capture entire scrollable page instead of just viewport"),
    },
    async (args) => {
      try {
        const base64 = await screenshot(browser, args);
        return {
          content: [{ type: "image", data: base64, mimeType: "image/png" }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // --- screenshot_element ---
  server.tool(
    "screenshot_element",
    "Screenshots a specific DOM element by CSS selector.",
    {
      selector: z.string().describe("CSS selector of the element to screenshot"),
    },
    async (args) => {
      try {
        const base64 = await screenshotElement(browser, args);
        return {
          content: [{ type: "image", data: base64, mimeType: "image/png" }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // --- console_logs ---
  server.tool(
    "console_logs",
    "Returns all console output (logs, warnings, errors) collected since the last call. Clears the buffer after returning.",
    {
      level: z
        .enum(["log", "warn", "error", "info", "debug", "all"])
        .optional()
        .describe("Filter by log level. Defaults to all."),
    },
    async (args) => {
      const logs = consoleLogs(browser, args);
      if (logs.length === 0) {
        return { content: [{ type: "text", text: "No console logs since last check." }] };
      }
      const text = logs
        .map((l) => `[${l.type.toUpperCase()}] ${new Date(l.timestamp).toISOString()} — ${l.text}`)
        .join("\n");
      return { content: [{ type: "text", text }] };
    }
  );

  // --- network_errors ---
  server.tool(
    "network_errors",
    "Returns failed network requests collected since the last call. Clears the buffer after returning.",
    {},
    async () => {
      const errors = networkErrors(browser);
      if (errors.length === 0) {
        return { content: [{ type: "text", text: "No network errors since last check." }] };
      }
      const text = errors
        .map(
          (e) =>
            `[${e.method}] ${e.url} — ${e.errorText} (${new Date(e.timestamp).toISOString()})`
        )
        .join("\n");
      return { content: [{ type: "text", text }] };
    }
  );

  return server;
}
