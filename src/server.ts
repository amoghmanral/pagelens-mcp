import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type BrowserManager } from "./browser.js";
import { screenshot, screenshotElement, multiRouteScreenshot } from "./tools/screenshot.js";
import { consoleLogs, networkErrors } from "./tools/console.js";
import { click, type as typeText, navigate, setViewport } from "./tools/interact.js";
import { domInspect } from "./tools/inspect.js";
import { visualDiff } from "./tools/diff.js";

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

  // --- click ---
  server.tool(
    "click",
    "Clicks an element by CSS selector and returns a screenshot of the result.",
    {
      selector: z.string().describe("CSS selector of the element to click"),
    },
    async (args) => {
      try {
        const base64 = await click(browser, args);
        return {
          content: [{ type: "image", data: base64, mimeType: "image/png" }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // --- type ---
  server.tool(
    "type",
    "Types text into an input field and returns a screenshot of the result.",
    {
      selector: z.string().describe("CSS selector of the input element"),
      text: z.string().describe("Text to type into the element"),
      clear: z.boolean().optional().describe("Clear the field before typing (default: false)"),
    },
    async (args) => {
      try {
        const base64 = await typeText(browser, args);
        return {
          content: [{ type: "image", data: base64, mimeType: "image/png" }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // --- navigate ---
  server.tool(
    "navigate",
    "Navigates to a URL or path and returns a screenshot of the new page.",
    {
      url: z.string().describe("Full URL or path (e.g. '/dashboard') to navigate to"),
    },
    async (args) => {
      try {
        const base64 = await navigate(browser, args);
        return {
          content: [{ type: "image", data: base64, mimeType: "image/png" }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // --- set_viewport ---
  server.tool(
    "set_viewport",
    "Changes the browser viewport size and returns a screenshot at the new size.",
    {
      preset: z
        .enum(["mobile", "tablet", "desktop"])
        .optional()
        .describe("Viewport preset: mobile (375x812), tablet (768x1024), desktop (1280x720)"),
      width: z.number().optional().describe("Custom viewport width in pixels"),
      height: z.number().optional().describe("Custom viewport height in pixels"),
    },
    async (args) => {
      try {
        const base64 = await setViewport(browser, args);
        return {
          content: [{ type: "image", data: base64, mimeType: "image/png" }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // --- dom_inspect ---
  server.tool(
    "dom_inspect",
    "Gets the DOM structure and computed CSS for an element.",
    {
      selector: z.string().describe("CSS selector of the element to inspect"),
    },
    async (args) => {
      try {
        const result = await domInspect(browser, args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // --- visual_diff ---
  server.tool(
    "visual_diff",
    "Compares the current page to a previous baseline screenshot. On first call for a route, captures the baseline. On subsequent calls, returns a diff image highlighting changed pixels and a percentage of change.",
    {
      route: z.string().optional().describe("Navigate to this path first (e.g. '/dashboard'). Baselines are stored per route."),
    },
    async (args) => {
      try {
        const result = await visualDiff(browser, args);
        if (result.isBaseline) {
          return {
            content: [{ type: "text", text: "Baseline captured for this route. Call visual_diff again after making changes to see the diff." }],
          };
        }
        return {
          content: [
            { type: "text", text: `${result.percentChanged}% changed (${result.pixelsDifferent} of ${result.totalPixels} pixels differ)` },
            { type: "image", data: result.diffBase64!, mimeType: "image/png" },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // --- multi_route_screenshot ---
  server.tool(
    "multi_route_screenshot",
    "Screenshots multiple routes in one call. Useful for checking the entire app after a CSS or layout change.",
    {
      routes: z.array(z.string()).describe("Array of paths to screenshot (e.g. ['/', '/about', '/dashboard'])"),
    },
    async (args) => {
      try {
        const results = await multiRouteScreenshot(browser, args);
        const content: ({ type: "text"; text: string } | { type: "image"; data: string; mimeType: "image/png" })[] = [];
        for (const r of results) {
          content.push({ type: "text", text: `Route: ${r.route}` });
          content.push({ type: "image", data: r.base64, mimeType: "image/png" });
        }
        return { content };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  return server;
}
