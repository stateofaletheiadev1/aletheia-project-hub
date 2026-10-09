import { expect, test } from "@playwright/test";

// Security headers, honest health, robots, and rate limiting (brief §14, §18, §21).

test("security headers are set on pages", async ({ request }) => {
  const res = await request.get("/government");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("default-src 'self'");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["cross-origin-opener-policy"]).toBe("same-origin");
  expect(h["permissions-policy"]).toContain("camera=()");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("pages make no requests to other origins", async ({ page, baseURL }) => {
  const foreign: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(baseURL!) && !r.url().startsWith("data:")) foreign.push(r.url());
  });
  for (const route of ["/", "/government", "/image-credits"]) await page.goto(route, { waitUntil: "networkidle" });
  expect(foreign).toEqual([]);
});

test("health reports liveness and honest readiness", async ({ request }) => {
  const live = await request.get("/api/health");
  expect(live.status()).toBe(200);
  expect(await live.json()).toEqual({ status: "ok" });
  const ready = await request.get("/api/health/ready");
  const body = await ready.json();
  expect(body.status).toBe("degraded");
  expect(body.checks.recordStore).toBe("not_configured");
  expect(JSON.stringify(body)).not.toMatch(/stack|localhost|127\.0\.0\.1/);
});

test("security.txt is absent without a configured contact", async ({ request }) => {
  expect((await request.get("/.well-known/security.txt")).status()).toBe(404);
});

test("non-production builds are not indexed", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/\s*$/m);
});

test("search queries are rate-limited per client", async ({ request }) => {
  const ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
  const headers = { "x-forwarded-for": ip };
  for (let i = 0; i < 60; i++) {
    const res = await request.get(`/search?q=t${i}`, { headers });
    expect(res.status(), `request ${i + 1}`).toBe(200);
  }
  const limited = await request.get("/search?q=over", { headers });
  expect(limited.status()).toBe(429);
  expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
  // Another client is unaffected.
  expect((await request.get("/search?q=ok", { headers: { "x-forwarded-for": "203.0.113.9" } })).status()).toBe(200);
});

test("search escapes what it echoes back", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent('<img src=x onerror="window.__xss=1">')}`);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await expect(page.getByText(/Nothing matches/)).toBeVisible();
});
