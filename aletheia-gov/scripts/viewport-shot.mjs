import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 1440), height: Number(process.env.H || 900) } });
await page.goto(process.argv[2], { waitUntil: "networkidle" });
await page.waitForTimeout(Number(process.env.WAIT || 3000));
if (process.env.SCROLL) { await page.mouse.wheel(0, Number(process.env.SCROLL)); await page.waitForTimeout(1500); }
await page.screenshot({ path: process.argv[3] });
await browser.close();
