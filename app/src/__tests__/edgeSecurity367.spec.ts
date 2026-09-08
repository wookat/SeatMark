/**
 * 第 367 轮：边缘函数四小项安全加固 ——
 * Permissions-Policy 响应头、/api/auth/captcha IP 日限 300、分享短码 CSPRNG + 撞码重试、PBKDF2 600k。
 */
import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { CAPTCHA_IP_DAILY_LIMIT, onRequest, shareCodeFor } from "../../../edge-functions/api/[[default]].js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { withSecurityHeaders } from "../../../edge-functions/api/_security.js";

const PERMISSIONS_POLICY = "geolocation=(), microphone=(), camera=(), payment=(), usb=()";

interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

function mapKv(store = new Map<string, string>()): KvLike & { store: Map<string, string> } {
  return {
    store,
    async get(k) {
      return store.get(k) ?? null;
    },
    async put(k, v) {
      store.set(k, String(v));
    },
    async delete(k) {
      store.delete(k);
    },
  };
}

async function getCaptcha(env: Record<string, unknown>, ip: string) {
  const request = new Request("https://www.seatmark.cn/api/auth/captcha", {
    method: "GET",
    // 限频只信任 EdgeOne 注入的 EO-Connecting-IP（X-Forwarded-For 可伪造，不再参与分桶）
    headers: { "EO-Connecting-IP": ip },
  });
  return (await onRequest({ request, env })) as Response;
}

describe("(a) Permissions-Policy 响应头", () => {
  it("withSecurityHeaders 与 API 真实响应均带 Permissions-Policy（与 edgeone.json 一致）", async () => {
    const res = withSecurityHeaders(new Response("{}", { status: 200 })) as Response;
    expect(res.headers.get("Permissions-Policy")).toBe(PERMISSIONS_POLICY);

    const env = { SEATMARK_ALLOW_MEMORY_STORAGE: "1", DEV: "1", AUTH_SECRET: "test-secret", seatmark_kv: mapKv() };
    const health = (await onRequest({
      request: new Request("https://www.seatmark.cn/api/admin/health", { method: "GET" }),
      env,
    })) as Response;
    expect(health.headers.get("Permissions-Policy")).toBe(PERMISSIONS_POLICY);
    expect(health.headers.get("X-SeatMark-Rev")).toBe("r367");

    const captcha = await getCaptcha(env, "203.0.113.9");
    expect(captcha.status).toBe(200);
    expect(captcha.headers.get("Permissions-Policy")).toBe(PERMISSIONS_POLICY);
  });
});

describe("(b) GET /api/auth/captcha IP 日限", () => {
  it(`同 IP 第 ${CAPTCHA_IP_DAILY_LIMIT + 1} 次返回 429，换 IP 不受影响；计数键按 rl:captcha:<sha256(ip)>:<日期> 分桶`, async () => {
    const kv = mapKv();
    const env = { DEV: "1", AUTH_SECRET: "test-secret", seatmark_kv: kv };
    for (let i = 0; i < CAPTCHA_IP_DAILY_LIMIT; i++) {
      const res = await getCaptcha(env, "198.51.100.7");
      expect(res.status).toBe(200);
    }
    const limited = await getCaptcha(env, "198.51.100.7");
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "请求过于频繁，请明天再试" });

    const rlKeys = [...kv.store.keys()].filter((k) => k.startsWith("rl:captcha:"));
    expect(rlKeys).toHaveLength(1);
    expect(rlKeys[0]).toMatch(/^rl:captcha:[0-9a-f]{64}:\d{4}-\d{2}-\d{2}$/);
    expect(kv.store.get(rlKeys[0]!)).toBe(String(CAPTCHA_IP_DAILY_LIMIT));

    const other = await getCaptcha(env, "198.51.100.8");
    expect(other.status).toBe(200);
  });

  it("存储降级 memory（已放行）时限频同样生效，不因无 KV 而放宽；AUTH_SECRET 缺失仍 503 fail closed", async () => {
    const env = { DEV: "1", AUTH_SECRET: "test-secret", SEATMARK_ALLOW_MEMORY_STORAGE: "1" };
    let status = 0;
    for (let i = 0; i <= CAPTCHA_IP_DAILY_LIMIT; i++) {
      status = (await getCaptcha(env, "198.51.100.9")).status;
      if (status === 429) break;
    }
    expect(status).toBe(429);

    const noSecret = await getCaptcha({ SEATMARK_ALLOW_MEMORY_STORAGE: "" }, "198.51.100.10");
    expect(noSecret.status).toBe(503);
    expect(await noSecret.json()).toEqual({ error: "auth_secret_missing" });
  });
});

describe("(c) shareCodeFor：CSPRNG 短码 + 撞码重试", () => {
  it("新用户得到 8 位 hex 短码并写入 owner/code 两条映射；再次调用返回同一短码", async () => {
    const kv = mapKv();
    const code: string = await shareCodeFor(kv, "a@example.com");
    expect(code).toMatch(/^[0-9a-f]{8}$/);
    expect(kv.store.get("share:owner:a@example.com")).toBe(code);
    expect(kv.store.get(`share:code:${code}`)).toBe("a@example.com");
    expect(await shareCodeFor(kv, "a@example.com")).toBe(code);
  });

  it("前两次候选码被他人占用 → 第三次落库，且未覆写他人映射", async () => {
    const kv = mapKv();
    const checked: string[] = [];
    const probing: KvLike = {
      ...kv,
      async get(k) {
        if (k.startsWith("share:code:")) {
          checked.push(k);
          if (checked.length <= 2) return "other@example.com";
        }
        return kv.get(k);
      },
    };
    const code: string = await shareCodeFor(probing, "b@example.com");
    expect(checked).toHaveLength(3);
    expect(code).toMatch(/^[0-9a-f]{8}$/);
    expect(`share:code:${code}`).toBe(checked[2]);
    expect(kv.store.get(`share:code:${code}`)).toBe("b@example.com");
    expect(kv.store.get("share:owner:b@example.com")).toBe(code);
  });

  it("连续 5 次都冲突 → 抛错 fail closed，不写任何映射", async () => {
    const kv = mapKv();
    let probes = 0;
    const alwaysTaken: KvLike = {
      ...kv,
      async get(k) {
        if (k.startsWith("share:code:")) {
          probes++;
          return "other@example.com";
        }
        return kv.get(k);
      },
    };
    await expect(shareCodeFor(alwaysTaken, "c@example.com")).rejects.toThrow(/collision/);
    expect(probes).toBe(5);
    expect(kv.store.size).toBe(0);
  });

  it("两个用户各自拿到不同短码（CSPRNG 随机而非邮箱+时间哈希）", async () => {
    const kv = mapKv();
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) codes.add(await shareCodeFor(kv, `u${i}@example.com`));
    expect(codes.size).toBe(20);
  });
});

describe("(d) PBKDF2 600k", () => {
  const b64url = (bytes: Uint8Array) =>
    Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  async function legacyHash(password: string, iterations: number) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
      "deriveBits",
    ]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
    return `pbkdf2$${iterations}$${b64url(salt)}$${b64url(new Uint8Array(bits))}`;
  }

  async function solvedCaptcha(env: Record<string, unknown>) {
    const res = await getCaptcha(env, "192.0.2.1");
    const data = (await res.json()) as { image: string; token: string };
    const svg = Buffer.from(data.image.replace(/^data:image\/svg\+xml;base64,/, ""), "base64").toString("utf-8");
    const answer = [...svg.matchAll(/<text [^>]*>([^<])<\/text>/g)].map((m) => m[1]).join("");
    return { captchaToken: data.token, captchaAnswer: answer };
  }

  async function post(env: Record<string, unknown>, path: string, body: Record<string, unknown>) {
    const request = new Request(`https://www.seatmark.cn${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "EO-Connecting-IP": "192.0.2.1" },
      body: JSON.stringify({ ...body, ...(await solvedCaptcha(env)) }),
    });
    return (await onRequest({ request, env })) as Response;
  }

  it("注册写入 pbkdf2$600000$… 且能登录（往返）；存量 100000 迭代哈希仍可登录", async () => {
    const kv = mapKv();
    const env = { DEV: "1", AUTH_SECRET: "test-secret", seatmark_kv: kv };
    const email = "pbkdf@example.com";
    const reg = await post(env, "/api/auth/register", { email, password: "Passw0rd!xyz" });
    expect(reg.status).toBe(200);
    const stored = JSON.parse(kv.store.get(`user:${email}`)!) as { passwordHash: string };
    expect(stored.passwordHash.startsWith("pbkdf2$600000$")).toBe(true);

    const login = await post(env, "/api/auth/login", { email, password: "Passw0rd!xyz" });
    expect(login.status).toBe(200);
    const bad = await post(env, "/api/auth/login", { email, password: "wrong-password" });
    expect(bad.status).toBe(401);

    const legacyEmail = "legacy@example.com";
    kv.store.set(
      `user:${legacyEmail}`,
      JSON.stringify({ email: legacyEmail, passwordHash: await legacyHash("OldPassw0rd!", 100000), createdAt: 1 }),
    );
    const legacyLogin = await post(env, "/api/auth/login", { email: legacyEmail, password: "OldPassw0rd!" });
    expect(legacyLogin.status).toBe(200);
  }, 30_000);
});
