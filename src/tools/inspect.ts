import { type BrowserManager } from "../browser.js";

export interface DomInspectResult {
  tagName: string;
  id: string;
  classes: string[];
  computedStyles: Record<string, string>;
  children: { tagName: string; id: string; classes: string[] }[];
  boundingBox: { x: number; y: number; width: number; height: number };
}

const STYLE_PROPERTIES = [
  "display",
  "position",
  "width",
  "height",
  "padding",
  "margin",
  "color",
  "backgroundColor",
  "fontSize",
  "fontWeight",
  "flexDirection",
  "justifyContent",
  "alignItems",
  "gap",
  "border",
  "borderRadius",
  "overflow",
  "opacity",
];

export async function domInspect(
  browser: BrowserManager,
  args: { selector: string }
): Promise<DomInspectResult> {
  const page = await browser.getPage();

  const handle = await page.waitForSelector(args.selector, { timeout: 5000 });
  if (!handle) {
    throw new Error(`Element not found: ${args.selector}`);
  }

  const result = await page.evaluate(
    (selector: string, styleProps: string[]) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`Element not found: ${selector}`);

      const computed = window.getComputedStyle(el);
      const styles: Record<string, string> = {};
      for (const prop of styleProps) {
        styles[prop] = computed.getPropertyValue(
          prop.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())
        );
      }

      const rect = el.getBoundingClientRect();

      const children = Array.from(el.children).map((child) => ({
        tagName: child.tagName.toLowerCase(),
        id: child.id,
        classes: Array.from(child.classList),
      }));

      return {
        tagName: el.tagName.toLowerCase(),
        id: el.id,
        classes: Array.from(el.classList),
        computedStyles: styles,
        children,
        boundingBox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    },
    args.selector,
    STYLE_PROPERTIES
  );

  return result;
}

export interface PageInfo {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  scrollPosition: { x: number; y: number };
  documentSize: { width: number; height: number };
}

export async function getPageInfo(browser: BrowserManager): Promise<PageInfo> {
  const page = await browser.getPage();

  const viewport = page.viewport();

  const { scrollX, scrollY, docWidth, docHeight } = await page.evaluate(() => ({
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    docWidth: document.documentElement.scrollWidth,
    docHeight: document.documentElement.scrollHeight,
  }));

  return {
    url: page.url(),
    title: await page.title(),
    viewport: { width: viewport?.width ?? 0, height: viewport?.height ?? 0 },
    scrollPosition: { x: Math.round(scrollX), y: Math.round(scrollY) },
    documentSize: { width: docWidth, height: docHeight },
  };
}
