/**
 * 第 369 轮：账号注销后会话吊销 ——
 * 删除账号写入墓碑 sm:revoked:<email>（TTL 30 天），旧 JWT 命中墓碑即 401 并清 cookie；
 * memory 降级未放行时删除 503 fail closed 且不写墓碑。
 */
import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest, revokedSessionKey } from "../../../edge-functions/api/[[default]].js";

interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[] }>;
}

function mapKv(): KvLike & { store: Map<string, string>; ttls: Map<string, number | undefined> } {
  const store = new Map<string, string>();
  const ttls = new Map<string, number | undefined>();
  return {
    store,
    ttls,
    async get(k) {
      return store.get(k) ?? null;
    },
    async put(k, v, options) {
      store.set(k, String(v));
      ttls.set(k, options?.expirationTtl);
    },
    async delete(k) {
      store.delete(k);
    },
    async list({ prefix = "", limit = 1000 } = {}) {
      return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).slice(0, limit).map((name) => ({ name })) };
    },
  };
}

const ORIGIN = "https://www.seatmark.cn";
const IP = "203.0.113.42";

async function solvedCaptcha(env: Record<string, unknown>) {
  const res = (await onRequest({
    request: new Request(`${ORIGIN}/api/auth/captcha`, { method: "GET", headers: { "EO-Connecting-IP": IP } }),
    env,
  })) as Response;
  const data = (await res.json()) as { image: string; token: string };
  const svg = Buffer.from(data.image.replace(/^data:image\/svg\+xml;base64,/, ""), "base64").toString("utf-8");
  const answer = [...svg.matchAll(/<text [^>]*>([^<])<\/text>/g)].map((m) => m[1]).join("");
  return { captchaToken: data.token, captchaAnswer: answer };
}

async function call(
  env: Record<string, unknown>,
  method: string,
  path: string,
  { body, cookie }: { body?: Record<string, unknown>; cookie?: string } = {},
) {
  const headers = new Headers({ "EO-Connecting-IP": IP });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (cookie) headers.set("Cookie", cookie);
  const request = new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (await onRequest({ request, env })) as Response;
}

async function register(env: Record<string, unknown>, email: string) {
  const res = await call(env, "POST", "/api/auth/register", {
    body: { email, password: "Passw0rd!xyz", ...(await solvedCaptcha(env)) },
  });
  expect(res.status).toBe(200);
  const cookie = (res.headers.get("Set-Cookie") || "").split(";")[0];
  expect(cookie).toMatch(/^sm_session=.+/);
  return cookie;
}

function kvEnv(kv: KvLike) {
  return { DEV: "1", AUTH_SECRET: "test-secret", seatmark_kv: kv };
}

describe("账号注销后旧会话吊销（tombstone）", () => {
  it("删除账号写入 sm:revoked:<email>（TTL 30 天、值为删除时间戳）；旧 JWT 调 quota/consume 与 account/templates 均 401 并清 cookie", async () => {
    const kv = mapKv();
    const env = kvEnv(kv);
    const email = "gone@example.com";
    const cookie = await register(env, email);

    const before = Date.now();
    const del = await call(env, "POST", "/api/account/delete", { cookie });
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ ok: true });
    expect(del.headers.get("Set-Cookie")).toContain("Max-Age=0");

    const key = revokedSessionKey(email) as string;
    expect(key).toBe(`sm:revoked:${email}`);
    const deletedAt = Number(kv.store.get(key));
    expect(deletedAt).toBeGreaterThanOrEqual(before);
    expect(deletedAt).toBeLessThanOrEqual(Date.now());
    expect(kv.ttls.get(key)).toBe(30 * 24 * 3600);
    expect(kv.store.has(`user:${email}`)).toBe(false);

    const consume = await call(env, "POST", "/api/quota/consume", { cookie, body: {} });
    expect(consume.status).toBe(401);
    expect(await consume.json()).toEqual({ error: "登录已失效，请重新登录" });
    expect(consume.headers.get("Set-Cookie")).toMatch(/^sm_session=; .*Max-Age=0/);

    const templatesGet = await call(env, "GET", "/api/account/templates", { cookie });
    expect(templatesGet.status).toBe(401);
    expect(templatesGet.headers.get("Set-Cookie")).toMatch(/Max-Age=0/);

    const templatesPut = await call(env, "PUT", "/api/account/templates", { cookie, body: { templates: [] } });
    expect(templatesPut.status).toBe(401);
    expect(templatesPut.headers.get("Set-Cookie")).toMatch(/Max-Age=0/);

    // /api/auth/me 按匿名口径返回 user:null 并清 cookie，前端据此清本地登录标记
    const me = await call(env, "GET", "/api/auth/me", { cookie });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ user: null });
    expect(me.headers.get("Set-Cookie")).toMatch(/Max-Age=0/);
  }, 30_000);

  it("未注销用户不受影响；注销后重新注册签发的新会话不被旧墓碑误伤", async () => {
    const kv = mapKv();
    const env = kvEnv(kv);
    const victim = "victim@example.com";
    const bystander = "stay@example.com";
    const victimCookie = await register(env, victim);
    const bystanderCookie = await register(env, bystander);

    expect((await call(env, "POST", "/api/account/delete", { cookie: victimCookie })).status).toBe(200);
    expect(kv.store.has(revokedSessionKey(victim) as string)).toBe(true);
    expect(kv.store.has(revokedSessionKey(bystander) as string)).toBe(false);

    const meStay = await call(env, "GET", "/api/auth/me", { cookie: bystanderCookie });
    expect(meStay.status).toBe(200);
    expect(((await meStay.json()) as { user: { email: string } }).user.email).toBe(bystander);
    expect((await call(env, "GET", "/api/account/templates", { cookie: bystanderCookie })).status).toBe(200);

    // JWT iat 为秒级：等到下一秒再重新注册，使新会话 iat 晚于删除时刻
    const deletedAt = Number(kv.store.get(revokedSessionKey(victim) as string));
    await new Promise((r) => setTimeout(r, 1000 - (deletedAt % 1000) + 5));
    const freshCookie = await register(env, victim);
    expect(freshCookie).not.toBe(victimCookie);
    const meFresh = await call(env, "GET", "/api/auth/me", { cookie: freshCookie });
    expect(((await meFresh.json()) as { user: { email: string } }).user.email).toBe(victim);
    expect((await call(env, "GET", "/api/account/templates", { cookie: freshCookie })).status).toBe(200);
    // 旧会话仍被拒绝
    expect((await call(env, "GET", "/api/account/templates", { cookie: victimCookie })).status).toBe(401);
  }, 30_000);

  it("存储降级 memory 且未放行 → 删除 503 storage_unavailable，不写墓碑、不删数据", async () => {
    const kv = mapKv();
    const allowed = { DEV: "1", AUTH_SECRET: "test-secret", SEATMARK_ALLOW_MEMORY_STORAGE: "1", seatmark_kv: kv };
    const email = "memory@example.com";
    const cookie = await register(allowed, email);

    // 同一 JWT 密钥、无 KV 绑定 → 存储降级 memory；未放行时按 fail closed 拒绝删除
    const degraded = { DEV: "1", AUTH_SECRET: "test-secret", SEATMARK_ALLOW_MEMORY_STORAGE: "" };
    const del = await call(degraded, "POST", "/api/account/delete", { cookie });
    expect(del.status).toBe(503);
    expect(await del.json()).toEqual({ error: "storage_unavailable" });
    expect(del.headers.get("Set-Cookie")).toBeNull();

    // 任何后端都没有写入墓碑：KV 无键，且原会话在 KV 后端仍有效
    expect(kv.store.has(revokedSessionKey(email) as string)).toBe(false);
    expect(kv.store.has(`user:${email}`)).toBe(true);
    const me = await call(allowed, "GET", "/api/auth/me", { cookie });
    expect(((await me.json()) as { user: { email: string } }).user.email).toBe(email);
  }, 30_000);

  it("AUTH_SECRET 缺失仍 fail closed：删除与带旧 cookie 的配额扣减均 503", async () => {
    const kv = mapKv();
    const noSecret = { seatmark_kv: kv, SEATMARK_ALLOW_MEMORY_STORAGE: "" };
    const del = await call(noSecret, "POST", "/api/account/delete", { cookie: "sm_session=stale" });
    expect(del.status).toBe(503);
    expect(await del.json()).toEqual({ error: "auth_secret_missing" });
    const consume = await call(noSecret, "POST", "/api/quota/consume", { cookie: "sm_session=stale", body: {} });
    expect(consume.status).toBe(503);
  });
});
