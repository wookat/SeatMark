/**
 * edge-functions/api/[[default]].js 的桩测试：
 * 直接调用 onRequest（内存 KV 降级），覆盖本轮新增的
 * devCode 环境限制与 /api/admin/health 健康检查。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { ANNOUNCEMENT_CACHE_CONTROL, MEMORY_UNSAFE_ROUTES, RESERVE_ARCHIVE_TTL_SECONDS, getSecret, mapConcurrent, onRequest } from "../../../edge-functions/api/[[default]].js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { SEATMARK_REV } from "../../../edge-functions/api/_rev.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { getStorage, listAllKeys, unwrapTtl } from "../../../edge-functions/api/_storage.js";

const EDGE_DEFAULT_PATH = resolve(process.cwd(), "../edge-functions/api/[[default]].js");

interface Env {
  AUTH_SECRET?: string;
  ADMIN_EMAILS?: string;
  RESEND_API_KEY?: string;
  DEV?: string;
  /** '1' 放行内存存储；未放行时持久化写入路由 fail closed 503 */
  SEATMARK_ALLOW_MEMORY_STORAGE?: string;
  seatmark_blob?: MockBlobStore;
}

/** 测试默认走内存 KV 降级，需显式放行；用例可以传 '' 覆盖以验证 fail closed */
/** 与 app/scripts/devApi.mjs 的本地联调 env 对齐：放行内存存储 + DEV 门控 devCode 回显 */
function withTestEnv(env: Env): Env {
  return { SEATMARK_ALLOW_MEMORY_STORAGE: "1", DEV: "1", ...env };
}

/** 与 @edgeone/pages-blob Store 同接口子集的内存模拟 */
interface MockBlobStore {
  get(key: string, options?: { consistency?: string }): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
    paginate?: boolean;
    consistency?: string;
  }): Promise<{
    blobs: { key: string; etag: string }[];
    directories: string[];
    cursor?: string;
  }>;
}

function createMockBlobStore(): MockBlobStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(key) {
      return data.has(key) ? (data.get(key) as string) : null;
    },
    async set(key, value) {
      data.set(key, String(value));
    },
    async delete(key) {
      data.delete(key);
    },
    async list({ prefix = "", limit = 1000, cursor = "" } = {}) {
      const keys = [...data.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? keys.indexOf(cursor) + 1 : 0;
      const page = keys.slice(start, start + limit);
      const hasMore = start + limit < keys.length;
      return {
        blobs: page.map((key) => ({ key, etag: "" })),
        directories: [],
        ...(hasMore && page.length ? { cursor: page[page.length - 1] } : {}),
      };
    },
  };
}

/** 获取并解答一张图片验证码（从 SVG 文本节点还原字符），供注册/登录/重置密码请求携带 */
async function solvedCaptcha(env: Env = {}) {
  const request = new Request("https://www.seatmark.cn/api/auth/captcha", {
    method: "GET",
  });
  const response: Response = await onRequest({
    request,
    env: withTestEnv(env),
  });
  const data = (await response.json()) as { image: string; token: string };
  const b64 = data.image.replace(/^data:image\/svg\+xml;base64,/, "");
  const svg = Buffer.from(b64, "base64").toString("utf-8");
  const answer = [...svg.matchAll(/<text [^>]*>([^<])<\/text>/g)]
    .map((m) => m[1])
    .join("");
  if (answer.length !== 4) throw new Error(`无法解析验证码图片字符：${svg}`);
  // 混合大小写作答验证不区分大小写
  return { captchaToken: data.token, captchaAnswer: answer.toLowerCase() };
}

const CAPTCHA_PATHS = [
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/reset-code",
];

async function call(
  method: string,
  url: string,
  {
    body,
    env = {},
    cookie,
    headers: extraHeaders,
  }: {
    body?: unknown;
    env?: Env;
    cookie?: string;
    headers?: Record<string, string>;
  } = {},
) {
  // 需携带验证码的认证路径：未显式传入时自动解答并注入（各用例聚焦自身断言）
  if (
    body &&
    typeof body === "object" &&
    !("captchaToken" in (body as Record<string, unknown>)) &&
    CAPTCHA_PATHS.some((p) => url.includes(p))
  ) {
    body = {
      ...(body as Record<string, unknown>),
      ...(await solvedCaptcha(env)),
    };
  }
  const headers = new Headers(extraHeaders);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (cookie) headers.set("Cookie", cookie);
  const request = new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response: Response = await onRequest({
    request,
    env: withTestEnv(env),
  });
  return { response, data: (await response.json()) as Record<string, unknown> };
}

describe("存储降级 memory 时持久化写入路由 fail closed", () => {
  // 配上 AUTH_SECRET，隔离密钥缺失的 fail closed，单独验证存储降级分支
  const noAllow: Env = {
    SEATMARK_ALLOW_MEMORY_STORAGE: "",
    AUTH_SECRET: "test-secret",
  };

  it("memory 且未放行 → 验证码/注册/配额扣减/兑换/分享计次 均 503 storage_unavailable", async () => {
    const routes: [string, string, unknown][] = [
      ["POST", "/api/auth/code", { email: "fc@example.com" }],
      [
        "POST",
        "/api/auth/register",
        { email: "fc@example.com", password: "super-secret-1" },
      ],
      [
        "POST",
        "/api/auth/login",
        { email: "fc@example.com", password: "super-secret-1" },
      ],
      ["POST", "/api/quota/consume", {}],
      ["POST", "/api/redeem", { code: "SM-AAAA-BBBB-CCCC" }],
      ["POST", "/api/share/visit", { code: "deadbeef" }],
      ["POST", "/api/share/tpl", { payload: "v0.eyJhIjoxfQ" }],
    ];
    for (const [method, path, body] of routes) {
      const { response, data } = await call(
        method,
        `https://www.seatmark.cn${path}`,
        {
          body,
          env: noAllow,
        },
      );
      expect(response.status, path).toBe(503);
      expect(data.error, path).toBe("storage_unavailable");
      expect(response.headers.get("X-SeatMark-Storage")).toBe("memory");
    }
  });

  it("memory 且未放行 → 只读端点不变", async () => {
    const quota = await call("GET", "https://www.seatmark.cn/api/quota", {
      env: noAllow,
    });
    expect(quota.response.status).toBe(200);
    expect(quota.data.anonymous).toBe(true);
    const me = await call("GET", "https://www.seatmark.cn/api/auth/me", {
      env: noAllow,
    });
    expect(me.response.status).toBe(200);
    const ann = await call("GET", "https://www.seatmark.cn/api/announcement", {
      env: noAllow,
    });
    expect(ann.response.status).toBe(200);
  });

  it("memory 且放行 → 注册正常", async () => {
    const { response, data } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/register",
      {
        body: { email: "fc-allowed@example.com", password: "super-secret-1" },
        env: { SEATMARK_ALLOW_MEMORY_STORAGE: "1" },
      },
    );
    expect(response.status).toBe(200);
    expect((data.user as Record<string, unknown>).email).toBe(
      "fc-allowed@example.com",
    );
  });

  it("KV 已绑定时不受放行变量影响", async () => {
    const store = new Map<string, string>();
    const kv = {
      async get(key: string) {
        return store.has(key) ? (store.get(key) as string) : null;
      },
      async put(key: string, value: string) {
        store.set(key, String(value));
      },
      async delete(key: string) {
        store.delete(key);
      },
      async list() {
        return { keys: [], complete: true, cursor: "" };
      },
    };
    const { response } = await call(
      "POST",
      "https://www.seatmark.cn/api/share/tpl",
      {
        body: { payload: "v0.eyJhIjoxfQ" },
        env: {
          SEATMARK_ALLOW_MEMORY_STORAGE: "",
          AUTH_SECRET: "test-secret",
          seatmark_kv: kv,
        } as unknown as Env,
      },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("X-SeatMark-Storage")).toBe("kv");
  });
});

describe("AUTH_SECRET 缺失时 fail closed", () => {
  const noSecret: Env = { SEATMARK_ALLOW_MEMORY_STORAGE: "" };

  it("生产未配 AUTH_SECRET → 会话/验证码/重置/配额均 503 auth_secret_missing", async () => {
    const routes: [string, string, unknown][] = [
      ["GET", "/api/auth/me", undefined],
      ["GET", "/api/auth/captcha", undefined],
      ["GET", "/api/quota", undefined],
      [
        "POST",
        "/api/auth/reset-password",
        { email: "ns@example.com", code: "000000", password: "x" },
      ],
      ["POST", "/api/quota/consume", {}],
    ];
    for (const [method, path, body] of routes) {
      const { response, data } = await call(
        method,
        `https://www.seatmark.cn${path}`,
        {
          body,
          env: noSecret,
        },
      );
      expect(response.status, path).toBe(503);
      expect(data.error, path).toBe("auth_secret_missing");
    }
  });

  it("无 AUTH_SECRET 且非 dev：getSecret 为 null（生产路径不再有兜底密钥字面量），/api/auth/captcha 503", async () => {
    expect(getSecret({})).toBeNull();
    expect(getSecret({ SEATMARK_ALLOW_MEMORY_STORAGE: "" })).toBeNull();
    expect(getSecret({ DEV: "1" })).toBeNull();
    expect(getSecret({ AUTH_SECRET: "prod-secret" })).toBe("prod-secret");
    expect(typeof getSecret({ SEATMARK_ALLOW_MEMORY_STORAGE: "1" })).toBe("string");
    const { response, data } = await call(
      "GET",
      "https://www.seatmark.cn/api/auth/captcha",
      { env: noSecret },
    );
    expect(response.status).toBe(503);
    expect(data.error).toBe("auth_secret_missing");
  });

  it("公开公告与健康检查仍可响应，健康检查只报告密钥缺口", async () => {
    const ann = await call("GET", "https://www.seatmark.cn/api/announcement", {
      env: noSecret,
    });
    expect(ann.response.status).toBe(200);
    // 第 354 轮：公告随附账号服务可用性，首页等匿名页面不额外探测也能收起「注册送 7 天」
    expect(ann.data.authService).toBe("auth_secret_missing");
    const health = await call(
      "GET",
      "https://www.seatmark.cn/api/admin/health",
      { env: noSecret },
    );
    expect(health.response.status).toBe(503);
    expect(health.data.code).toBe("auth_secret_missing");
    expect(health.data.authSecretConfigured).toBe(false);
    expect(health.data.storage).toBeUndefined();
  });

  it("第 352 轮：HEAD /api/announcement 与 GET 同等放行 → 200 无 body、同 Cache-Control / X-SeatMark-Rev", async () => {
    const head: Response = await onRequest({
      request: new Request("https://www.seatmark.cn/api/announcement", { method: "HEAD" }),
      env: withTestEnv(noSecret),
    });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect(head.headers.get("Cache-Control")).toBe(ANNOUNCEMENT_CACHE_CONTROL);
    expect(head.headers.get("X-SeatMark-Rev")).toBe(SEATMARK_REV);
    const get: Response = await onRequest({
      request: new Request("https://www.seatmark.cn/api/announcement", { method: "GET" }),
      env: withTestEnv(noSecret),
    });
    expect(get.status).toBe(200);
    expect(head.headers.get("Cache-Control")).toBe(get.headers.get("Cache-Control"));
    expect(head.headers.get("X-SeatMark-Rev")).toBe(get.headers.get("X-SeatMark-Rev"));
    expect(head.headers.get("Content-Type")).toBe(get.headers.get("Content-Type"));
  });

  it("第 352 轮：无 AUTH_SECRET 时 POST /api/announcement 与 GET /api/auth/* 仍 503 auth_secret_missing", async () => {
    const post = await call("POST", "https://www.seatmark.cn/api/announcement", {
      body: {},
      env: noSecret,
    });
    expect(post.response.status).toBe(503);
    expect(post.data.error).toBe("auth_secret_missing");
    for (const path of ["/api/auth/me", "/api/auth/captcha"]) {
      const { response, data } = await call("GET", `https://www.seatmark.cn${path}`, { env: noSecret });
      expect(response.status, path).toBe(503);
      expect(data.error, path).toBe("auth_secret_missing");
    }
    const headAuth: Response = await onRequest({
      request: new Request("https://www.seatmark.cn/api/auth/me", { method: "HEAD" }),
      env: withTestEnv(noSecret),
    });
    expect(headAuth.status).toBe(503);
  });

  it("本地 dev / 测试放行时回退开发默认密钥", async () => {
    const { response } = await call(
      "GET",
      "https://www.seatmark.cn/api/auth/me",
      {
        env: { SEATMARK_ALLOW_MEMORY_STORAGE: "1" },
      },
    );
    expect(response.status).toBe(200);
  });
});

describe("/api/auth/code devCode 环境限制", () => {
  it("本地开发（env.DEV）未配邮件时返回 devCode", async () => {
    const { response, data } = await call(
      "POST",
      "http://localhost:5173/api/auth/code",
      {
        body: { email: "dev-user@example.com" },
      },
    );
    expect(response.status).toBe(200);
    expect(data.delivery).toBe("stub");
    expect(String(data.devCode)).toMatch(/^\d{6}$/);
  });

  it("生产域名未配邮件时不返回 devCode，报明确错误", async () => {
    const { response, data } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/code",
      {
        body: { email: "prod-user@example.com" },
        env: { DEV: "" },
      },
    );
    expect(response.status).toBe(503);
    expect(data.devCode).toBeUndefined();
    expect(data.error).toBe("邮件服务未配置，请联系管理员");
  });

  it("仅伪造 Host 为 localhost（无 env.DEV）不返回 devCode", async () => {
    for (const host of ["localhost:5173", "127.0.0.1", "[::1]"]) {
      const { response, data } = await call(
        "POST",
        `http://${host}/api/auth/code`,
        {
          body: { email: `spoof-${host.replace(/[^a-z0-9]/gi, "")}@example.com` },
          env: { DEV: "" },
        },
      );
      expect(response.status).toBe(503);
      expect(data.devCode).toBeUndefined();
    }
  });

  it("重置码通道同样只受 env.DEV 门控（伪造 localhost Host 不回显）", async () => {
    const email = "spoof-reset@example.com";
    await call("POST", "https://www.seatmark.cn/api/auth/register", {
      body: { email, password: "spoof-reset-pass-1" },
    });
    const { response, data } = await call(
      "POST",
      "http://localhost:5173/api/auth/reset-code",
      { body: { email }, env: { DEV: "" } },
    );
    expect(response.status).toBe(503);
    expect(data.devCode).toBeUndefined();
  });

  it("生产域名但显式设置 DEV 环境变量时仍可联调", async () => {
    const { response, data } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/code",
      {
        body: { email: "dev-flag@example.com" },
        env: { DEV: "1" },
      },
    );
    expect(response.status).toBe(200);
    expect(data.delivery).toBe("stub");
  });
});

describe("/api/auth/register 与 /api/auth/login 密码登录", () => {
  const EMAIL = "pw-user@example.com";
  const PASSWORD = "super-secret-1";

  it("注册成功即签发会话，/api/auth/me 可见用户", async () => {
    const { response, data } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/register",
      {
        body: { email: EMAIL, password: PASSWORD },
      },
    );
    expect(response.status).toBe(200);
    expect((data.user as Record<string, unknown>).email).toBe(EMAIL);
    const cookie = (response.headers.get("Set-Cookie") || "").split(";")[0];
    expect(cookie).toContain("sm_session=");

    const { data: meData } = await call(
      "GET",
      "https://www.seatmark.cn/api/auth/me",
      { cookie },
    );
    expect((meData.user as Record<string, unknown>).email).toBe(EMAIL);
  });

  it("重复注册返回 409", async () => {
    await call("POST", "https://www.seatmark.cn/api/auth/register", {
      body: { email: "dup@example.com", password: PASSWORD },
    });
    const { response, data } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/register",
      {
        body: { email: "dup@example.com", password: "another-pass-2" },
      },
    );
    expect(response.status).toBe(409);
    expect(data.error).toBe("该邮箱已注册，请直接登录");
  });

  it("密码过短返回 400", async () => {
    const { response } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/register",
      {
        body: { email: "short@example.com", password: "1234567" },
      },
    );
    expect(response.status).toBe(400);
  });

  it("正确密码登录成功，错误密码 401", async () => {
    await call("POST", "https://www.seatmark.cn/api/auth/register", {
      body: { email: "login@example.com", password: PASSWORD },
    });
    const { response: okRes, data: okData } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/login",
      { body: { email: "login@example.com", password: PASSWORD } },
    );
    expect(okRes.status).toBe(200);
    expect((okData.user as Record<string, unknown>).email).toBe(
      "login@example.com",
    );

    const { response: badRes, data: badData } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/login",
      { body: { email: "login@example.com", password: "wrong-password" } },
    );
    expect(badRes.status).toBe(401);
    expect(badData.error).toBe("邮箱或密码不正确");
  });

  it("未注册邮箱登录返回 401（不泄露账号是否存在）", async () => {
    const { response, data } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/login",
      {
        body: { email: "nobody@example.com", password: PASSWORD },
      },
    );
    expect(response.status).toBe(401);
    expect(data.error).toBe("邮箱或密码不正确");
  });

  it("历史验证码账号（无密码）可通过注册补设密码", async () => {
    // 先用 devCode 通道创建无密码账号
    const { data: codeData } = await call(
      "POST",
      "http://localhost:5173/api/auth/code",
      {
        body: { email: "legacy@example.com" },
      },
    );
    await call("POST", "http://localhost:5173/api/auth/verify", {
      body: { email: "legacy@example.com", code: codeData.devCode },
    });
    // 未设密码时直接登录：与密码错误同为 401 通用文案（不泄露账号状态）
    const { response: earlyRes, data: earlyData } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/login",
      {
        body: { email: "legacy@example.com", password: PASSWORD },
      },
    );
    expect(earlyRes.status).toBe(401);
    expect(earlyData.error).toBe("邮箱或密码不正确");
    // 注册补设密码
    const { response: regRes } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/register",
      {
        body: { email: "legacy@example.com", password: PASSWORD },
      },
    );
    expect(regRes.status).toBe(200);
    const { response: loginRes } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/login",
      {
        body: { email: "legacy@example.com", password: PASSWORD },
      },
    );
    expect(loginRes.status).toBe(200);
  });

  it("连续 10 次错密码后限流 429", async () => {
    await call("POST", "https://www.seatmark.cn/api/auth/register", {
      body: { email: "ratelimit@example.com", password: PASSWORD },
    });
    for (let i = 0; i < 10; i++) {
      await call("POST", "https://www.seatmark.cn/api/auth/login", {
        body: { email: "ratelimit@example.com", password: "wrong-password" },
      });
    }
    const { response, data } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/login",
      {
        body: { email: "ratelimit@example.com", password: PASSWORD },
      },
    );
    expect(response.status).toBe(429);
    expect(data.error).toBe("失败次数过多，请 15 分钟后再试");
  });
});

describe("表单验证码与找回密码", () => {
  const PASSWORD = "reset-secret-99";

  it("验证码答错时注册/登录被拒（400 + captcha 标记）", async () => {
    const cap = await solvedCaptcha();
    const wrong = { captchaToken: cap.captchaToken, captchaAnswer: "999" };
    const { response, data } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/register",
      {
        body: { email: "cap-wrong@example.com", password: PASSWORD, ...wrong },
      },
    );
    expect(response.status).toBe(400);
    expect(data.captcha).toBe(true);

    const { response: loginRes } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/login",
      {
        body: { email: "cap-wrong@example.com", password: PASSWORD, ...wrong },
      },
    );
    expect(loginRes.status).toBe(400);
  });

  it("缺验证码令牌时被拒", async () => {
    const { response } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/register",
      {
        body: {
          email: "cap-none@example.com",
          password: PASSWORD,
          captchaToken: "",
          captchaAnswer: "",
        },
      },
    );
    expect(response.status).toBe(400);
  });

  it("图形验证码恒为 4 位且字符全部落在 CAPTCHA_CHARSET（CSPRNG 取字）", async () => {
    const CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    for (let i = 0; i < 20; i++) {
      const cap = await solvedCaptcha();
      const answer = cap.captchaAnswer.toUpperCase();
      expect(answer).toHaveLength(4);
      for (const ch of answer) expect(CHARSET).toContain(ch);
    }
  });

  it("邮件验证码恒为 6 位数字（含首位 0 的情况，CSPRNG randomDigits）", async () => {
    // 内存 KV 全文件共享且按 IP 日限 20 次：循环次数留足余量给其余用例
    for (let i = 0; i < 5; i++) {
      const { response, data } = await call(
        "POST",
        "http://localhost:5173/api/auth/code",
        {
          body: { email: `digits-${i}@example.com` },
        },
      );
      expect(response.status).toBe(200);
      expect(String(data.devCode)).toMatch(/^\d{6}$/);
    }
  });

  it("同一 captcha token 第二次注册请求被拒 400「验证码已使用」", async () => {
    const cap = await solvedCaptcha();
    const first = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/register",
      {
        body: { email: "cap-once-a@example.com", password: PASSWORD, ...cap },
      },
    );
    expect(first.response.status).toBe(200);

    const second = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/register",
      {
        body: { email: "cap-once-b@example.com", password: PASSWORD, ...cap },
      },
    );
    expect(second.response.status).toBe(400);
    expect(second.data.captcha).toBe(true);
    expect(String(second.data.error)).toContain("验证码已使用");

    // 登录也不能复用同一令牌
    const login = await call("POST", "https://www.seatmark.cn/api/auth/login", {
      body: { email: "cap-once-a@example.com", password: PASSWORD, ...cap },
    });
    expect(login.response.status).toBe(400);
    expect(String(login.data.error)).toContain("验证码已使用");
  });

  it("密码错误也会消费 captcha：同一令牌再次登录被拒（前端需换题）", async () => {
    await call("POST", "https://www.seatmark.cn/api/auth/register", {
      body: { email: "cap-consume@example.com", password: PASSWORD },
    });
    const cap = await solvedCaptcha();
    const wrong = await call("POST", "https://www.seatmark.cn/api/auth/login", {
      body: {
        email: "cap-consume@example.com",
        password: "not-the-password",
        ...cap,
      },
    });
    expect(wrong.response.status).toBe(401);
    const retry = await call("POST", "https://www.seatmark.cn/api/auth/login", {
      body: { email: "cap-consume@example.com", password: PASSWORD, ...cap },
    });
    expect(retry.response.status).toBe(400);
    expect(String(retry.data.error)).toContain("验证码已使用");
  });

  it("找回密码全链路：发码→验码设新密码→新密码可登录，旧密码失效", async () => {
    const email = "reset-user@example.com";
    await call("POST", "https://www.seatmark.cn/api/auth/register", {
      body: { email, password: PASSWORD },
    });
    // 本地开发未配邮件：重置码以 devCode 回显
    const { response: codeRes, data: codeData } = await call(
      "POST",
      "http://localhost:5173/api/auth/reset-code",
      { body: { email } },
    );
    expect(codeRes.status).toBe(200);
    expect(String(codeData.devCode)).toMatch(/^\d{6}$/);

    const newPassword = "brand-new-pass-7";
    const { response: resetRes, data: resetData } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/reset-password",
      { body: { email, code: codeData.devCode, password: newPassword } },
    );
    expect(resetRes.status).toBe(200);
    expect((resetData.user as Record<string, unknown>).email).toBe(email);
    expect(resetRes.headers.get("Set-Cookie")).toContain("sm_session=");

    const { response: oldRes } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/login",
      {
        body: { email, password: PASSWORD },
      },
    );
    expect(oldRes.status).toBe(401);
    const { response: newRes } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/login",
      {
        body: { email, password: newPassword },
      },
    );
    expect(newRes.status).toBe(200);
  });

  it("未注册邮箱发重置码同样返回 ok（防枚举）且不落码", async () => {
    const { response, data } = await call(
      "POST",
      "http://localhost:5173/api/auth/reset-code",
      { body: { email: "ghost@example.com" } },
    );
    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.devCode).toBeUndefined();

    const { response: resetRes } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/reset-password",
      {
        body: {
          email: "ghost@example.com",
          code: "123456",
          password: PASSWORD,
        },
      },
    );
    expect(resetRes.status).toBe(400);
  });

  it("重置码错误达上限后作废", async () => {
    const email = "reset-lock@example.com";
    await call("POST", "https://www.seatmark.cn/api/auth/register", {
      body: { email, password: PASSWORD },
    });
    const { data: codeData } = await call(
      "POST",
      "http://localhost:5173/api/auth/reset-code",
      {
        body: { email },
      },
    );
    for (let i = 0; i < 5; i++) {
      const wrongCode = codeData.devCode === "000000" ? "111111" : "000000";
      await call("POST", "https://www.seatmark.cn/api/auth/reset-password", {
        body: { email, code: wrongCode, password: PASSWORD },
      });
    }
    const { response } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/reset-password",
      {
        body: { email, code: codeData.devCode, password: PASSWORD },
      },
    );
    expect(response.status).toBe(429);
  });
});

describe("/api/admin/health", () => {
  const env: Env = {
    AUTH_SECRET: "test-secret",
    ADMIN_EMAILS: "admin@example.com",
  };

  it("未登录返回 401", async () => {
    const { response } = await call(
      "GET",
      "https://www.seatmark.cn/api/admin/health",
    );
    expect(response.status).toBe(401);
  });

  it("管理员登录后返回存储与配置状态", async () => {
    // 本地开发通道拿 devCode 登录
    const { data: codeData } = await call(
      "POST",
      "http://localhost:5173/api/auth/code",
      {
        body: { email: "admin@example.com" },
        env,
      },
    );
    const { response: verifyRes } = await call(
      "POST",
      "http://localhost:5173/api/auth/verify",
      {
        body: { email: "admin@example.com", code: codeData.devCode },
        env,
      },
    );
    expect(verifyRes.status).toBe(200);
    const cookie = (verifyRes.headers.get("Set-Cookie") || "").split(";")[0];

    const { response, data } = await call(
      "GET",
      "https://www.seatmark.cn/api/admin/health",
      {
        env,
        cookie,
      },
    );
    expect(response.status).toBe(200);
    expect(data).toEqual({
      kvBound: false,
      blobAvailable: false,
      storage: "memory",
      mailConfigured: false,
      mailChannel: "none",
      authSecretConfigured: true,
      ipHeaderSource: "none",
    });
  });

  it("健康检查报告客户端 IP 头来源但不输出 IP 值", async () => {
    const env: Env = { ADMIN_EMAILS: "admin@seatmark.cn" };
    const { data: codeData } = await call(
      "POST",
      "http://localhost:5173/api/auth/code",
      { body: { email: "admin@seatmark.cn" }, env },
    );
    const { response: verifyRes } = await call(
      "POST",
      "http://localhost:5173/api/auth/verify",
      { body: { email: "admin@seatmark.cn", code: codeData.devCode }, env },
    );
    const cookie = (verifyRes.headers.get("Set-Cookie") || "").split(";")[0];
    const fetchHealth = async (headers: Record<string, string>) => {
      const response: Response = await onRequest({
        request: new Request("https://www.seatmark.cn/api/admin/health", {
          headers: { Cookie: cookie, ...headers },
        }),
        env: withTestEnv(env),
      });
      const text = await response.text();
      return { text, data: JSON.parse(text) as Record<string, unknown> };
    };
    const eo = await fetchHealth({ "EO-Connecting-IP": "203.0.113.9", "X-Forwarded-For": "198.51.100.7" });
    expect(eo.data.ipHeaderSource).toBe("eo");
    expect(eo.text).not.toContain("203.0.113.9");
    const xff = await fetchHealth({ "X-Forwarded-For": "198.51.100.7, 10.0.0.1" });
    expect(xff.data.ipHeaderSource).toBe("xff");
    expect(xff.text).not.toContain("198.51.100.7");
    const none = await fetchHealth({});
    expect(none.data.ipHeaderSource).toBe("none");
  });

  it("非管理员返回 403", async () => {
    const { data: codeData } = await call(
      "POST",
      "http://localhost:5173/api/auth/code",
      {
        body: { email: "member@example.com" },
        env,
      },
    );
    const { response: verifyRes } = await call(
      "POST",
      "http://localhost:5173/api/auth/verify",
      {
        body: { email: "member@example.com", code: codeData.devCode },
        env,
      },
    );
    const cookie = (verifyRes.headers.get("Set-Cookie") || "").split(";")[0];
    const { response } = await call(
      "GET",
      "https://www.seatmark.cn/api/admin/health",
      {
        env,
        cookie,
      },
    );
    expect(response.status).toBe(403);
  });
});

describe("/api/share/tpl 存储防御", () => {
  const PAYLOAD = "v0.eyJhIjoxfQ";

  it("内存后备下短码写入/读取往返成功", async () => {
    const { response, data } = await call(
      "POST",
      "http://localhost:5173/api/share/tpl",
      {
        body: { payload: PAYLOAD },
      },
    );
    expect(response.status).toBe(200);
    expect(String(data.code)).toMatch(/^[0-9a-f]{10}$/);

    const { response: getRes, data: getData } = await call(
      "GET",
      `http://localhost:5173/api/share/tpl?code=${data.code}`,
    );
    expect(getRes.status).toBe(200);
    expect(getData.payload).toBe(PAYLOAD);
  });

  it("存储写入首次失败时防御重试成功，返回 200", async () => {
    let putCalls = 0;
    const flakyKv = {
      async get() {
        return null;
      },
      async put() {
        putCalls++;
        if (putCalls === 1) throw new Error("blob init timeout");
      },
      async delete() {},
    };
    const { response, data } = await call(
      "POST",
      "http://localhost:5173/api/share/tpl",
      {
        body: { payload: PAYLOAD },
        env: { seatmark_kv: flakyKv } as unknown as Env,
      },
    );
    expect(putCalls).toBe(2);
    expect(response.status).toBe(200);
    expect(String(data.code)).toMatch(/^[0-9a-f]{10}$/);
  });

  it("存储持续失败时返回结构化 503 而不是未捕获异常", async () => {
    const brokenKv = {
      async get() {
        throw new Error("storage down");
      },
      async put() {
        throw new Error("storage down");
      },
      async delete() {},
    };
    const env = { seatmark_kv: brokenKv } as unknown as Env;
    const { response } = await call(
      "POST",
      "http://localhost:5173/api/share/tpl",
      {
        body: { payload: PAYLOAD },
        env,
      },
    );
    expect(response.status).toBe(503);

    const { response: getRes } = await call(
      "GET",
      "http://localhost:5173/api/share/tpl?code=0123456789",
      { env },
    );
    expect(getRes.status).toBe(503);
  });

  it("顶层兜底：路由内部抛出异常时返回 JSON 500 而不是 545", async () => {
    const explodingKv = {
      get() {
        throw new Error("boom");
      },
      async put() {
        throw new Error("boom");
      },
      async delete() {},
    };
    // /api/auth/code 的 kv.get 无局部防御，异常应被顶层兜底捕获
    const { response, data } = await call(
      "POST",
      "http://localhost:5173/api/auth/code",
      {
        body: { email: "boom@example.com" },
        env: { seatmark_kv: explodingKv } as unknown as Env,
      },
    );
    expect(response.status).toBe(500);
    expect(data.error).toBe("服务暂时不可用，请稍后重试");
  });
});

describe("Blob 后备存储（KV 未绑定时）", () => {
  it("登录全链路走 Blob，响应头标记 blob", async () => {
    const blob = createMockBlobStore();
    const env: Env = { AUTH_SECRET: "test-secret", seatmark_blob: blob };
    const { response: codeRes, data: codeData } = await call(
      "POST",
      "http://localhost:5173/api/auth/code",
      { body: { email: "blob-user@example.com" }, env },
    );
    expect(codeRes.headers.get("X-SeatMark-Storage")).toBe("blob");
    expect(blob.data.has("code:blob-user@example.com")).toBe(true);

    const { response: verifyRes, data: verifyData } = await call(
      "POST",
      "http://localhost:5173/api/auth/verify",
      { body: { email: "blob-user@example.com", code: codeData.devCode }, env },
    );
    expect(verifyRes.status).toBe(200);
    expect((verifyData.user as Record<string, unknown>).email).toBe(
      "blob-user@example.com",
    );
    expect(blob.data.has("user:blob-user@example.com")).toBe(true);
  });

  it("云端模板优先存 Blob 并可回读", async () => {
    const blob = createMockBlobStore();
    const env: Env = { AUTH_SECRET: "test-secret", seatmark_blob: blob };
    const { data: codeData } = await call(
      "POST",
      "http://localhost:5173/api/auth/code",
      {
        body: { email: "tpl-user@example.com" },
        env,
      },
    );
    const { response: verifyRes } = await call(
      "POST",
      "http://localhost:5173/api/auth/verify",
      {
        body: { email: "tpl-user@example.com", code: codeData.devCode },
        env,
      },
    );
    const cookie = (verifyRes.headers.get("Set-Cookie") || "").split(";")[0];

    const templates = [{ id: "t1", name: "测试模板" }];
    const { response: putRes } = await call(
      "PUT",
      "http://localhost:5173/api/account/templates",
      {
        body: { templates },
        env,
        cookie,
      },
    );
    expect(putRes.status).toBe(200);
    expect(blob.data.get("tpl:tpl-user@example.com")).toBe(
      JSON.stringify(templates),
    );

    const { data: getData } = await call(
      "GET",
      "http://localhost:5173/api/account/templates",
      {
        env,
        cookie,
      },
    );
    expect(getData.templates).toEqual(templates);
  });

  it("管理员健康检查报告 Blob 可用", async () => {
    const blob = createMockBlobStore();
    const env: Env = {
      AUTH_SECRET: "test-secret",
      ADMIN_EMAILS: "blob-admin@example.com",
      seatmark_blob: blob,
    };
    const { data: codeData } = await call(
      "POST",
      "http://localhost:5173/api/auth/code",
      {
        body: { email: "blob-admin@example.com" },
        env,
      },
    );
    const { response: verifyRes } = await call(
      "POST",
      "http://localhost:5173/api/auth/verify",
      {
        body: { email: "blob-admin@example.com", code: codeData.devCode },
        env,
      },
    );
    const cookie = (verifyRes.headers.get("Set-Cookie") || "").split(";")[0];

    const { data } = await call(
      "GET",
      "https://www.seatmark.cn/api/admin/health",
      {
        env,
        cookie,
      },
    );
    expect(data.kvBound).toBe(false);
    expect(data.blobAvailable).toBe(true);
    expect(data.storage).toBe("blob");
  });
});

describe("请求体大小预检（413）", () => {
  it("Content-Length 超过 64KB 直接 413，不读取正文", async () => {
    const request = new Request("http://localhost:5173/api/share/tpl", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(65 * 1024),
      },
      body: JSON.stringify({ payload: "v0.abc" }),
    });
    const response: Response = await onRequest({
      request,
      env: withTestEnv({}),
    });
    expect(response.status).toBe(413);
    expect(((await response.json()) as { error: string }).error).toBe(
      "请求内容过长",
    );
    expect(response.headers.get("X-SeatMark-Rev")).toBe(SEATMARK_REV);
  });

  it("实际正文超过 64KB 返回 413（Content-Length 缺失/不实也拦得住）", async () => {
    const { response, data } = await call(
      "POST",
      "http://localhost:5173/api/share/tpl",
      { body: { payload: `v0.${"a".repeat(70 * 1024)}` } },
    );
    expect(response.status).toBe(413);
    expect(data.error).toBe("请求内容过长");
  });

  it("/api/account/templates 走 512KB 上限：100KB 模板体不被默认 64KB 拦截", async () => {
    // 未登录 → 401 而不是 413，说明大小预检放行了 100KB 正文
    const { response } = await call(
      "PUT",
      "http://localhost:5173/api/account/templates",
      { body: { templates: [{ blob: "x".repeat(100 * 1024) }] } },
    );
    expect(response.status).toBe(401);
  });
});

describe("IP 日限频（share/tpl 60 次、team/reserve 5 次）", () => {
  it("POST /api/team/reserve 同 IP 第 6 次返回 429", async () => {
    const kv = new Map<string, string>();
    const env = {
      seatmark_kv: {
        async get(k: string) {
          return kv.get(k) ?? null;
        },
        async put(k: string, v: string) {
          kv.set(k, v);
        },
        async delete(k: string) {
          kv.delete(k);
        },
      },
    } as unknown as Env;
    for (let i = 0; i < 5; i++) {
      const { response } = await call(
        "POST",
        "http://localhost:5173/api/team/reserve",
        { body: { email: `team-${i}@example.com`, teamSize: "10" }, env },
      );
      expect(response.status).toBe(200);
    }
    const { response, data } = await call(
      "POST",
      "http://localhost:5173/api/team/reserve",
      { body: { email: "team-6@example.com", teamSize: "10" }, env },
    );
    expect(response.status).toBe(429);
    expect(String(data.error)).toContain("请求过于频繁");
    const rlKeys = [...kv.keys()].filter((k) => k.startsWith("rl:reserve:"));
    expect(rlKeys).toHaveLength(1);
    expect(kv.get(rlKeys[0]!)).toBe("5");
  });

  it("POST /api/share/tpl 同 IP 第 61 次返回 429", async () => {
    const kv = new Map<string, string>();
    const env = {
      seatmark_kv: {
        async get(k: string) {
          return kv.get(k) ?? null;
        },
        async put(k: string, v: string) {
          kv.set(k, v);
        },
        async delete(k: string) {
          kv.delete(k);
        },
      },
    } as unknown as Env;
    for (let i = 0; i < 60; i++) {
      const { response } = await call(
        "POST",
        "http://localhost:5173/api/share/tpl",
        { body: { payload: `v0.p${i}` }, env },
      );
      expect(response.status).toBe(200);
    }
    const { response } = await call(
      "POST",
      "http://localhost:5173/api/share/tpl",
      { body: { payload: "v0.p61" }, env },
    );
    expect(response.status).toBe(429);
  });
});

describe("第 349 轮：发验证码每邮箱每日上限（rl:code:<sha256(email)>:<day>）", () => {
  function isolatedEnv() {
    const kv = new Map<string, string>();
    const env = {
      seatmark_kv: {
        async get(k: string) {
          return kv.get(k) ?? null;
        },
        async put(k: string, v: string) {
          kv.set(k, v);
        },
        async delete(k: string) {
          kv.delete(k);
        },
      },
    } as unknown as Env;
    return { kv, env };
  }

  /** 每次请求换一个出口 IP，并把时钟推进 61s 越过 60s 重发间隔，只留下邮箱日限一道闸 */
  async function sendCode(
    path: string,
    email: string,
    ipIndex: number,
    env: Env,
  ) {
    vi.setSystemTime(Date.now() + 61_000);
    return call("POST", `http://localhost:5173${path}`, {
      body: { email },
      env,
      headers: { "EO-Connecting-IP": `203.0.113.${ipIndex}` },
    });
  }

  beforeEach(() => {
    // 固定在 UTC 正午：用例内推进的十几分钟不会跨天，“次日重置”由用例自己推到次日
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-07T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("/api/auth/code 同一邮箱换 IP 连发：前 10 次 200，第 11 次 429 且错误码与 IP 超限一致", async () => {
    const { kv, env } = isolatedEnv();
    const email = "one-inbox@example.com";
    for (let i = 1; i <= 10; i++) {
      const { response } = await sendCode("/api/auth/code", email, i, env);
      expect(response.status).toBe(200);
    }
    const { response, data } = await sendCode("/api/auth/code", email, 11, env);
    expect(response.status).toBe(429);
    expect(data.code).toBe("code_daily_limit");
    expect(String(data.error)).toContain("请求过于频繁");
    // 邮箱计数键不含明文邮箱，且仅有当日一个
    const emailKeys = [...kv.keys()].filter((k) => k.startsWith("rl:code:"));
    expect(emailKeys).toHaveLength(1);
    expect(emailKeys[0]).toMatch(/^rl:code:[0-9a-f]{64}:2026-09-07$/);
    expect(emailKeys[0]).not.toContain("one-inbox");
    expect(kv.get(emailKeys[0]!)).toBe("10");
    // 换 IP 后每个 IP 只计 1 次，IP 日限仍未触发
    const ipKeys = [...kv.keys()].filter((k) => k.startsWith("rl:ip:"));
    expect(ipKeys).toHaveLength(10);
    for (const k of ipKeys) expect(kv.get(k)).toBe("1");
  });

  it("次日邮箱计数键重置，可继续发码", async () => {
    const { kv, env } = isolatedEnv();
    const email = "tomorrow@example.com";
    for (let i = 1; i <= 10; i++) {
      await sendCode("/api/auth/code", email, i, env);
    }
    expect((await sendCode("/api/auth/code", email, 11, env)).response.status).toBe(429);

    vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
    const { response } = await sendCode("/api/auth/code", email, 12, env);
    expect(response.status).toBe(200);
    const emailKeys = [...kv.keys()].filter((k) => k.startsWith("rl:code:"));
    expect(emailKeys.some((k) => k.endsWith(":2026-09-08"))).toBe(true);
    expect(kv.get(emailKeys.find((k) => k.endsWith(":2026-09-08"))!)).toBe("1");
  });

  it("/api/auth/reset-code 同受每邮箱日限，且与登录码共用同一计数（不泄露邮箱是否存在）", async () => {
    const { env } = isolatedEnv();
    // 未注册邮箱：防枚举路径同样计数，超限后与已注册邮箱返回相同 429
    const email = "ghost-reset@example.com";
    for (let i = 1; i <= 6; i++) {
      const { response } = await sendCode("/api/auth/reset-code", email, i, env);
      expect(response.status).toBe(200);
    }
    for (let i = 7; i <= 10; i++) {
      const { response } = await sendCode("/api/auth/code", email, i, env);
      expect(response.status).toBe(200);
    }
    const { response, data } = await sendCode("/api/auth/reset-code", email, 11, env);
    expect(response.status).toBe(429);
    expect(data.code).toBe("code_daily_limit");
  });

  it("IP 日限 20 次不回归：同 IP 换邮箱第 21 次 429，错误码与邮箱超限一致", async () => {
    const { env } = isolatedEnv();
    for (let i = 1; i <= 20; i++) {
      const { response } = await call("POST", "http://localhost:5173/api/auth/code", {
        body: { email: `ip-${i}@example.com` },
        env,
        headers: { "EO-Connecting-IP": "198.51.100.42" },
      });
      expect(response.status).toBe(200);
    }
    const { response, data } = await call("POST", "http://localhost:5173/api/auth/code", {
      body: { email: "ip-21@example.com" },
      env,
      headers: { "EO-Connecting-IP": "198.51.100.42" },
    });
    expect(response.status).toBe(429);
    expect(data.code).toBe("code_daily_limit");
  });

  it("60s 内同邮箱重发仍返回 429（间隔限频不回归）且不计入日限", async () => {
    const { kv, env } = isolatedEnv();
    const email = "resend@example.com";
    expect((await sendCode("/api/auth/code", email, 1, env)).response.status).toBe(200);
    const { response, data } = await call("POST", "http://localhost:5173/api/auth/code", {
      body: { email },
      env,
      headers: { "EO-Connecting-IP": "203.0.113.2" },
    });
    expect(response.status).toBe(429);
    expect(data.code).toBe("code_resend_too_soon");
    const emailKey = [...kv.keys()].find((k) => k.startsWith("rl:code:"))!;
    expect(kv.get(emailKey)).toBe("1");
  });
});

describe("captcha 消费标记移出关键路径", () => {
  const PASSWORD = "deferred-secret-7";

  it("usedKey 写入抛错时登录仍返回 200", async () => {
    const store = new Map<string, string>();
    const env = {
      seatmark_kv: {
        async get(k: string) {
          return store.get(k) ?? null;
        },
        async put(k: string, v: string) {
          if (k.startsWith("captcha:used:")) throw new Error("blob write 545");
          store.set(k, v);
        },
        async delete(k: string) {
          store.delete(k);
        },
      },
    } as unknown as Env;
    const reg = await call("POST", "https://www.seatmark.cn/api/auth/register", {
      body: { email: "deferred@example.com", password: PASSWORD },
      env,
    });
    expect(reg.response.status).toBe(200);
    const login = await call("POST", "https://www.seatmark.cn/api/auth/login", {
      body: { email: "deferred@example.com", password: PASSWORD },
      env,
    });
    expect(login.response.status).toBe(200);
    expect(login.data.ok).toBe(true);
    expect([...store.keys()].some((k) => k.startsWith("captcha:used:"))).toBe(false);
  });

  it("waitUntil 环境下同一 captcha token 第二次登录返回「验证码已使用」", async () => {
    await call("POST", "https://www.seatmark.cn/api/auth/login", {
      body: { email: "dup-cap@example.com", password: PASSWORD },
    });
    await call("POST", "https://www.seatmark.cn/api/auth/register", {
      body: { email: "dup-cap@example.com", password: PASSWORD },
    });
    const cap = await solvedCaptcha();
    const pending: Promise<unknown>[] = [];
    const context = {
      env: withTestEnv({}),
      waitUntil(p: Promise<unknown>) {
        pending.push(p);
      },
    };
    const mk = () =>
      new Request("https://www.seatmark.cn/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "dup-cap@example.com", password: PASSWORD, ...cap }),
      });
    const first: Response = await onRequest({ ...context, request: mk() });
    expect(first.status).toBe(200);
    // 后台写链完成后再复用令牌
    await Promise.all(pending);
    const second: Response = await onRequest({ ...context, request: mk() });
    expect(second.status).toBe(400);
    expect(((await second.json()) as { error: string }).error).toContain("验证码已使用");
  });
});

describe("Blob SDK 加载瞬时失败后可重试", () => {
  it("首次 getStore 抛错降级 memory（写路由 503），下一请求重试成功走 blob", async () => {
    vi.resetModules();
    const blob = createMockBlobStore();
    let calls = 0;
    vi.doMock("@edgeone/pages-blob", () => ({
      getStore() {
        calls++;
        if (calls === 1) throw new Error("transient import failure");
        return blob;
      },
    }));
    const mod = await vi.importActual<{
      onRequest: (ctx: unknown) => Promise<Response>;
    }>("../../../edge-functions/api/[[default]].js");
    const env: Env = { AUTH_SECRET: "test-secret" };
    const mk = () =>
      new Request("http://localhost:5173/api/share/tpl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: "v0.retry" }),
      });
    const first = await mod.onRequest({ request: mk(), env });
    expect(first.headers.get("X-SeatMark-Storage")).toBe("memory");
    expect(first.status).toBe(503);
    const second = await mod.onRequest({ request: mk(), env });
    expect(second.headers.get("X-SeatMark-Storage")).toBe("blob");
    expect(second.status).toBe(200);
    expect(calls).toBe(2);
    vi.doUnmock("@edgeone/pages-blob");
    vi.resetModules();
  });
});

describe("feedback.js 观测头 X-SeatMark-Rev", () => {
  it("405 非 POST 响应带 X-SeatMark-Rev", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore JS 模块无类型声明
    const { onRequest: onFeedback } = await import("../../../edge-functions/api/feedback.js");
    const response: Response = await onFeedback({
      request: new Request("http://localhost:5173/api/feedback", { method: "GET" }),
      env: withTestEnv({}),
    });
    expect(response.status).toBe(405);
    expect(response.headers.get("X-SeatMark-Rev")).toMatch(/^r\d+$/);
  });

  it("400 type 非法响应带 X-SeatMark-Rev", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore JS 模块无类型声明
    const { onRequest: onFeedback } = await import("../../../edge-functions/api/feedback.js");
    const response: Response = await onFeedback({
      request: new Request("http://localhost:5173/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "spam", content: "hello" }),
      }),
      env: withTestEnv({}),
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe("反馈类型无效");
    expect(response.headers.get("X-SeatMark-Rev")).toMatch(/^r\d+$/);
  });

  it("200 成功响应同时带 X-SeatMark-Rev 与 X-SeatMark-Storage", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore JS 模块无类型声明
    const { onRequest: onFeedback } = await import("../../../edge-functions/api/feedback.js");
    const response: Response = await onFeedback({
      request: new Request("http://localhost:5173/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "suggestion", content: "hello" }),
      }),
      env: withTestEnv({}),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("X-SeatMark-Rev")).toBe(SEATMARK_REV);
    expect(response.headers.get("X-SeatMark-Storage")).toBe("memory");
  });
});

describe("第 354 轮（第 363 轮递增）：三条边缘函数统一 X-SeatMark-Rev = r363 与公告短缓存", () => {
  it("_rev.js 导出 r363", () => {
    expect(SEATMARK_REV).toBe("r363");
  });

  it("/api/announcement GET 带 r363 与 Cache-Control 短缓存", async () => {
    const { response, data } = await call("GET", "https://www.seatmark.cn/api/announcement");
    expect(response.status).toBe(200);
    expect(data.authService).toBe("ok");
    expect(response.headers.get("X-SeatMark-Rev")).toBe("r363");
    expect(ANNOUNCEMENT_CACHE_CONTROL).toBe(
      "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    );
    expect(response.headers.get("Cache-Control")).toBe(ANNOUNCEMENT_CACHE_CONTROL);
  });

  it("其余 JSON 响应保持 no-store（不受公告缓存影响）", async () => {
    const { response } = await call("GET", "https://www.seatmark.cn/api/auth/me");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-SeatMark-Rev")).toBe("r363");
  });

  it("/api/feedback 405 / 200 响应均带 r363", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore JS 模块无类型声明
    const { onRequest: onFeedback } = await import("../../../edge-functions/api/feedback.js");
    const get: Response = await onFeedback({
      request: new Request("http://localhost:5173/api/feedback", { method: "GET" }),
      env: withTestEnv({}),
    });
    expect(get.status).toBe(405);
    expect(get.headers.get("X-SeatMark-Rev")).toBe("r363");
    const ok: Response = await onFeedback({
      request: new Request("http://localhost:5173/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "suggestion", content: "rev header" }),
      }),
      env: withTestEnv({}),
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("X-SeatMark-Rev")).toBe("r363");
  });

  it("/api/ai-design 405 / 413 / 200 响应均带 r363", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore JS 模块无类型声明
    const { onRequest: onAi, AI_MAX_BODY_BYTES } = await import("../../../edge-functions/api/ai-design.js");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { role: "assistant", content: "{}" } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ) as unknown as typeof fetch;
    try {
      const env = { SEATMARK_ALLOW_MEMORY_STORAGE: "1" };
      const post = (body: string, headers: Record<string, string> = {}) =>
        new Request("https://www.seatmark.cn/api/ai-design", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "EO-Connecting-IP": "198.51.100.77",
            ...headers,
          },
          body,
        });
      const notAllowed: Response = await onAi({
        request: new Request("https://www.seatmark.cn/api/ai-design", { method: "GET" }),
        env,
      });
      expect(notAllowed.status).toBe(405);
      expect(notAllowed.headers.get("X-SeatMark-Rev")).toBe("r363");
      const tooLarge: Response = await onAi({
        request: post("{}", { "Content-Length": String(AI_MAX_BODY_BYTES + 1) }),
        env,
      });
      expect(tooLarge.status).toBe(413);
      expect(tooLarge.headers.get("X-SeatMark-Rev")).toBe("r363");
      const ok: Response = await onAi({
        request: post(JSON.stringify({ messages: [{ role: "user", content: "hi" }] })),
        env,
      });
      expect(ok.status).toBe(200);
      expect(ok.headers.get("X-SeatMark-Rev")).toBe("r363");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("第 346 轮：/api/admin/overview 计数读取受控并发（mapConcurrent）", () => {
  it("mapConcurrent：结果顺序与输入一致，同时在飞数量不超过 limit", async () => {
    let inflight = 0;
    let peak = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    const out = await mapConcurrent(items, 8, async (n: number) => {
      inflight += 1;
      peak = Math.max(peak, inflight);
      await new Promise((r) => setTimeout(r, 1));
      inflight -= 1;
      return n * 2;
    });
    expect(out).toEqual(items.map((n) => n * 2));
    expect(peak).toBe(8);
  });

  it("20 个用户样本：汇总数与串行累加一致，KV 计数读取并发峰值 ≤ 8，返回 200 且字段齐全", async () => {
    const blob = createMockBlobStore();
    const date = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    // 预置 20 个用户与今日 usage/bonus 计数；usage 为 0 的用户不计入 activeTrialToday
    let expectUsage = 0;
    let expectBonus = 0;
    let expectActive = 0;
    for (let i = 0; i < 20; i++) {
      const email = `u${String(i).padStart(2, "0")}@example.com`;
      blob.data.set(
        `user:${email}`,
        JSON.stringify({ email, createdAt: now, templateCount: i % 3 }),
      );
      const used = i % 4; // 0,1,2,3 循环 → 5 个用户为 0
      const bonus = i % 5;
      if (used > 0) blob.data.set(`usage:${email}:${date}`, String(used));
      if (bonus > 0) blob.data.set(`bonus:${email}:${date}`, String(bonus));
      expectUsage += used;
      expectBonus += bonus;
      if (used > 0) expectActive += 1;
    }
    const adminEmail = "ov-admin@example.com";
    const env: Env = {
      AUTH_SECRET: "test-secret",
      ADMIN_EMAILS: adminEmail,
      seatmark_blob: blob,
    };
    const { data: codeData } = await call("POST", "http://localhost:5173/api/auth/code", {
      body: { email: adminEmail },
      env,
    });
    const { response: verifyRes } = await call("POST", "http://localhost:5173/api/auth/verify", {
      body: { email: adminEmail, code: codeData.devCode },
      env,
    });
    const cookie = (verifyRes.headers.get("Set-Cookie") || "").split(";")[0];

    // 登录后才开始统计计数键读取的并发峰值
    let inflight = 0;
    let peak = 0;
    const rawGet = blob.get.bind(blob);
    blob.get = async (key, options) => {
      const counted = key.startsWith("usage:") || key.startsWith("bonus:");
      if (counted) {
        inflight += 1;
        peak = Math.max(peak, inflight);
      }
      await new Promise((r) => setTimeout(r, 1));
      try {
        return await rawGet(key, options);
      } finally {
        if (counted) inflight -= 1;
      }
    };

    const { response, data } = await call("GET", "https://www.seatmark.cn/api/admin/overview", {
      env,
      cookie,
    });
    expect(response.status).toBe(200);
    expect(data.totalUsers).toBe(21); // 20 个样本 + 管理员本人
    expect(data.usageToday).toBe(expectUsage);
    expect(data.shareBonusToday).toBe(expectBonus);
    expect(data.activeTrialToday).toBe(expectActive);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(8);
    for (const field of [
      "totalUsers",
      "growth",
      "templateSyncUsers",
      "templateTotal",
      "usageToday",
      "trialUsers",
      "activeTrialToday",
      "shareBonusToday",
      "reservationCount",
      "feedbackCount",
      "storage",
    ]) {
      expect(data).toHaveProperty(field);
    }
    expect(data.storage).toBe("blob");
  });
});

describe("第 350 轮：captcha 消费标记同步写（关闭 150ms 双用窗口）", () => {
  const PASSWORD = "sync-mark-secret-9";

  it("waitUntil 环境下同一 captcha 连续两次提交：不等后台写链，第二次立即 400「验证码已使用」", async () => {
    await call("POST", "https://www.seatmark.cn/api/auth/register", {
      body: { email: "sync-cap@example.com", password: PASSWORD },
    });
    const cap = await solvedCaptcha();
    const pending: Promise<unknown>[] = [];
    const context = {
      env: withTestEnv({}),
      waitUntil(p: Promise<unknown>) {
        pending.push(p);
      },
    };
    const mk = () =>
      new Request("https://www.seatmark.cn/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "sync-cap@example.com", password: PASSWORD, ...cap }),
      });
    const first: Response = await onRequest({ ...context, request: mk() });
    expect(first.status).toBe(200);
    // 不 await pending：后台写链尚未启动（150ms 延迟）时立即复用令牌
    const second: Response = await onRequest({ ...context, request: mk() });
    expect(second.status).toBe(400);
    expect(((await second.json()) as { error: string }).error).toContain("验证码已使用");
    await Promise.all(pending);
  });

  it("同一 captcha 两次并发提交（Promise.all）恰有一次 200、一次 400", async () => {
    await call("POST", "https://www.seatmark.cn/api/auth/register", {
      body: { email: "race-cap@example.com", password: PASSWORD },
    });
    const cap = await solvedCaptcha();
    const mk = () =>
      new Request("https://www.seatmark.cn/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "race-cap@example.com", password: PASSWORD, ...cap }),
      });
    const [a, b]: Response[] = await Promise.all([
      onRequest({ request: mk(), env: withTestEnv({}) }),
      onRequest({ request: mk(), env: withTestEnv({}) }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 400]);
  });

  it("注册路径：同一 captcha 并发两次注册恰有一次成功，另一次为 400 验证码已使用", async () => {
    const cap = await solvedCaptcha();
    const mk = () =>
      new Request("https://www.seatmark.cn/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "race-reg@example.com", password: PASSWORD, ...cap }),
      });
    const [a, b]: Response[] = await Promise.all([
      onRequest({ request: mk(), env: withTestEnv({}) }),
      onRequest({ request: mk(), env: withTestEnv({}) }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 400]);
    const rejected = a.status === 400 ? a : b;
    expect(((await rejected.json()) as { captcha?: boolean }).captcha).toBe(true);
  });

  it("captcha:used 标记带 expirationTtl（≤30min）且在响应返回前已落库", async () => {
    const store = new Map<string, string>();
    const puts: { key: string; ttl?: number }[] = [];
    const env = {
      seatmark_kv: {
        async get(k: string) {
          return store.get(k) ?? null;
        },
        async put(k: string, v: string, opts?: { expirationTtl?: number }) {
          puts.push({ key: k, ttl: opts?.expirationTtl });
          store.set(k, v);
        },
        async delete(k: string) {
          store.delete(k);
        },
      },
    } as unknown as Env;
    const pending: Promise<unknown>[] = [];
    const cap = await solvedCaptcha(env);
    const response: Response = await onRequest({
      request: new Request("https://www.seatmark.cn/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ttl-cap@example.com", password: PASSWORD, ...cap }),
      }),
      env: withTestEnv(env),
      waitUntil(p: Promise<unknown>) {
        pending.push(p);
      },
    });
    expect(response.status).toBe(200);
    // 后台写链未执行时标记已在库中
    const used = puts.find((p) => p.key.startsWith("captcha:used:"));
    expect(used).toBeDefined();
    expect(used!.ttl).toBeGreaterThan(0);
    expect(used!.ttl!).toBeLessThanOrEqual(30 * 60);
    await Promise.all(pending);
    // 日限键（注册 IP 日限）也带 ≤48h TTL
    const reg = puts.find((p) => p.key.startsWith("rl:reg:"));
    expect(reg).toBeDefined();
    expect(reg!.ttl).toBeGreaterThan(0);
    expect(reg!.ttl!).toBeLessThanOrEqual(48 * 3600);
  });
});

describe("第 350 轮：admin users/codes 逐键读取改受控并发，结果顺序与串行一致", () => {
  async function adminCookie(env: Env, adminEmail: string) {
    const { data: codeData } = await call("POST", "http://localhost:5173/api/auth/code", {
      body: { email: adminEmail },
      env,
    });
    const { response: verifyRes } = await call("POST", "http://localhost:5173/api/auth/verify", {
      body: { email: adminEmail, code: codeData.devCode },
      env,
    });
    return (verifyRes.headers.get("Set-Cookie") || "").split(";")[0];
  }

  it("/api/admin/users：30 个用户按 list 键序返回，与串行 kv.get 顺序一致，读取并发峰值 ≤ 8", async () => {
    const blob = createMockBlobStore();
    const now = new Date().toISOString();
    const emails: string[] = [];
    for (let i = 0; i < 30; i++) {
      const email = `list${String(i).padStart(2, "0")}@example.com`;
      emails.push(email);
      blob.data.set(`user:${email}`, JSON.stringify({ email, createdAt: now, loginCount: i }));
    }
    const adminEmail = "zz-admin@example.com";
    const env: Env = { AUTH_SECRET: "test-secret", ADMIN_EMAILS: adminEmail, seatmark_blob: blob };
    const cookie = await adminCookie(env, adminEmail);

    // 串行期望：按 list 排序逐个 get
    const listed = await blob.list({ prefix: "user:", limit: 50 });
    const serial: string[] = [];
    for (const b of listed.blobs) {
      const raw = await blob.get(b.key);
      if (raw) serial.push((JSON.parse(raw) as { email: string }).email);
    }

    let inflight = 0;
    let peak = 0;
    const rawGet = blob.get.bind(blob);
    blob.get = async (key, options) => {
      const counted = key.startsWith("user:");
      if (counted) {
        inflight += 1;
        peak = Math.max(peak, inflight);
      }
      // 反序延迟：越靠前的键越慢，串行/并发若混序会在此暴露
      await new Promise((r) => setTimeout(r, counted && key < "user:list15" ? 3 : 1));
      try {
        return await rawGet(key, options);
      } finally {
        if (counted) inflight -= 1;
      }
    };

    const { response, data } = await call("GET", "https://www.seatmark.cn/api/admin/users", {
      env,
      cookie,
    });
    expect(response.status).toBe(200);
    const users = data.users as { email: string; loginCount?: number }[];
    expect(users.map((u) => u.email)).toEqual(serial);
    expect(users.length).toBe(31); // 30 个样本 + 管理员本人
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(8);
    for (const u of users) {
      expect(u).not.toHaveProperty("passwordHash");
    }
  });

  it("/api/admin/codes GET：批次核销计数与串行一致（20 码批次，其中 7 个已兑换）", async () => {
    const blob = createMockBlobStore();
    const adminEmail = "codes-admin@example.com";
    const env: Env = { AUTH_SECRET: "test-secret", ADMIN_EMAILS: adminEmail, seatmark_blob: blob };
    const cookie = await adminCookie(env, adminEmail);
    const { response: gen, data: genData } = await call(
      "POST",
      "https://www.seatmark.cn/api/admin/codes",
      { env, cookie, body: { days: 30, count: 20, note: "并发核销" } },
    );
    expect(gen.status).toBe(200);
    const batchKey = [...blob.data.keys()].find((k) => k.startsWith("redeembatch:"))!;
    const batch = JSON.parse(blob.data.get(batchKey)!) as { hashes: string[] };
    // 直接把前 7 个哈希键标记为已兑换
    for (const h of batch.hashes.slice(0, 7)) {
      const key = `redeem:${h}`;
      const rec = JSON.parse(blob.data.get(key)!) as Record<string, unknown>;
      blob.data.set(key, JSON.stringify({ ...rec, usedBy: "someone@example.com" }));
    }
    const { response, data } = await call("GET", "https://www.seatmark.cn/api/admin/codes", {
      env,
      cookie,
    });
    expect(response.status).toBe(200);
    const batches = data.batches as { count: number; used: number; masked: string[] }[];
    expect(batches).toHaveLength(1);
    expect(batches[0].count).toBe(20);
    expect(batches[0].used).toBe(7);
    expect(batches[0].masked).toHaveLength(20);
    expect((genData.codes as string[]).length).toBe(20);
  });
});

describe("第 353 轮：验证码答案哈希移出 JWT，改存 KV captcha:ans:<cid>", () => {
  const PASSWORD = "test-password-353";

  function decodeJwtPayload(token: string): Record<string, unknown> {
    const part = token.split(".")[1]!;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(b64, "base64").toString("utf-8")) as Record<string, unknown>;
  }

  function trackedKv() {
    const store = new Map<string, string>();
    const puts: { key: string; value: string; ttl?: number }[] = [];
    const deletes: string[] = [];
    const kv = {
      async get(k: string) {
        return store.get(k) ?? null;
      },
      async put(k: string, v: string, opts?: { expirationTtl?: number }) {
        puts.push({ key: k, value: v, ttl: opts?.expirationTtl });
        store.set(k, v);
      },
      async delete(k: string) {
        deletes.push(k);
        store.delete(k);
      },
    };
    return { store, puts, deletes, env: { seatmark_kv: kv } as unknown as Env };
  }

  it("GET /api/auth/captcha：token 载荷仅 {typ,cid,exp}、无 cap；答案哈希写入 KV captcha:ans:<cid>，TTL 300s", async () => {
    const { puts, env } = trackedKv();
    const response: Response = await onRequest({
      request: new Request("https://www.seatmark.cn/api/auth/captcha"),
      env: withTestEnv(env),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as { token: string };
    const payload = decodeJwtPayload(data.token);
    expect(payload.typ).toBe("captcha");
    expect(typeof payload.cid).toBe("string");
    expect(payload.cid as string).toMatch(/^\d+-[0-9a-z]{6}$/);
    expect(payload).not.toHaveProperty("cap");
    expect(Object.keys(payload).sort()).toEqual(["cid", "exp", "typ"]);
    // 整个 token 文本里也不出现任何 64 位 sha256 十六进制串
    expect(JSON.stringify(payload)).not.toMatch(/[0-9a-f]{64}/);

    const ans = puts.find((p) => p.key === `captcha:ans:${payload.cid as string}`);
    expect(ans).toBeDefined();
    expect(ans!.ttl).toBe(300);
    expect(ans!.value).toMatch(/^[0-9a-f]{64}$/);
  });

  it("注册成功后 captcha:ans:<cid> 被 kv.delete，且写入 captcha:used 标记；同一 token 再提交为 400「验证码已使用」", async () => {
    const { store, deletes, env } = trackedKv();
    const cap = await solvedCaptcha(env);
    const cid = decodeJwtPayload(cap.captchaToken).cid as string;
    expect(store.has(`captcha:ans:${cid}`)).toBe(true);

    const first: Response = await onRequest({
      request: new Request("https://www.seatmark.cn/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "cap-kv@example.com", password: PASSWORD, ...cap }),
      }),
      env: withTestEnv(env),
    });
    expect(first.status).toBe(200);
    expect(deletes).toContain(`captcha:ans:${cid}`);
    expect(store.has(`captcha:ans:${cid}`)).toBe(false);
    expect([...store.keys()].some((k) => k.startsWith("captcha:used:"))).toBe(true);

    const second: Response = await onRequest({
      request: new Request("https://www.seatmark.cn/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "cap-kv@example.com", password: PASSWORD, ...cap }),
      }),
      env: withTestEnv(env),
    });
    expect(second.status).toBe(400);
    const data = (await second.json()) as { error: string; captcha?: boolean };
    expect(data.captcha).toBe(true);
    expect(data.error).toContain("已使用");
  });

  it("KV 中答案键缺失（过期/被清）而无已用标记 → 400「不正确或已过期」；伪造 cid 亦被拒", async () => {
    const { store, env } = trackedKv();
    const cap = await solvedCaptcha(env);
    const cid = decodeJwtPayload(cap.captchaToken).cid as string;
    store.delete(`captcha:ans:${cid}`);

    const response: Response = await onRequest({
      request: new Request("https://www.seatmark.cn/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "cap-gone@example.com", password: PASSWORD, ...cap }),
      }),
      env: withTestEnv(env),
    });
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string; captcha?: boolean };
    expect(data.captcha).toBe(true);
    expect(data.error).toContain("不正确或已过期");
    expect([...store.keys()].some((k) => k.startsWith("user:"))).toBe(false);
  });
});

describe("第 356 轮：/api/quota/consume exportId 幂等键", () => {
  async function memberCookie(env: Env, email: string) {
    const { data: codeData } = await call("POST", "http://localhost:5173/api/auth/code", {
      body: { email },
      env,
    });
    const { response: verifyRes } = await call("POST", "http://localhost:5173/api/auth/verify", {
      body: { email, code: codeData.devCode },
      env,
    });
    expect(verifyRes.status).toBe(200);
    return (verifyRes.headers.get("Set-Cookie") || "").split(";")[0];
  }

  function setup(email: string) {
    const blob = createMockBlobStore();
    const env: Env = { AUTH_SECRET: "test-secret", seatmark_blob: blob };
    return { blob, env, email };
  }

  /** Blob 后端带 TTL 的值是 {v,exp} 包装，读计数需解包 */
  function usedCounter(blob: ReturnType<typeof createMockBlobStore>, email: string) {
    const key = [...blob.data.keys()].find(
      (k) => k.startsWith(`usage:${email}:`) && !k.includes(":id:"),
    );
    if (!key) return 0;
    const { value } = unwrapTtl(blob.data.get(key)) as { value: string | null };
    return Number(value);
  }

  it("同一 exportId 连续 POST 两次：used 只增 1，第二次 already=true 且不再计数", async () => {
    const { blob, env, email } = setup("idem-same@example.com");
    const cookie = await memberCookie(env, email);
    const exportId = "0f1e2d3c-4b5a-4697-8877-665544332211";

    const first = await call("POST", "https://www.seatmark.cn/api/quota/consume", {
      env,
      cookie,
      body: { exportId },
    });
    expect(first.response.status).toBe(200);
    expect(first.data.ok).toBe(true);
    expect(first.data.already).toBeUndefined();
    expect(first.data.used).toBe(1);
    expect(usedCounter(blob, email)).toBe(1);

    const second = await call("POST", "https://www.seatmark.cn/api/quota/consume", {
      env,
      cookie,
      body: { exportId },
    });
    expect(second.response.status).toBe(200);
    expect(second.data.ok).toBe(true);
    expect(second.data.already).toBe(true);
    expect(second.data.used).toBe(1);
    expect(usedCounter(blob, email)).toBe(1);
    // 幂等标记与计数同日同键前缀，随 dailyTtl 过期
    expect([...blob.data.keys()].some((k) => k.startsWith(`usage:${email}:`) && k.endsWith(`:id:${exportId}`))).toBe(true);
  });

  it("不同 exportId 各计一次；不带 exportId 按无键处理照常计数", async () => {
    const { blob, env, email } = setup("idem-diff@example.com");
    const cookie = await memberCookie(env, email);

    const a = await call("POST", "https://www.seatmark.cn/api/quota/consume", {
      env,
      cookie,
      body: { exportId: "aaaaaaaa-0000-4000-8000-000000000001" },
    });
    const b = await call("POST", "https://www.seatmark.cn/api/quota/consume", {
      env,
      cookie,
      body: { exportId: "bbbbbbbb-0000-4000-8000-000000000002" },
    });
    const noKey = await call("POST", "https://www.seatmark.cn/api/quota/consume", {
      env,
      cookie,
      body: {},
    });
    expect(a.data.used).toBe(1);
    expect(b.data.used).toBe(2);
    expect(b.data.already).toBeUndefined();
    expect(noKey.response.status).toBe(200);
    expect(noKey.data.used).toBe(3);
    expect(usedCounter(blob, email)).toBe(3);
  });

  it("非法 exportId（大写/过短/过长/非字符串/非 JSON body）不 500，按无键处理照常计数", async () => {
    const { blob, env, email } = setup("idem-bad@example.com");
    const cookie = await memberCookie(env, email);
    // 日限 QUOTA_USER_DAILY=3：2 个非法键 + 1 个非 JSON body 恰好用满，均须 200 而非 500
    const bad: unknown[] = ["ABCDEF12-Zz", { nested: "f".repeat(65) }];
    let expectedUsed = 0;
    for (const exportId of bad) {
      const res = await call("POST", "https://www.seatmark.cn/api/quota/consume", {
        env,
        cookie,
        body: { exportId },
      });
      expectedUsed += 1;
      expect(res.response.status).toBe(200);
      expect(res.data.already).toBeUndefined();
      expect(res.data.used).toBe(expectedUsed);
    }
    // 非 JSON body：readBody 返回 null，同样按无键处理
    const raw: Response = await onRequest({
      request: new Request("https://www.seatmark.cn/api/quota/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: "not-json{",
      }),
      env: withTestEnv(env),
    });
    expect(raw.status).toBe(200);
    expectedUsed += 1;
    expect(((await raw.json()) as { used: number }).used).toBe(expectedUsed);
    expect(usedCounter(blob, email)).toBe(expectedUsed);
    // 非法键不落任何 :id: 标记
    expect([...blob.data.keys()].some((k) => k.includes(":id:"))).toBe(false);

    // 其余非法形态（过短/过长/数字/null）在额度用尽后也只会 429，不会 500
    for (const exportId of ["0f1e2d3", "f".repeat(65), 12345678, null]) {
      const res = await call("POST", "https://www.seatmark.cn/api/quota/consume", {
        env,
        cookie,
        body: { exportId },
      });
      expect(res.response.status).toBe(429);
    }
    expect([...blob.data.keys()].some((k) => k.includes(":id:"))).toBe(false);
  });

  it("存储降级 memory 且未放行时 consume 仍 fail closed 503（带 exportId 也不例外）", async () => {
    const { response } = await call("POST", "https://www.seatmark.cn/api/quota/consume", {
      env: { SEATMARK_ALLOW_MEMORY_STORAGE: "", AUTH_SECRET: "test-secret" },
      body: { exportId: "0f1e2d3c-4b5a-4697-8877-665544332211" },
    });
    expect(response.status).toBe(503);
  });
});

describe("第 357 轮：/api/share/tpl 短码 30 天过期", () => {
  const PAYLOAD = "v0.eyJhIjoxfQ";
  const TTL_30D = 30 * 24 * 3600;

  it("KV 写入携带 expirationTtl=30 天，响应回传 expiresInSeconds", async () => {
    const puts: Array<{ key: string; options?: { expirationTtl?: number } }> = [];
    const kv = {
      async get() {
        return null;
      },
      async put(key: string, _value: string, options?: { expirationTtl?: number }) {
        puts.push({ key, options });
      },
      async delete() {},
    };
    const { response, data } = await call("POST", "http://localhost:5173/api/share/tpl", {
      body: { payload: PAYLOAD },
      env: { seatmark_kv: kv } as unknown as Env,
    });
    expect(response.status).toBe(200);
    expect(data.expiresInSeconds).toBe(TTL_30D);
    const tplPut = puts.find((p) => p.key === `tplshare:${data.code}`);
    expect(tplPut).toBeDefined();
    expect(tplPut!.options).toEqual({ expirationTtl: TTL_30D });
  });

  it("Blob 后端：写入为 {v,exp} 包装且 exp≈30 天后；过期后读取 404 带 code=tplshare_not_found", async () => {
    const blob = createMockBlobStore();
    const env: Env = { seatmark_blob: blob };
    const before = Date.now();
    const { response, data } = await call("POST", "http://localhost:5173/api/share/tpl", {
      body: { payload: PAYLOAD },
      env,
    });
    expect(response.status).toBe(200);
    const raw = blob.data.get(`tplshare:${data.code}`);
    expect(raw).toBeDefined();
    const wrapped = JSON.parse(raw!) as { v: string; exp: number };
    expect(wrapped.v).toBe(PAYLOAD);
    expect(wrapped.exp).toBeGreaterThanOrEqual(before + TTL_30D * 1000 - 5_000);
    expect(wrapped.exp).toBeLessThanOrEqual(Date.now() + TTL_30D * 1000 + 5_000);

    // 未过期：正常读回
    const fresh = await call("GET", `http://localhost:5173/api/share/tpl?code=${data.code}`, { env });
    expect(fresh.response.status).toBe(200);
    expect(fresh.data.payload).toBe(PAYLOAD);

    // 把 exp 拨到过去：读取端视为不存在 → 404 + 明确语义
    blob.data.set(`tplshare:${data.code}`, JSON.stringify({ v: PAYLOAD, exp: Date.now() - 1000 }));
    const expired = await call("GET", `http://localhost:5173/api/share/tpl?code=${data.code}`, { env });
    expect(expired.response.status).toBe(404);
    expect(expired.data.code).toBe("tplshare_not_found");
    expect(expired.data.error).toBe("分享链接已过期或不存在");
  });

  it("从未存在的短码同样 404 + tplshare_not_found", async () => {
    const { response, data } = await call("GET", "http://localhost:5173/api/share/tpl?code=0123456789");
    expect(response.status).toBe(404);
    expect(data.code).toBe("tplshare_not_found");
  });
});

describe("第 359 轮：存档保留期 + 管理端列表取「最新」而非「最旧」", () => {
  /** 带 list 翻页的内存 KV：pageLimit 由调用方给定，记录 put 的 TTL */
  function pagedKv() {
    const store = new Map<string, string>();
    const puts: Array<{ key: string; ttl?: number }> = [];
    let listCalls = 0;
    const kv = {
      async get(k: string) {
        return store.get(k) ?? null;
      },
      async put(k: string, v: string, options?: { expirationTtl?: number }) {
        store.set(k, v);
        puts.push({ key: k, ttl: options?.expirationTtl });
      },
      async delete(k: string) {
        store.delete(k);
      },
      async list({ prefix = "", limit = 256, cursor = "" } = {}) {
        listCalls += 1;
        const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
        const start = cursor ? keys.indexOf(cursor) + 1 : 0;
        const page = keys.slice(start, start + limit);
        return {
          keys: page.map((name) => ({ name })),
          complete: start + limit >= keys.length,
          cursor: page.length ? page[page.length - 1] : "",
        };
      },
    };
    return { store, puts, kv, listCalls: () => listCalls };
  }

  async function adminCookie(env: Env, adminEmail: string) {
    const { data: codeData } = await call("POST", "http://localhost:5173/api/auth/code", {
      body: { email: adminEmail },
      env,
    });
    const { response: verifyRes } = await call("POST", "http://localhost:5173/api/auth/verify", {
      body: { email: adminEmail, code: codeData.devCode },
      env,
    });
    return (verifyRes.headers.get("Set-Cookie") || "").split(";")[0];
  }

  it("listAllKeys 按 cursor 翻到尾；到 maxPages 上限时 truncated=true", async () => {
    const { store, kv } = pagedKv();
    for (let i = 0; i < 700; i++) store.set(`fb:${String(1_700_000_000_000 + i)}-x`, "{}");
    const all = await listAllKeys(kv, "fb:", { pageLimit: 256, maxPages: 20 });
    expect(all.keys).toHaveLength(700);
    expect(all.truncated).toBe(false);
    expect(all.keys[699]).toBe(`fb:${String(1_700_000_000_000 + 699)}-x`);
    const capped = await listAllKeys(kv, "fb:", { pageLimit: 256, maxPages: 2 });
    expect(capped.keys).toHaveLength(512);
    expect(capped.truncated).toBe(true);
    expect(await listAllKeys(kv, "none:", { pageLimit: 256, maxPages: 20 })).toEqual({ keys: [], truncated: false });
  });

  it("写入 300 条反馈后 /api/admin/feedback 返回最新 100 条、首条为最新、truncated=false", async () => {
    const { store, kv } = pagedKv();
    const base = 1_700_000_000_000;
    for (let i = 0; i < 300; i++) {
      store.set(
        `fb:${String(base + i)}-${String(i).padStart(4, "0")}`,
        JSON.stringify({ type: "other", content: `fb-${i}`, createdAt: new Date(base + i).toISOString() }),
      );
    }
    const adminEmail = "zz-admin@example.com";
    const env = { AUTH_SECRET: "test-secret", ADMIN_EMAILS: adminEmail, seatmark_kv: kv } as unknown as Env;
    const cookie = await adminCookie(env, adminEmail);
    const { response, data } = await call("GET", "https://www.seatmark.cn/api/admin/feedback", { env, cookie });
    expect(response.status).toBe(200);
    const items = data.items as Array<{ content: string }>;
    expect(items).toHaveLength(100);
    expect(items[0]!.content).toBe("fb-299");
    expect(items[99]!.content).toBe("fb-200");
    expect(data.truncated).toBe(false);
    expect(response.headers.get("X-SeatMark-Rev")).toBe(SEATMARK_REV);
  });

  it("写入 300 条预订后 /api/admin/reservations 返回最新 200 条并倒序；写入带 365 天 TTL", async () => {
    const { store, puts, kv } = pagedKv();
    const base = 1_700_000_000_000;
    for (let i = 0; i < 300; i++) {
      store.set(
        `reserve:${String(base + i)}-${String(i).padStart(4, "0")}`,
        JSON.stringify({ email: `t${i}@example.com`, teamSize: "10", note: "", createdAt: new Date(base + i).toISOString() }),
      );
    }
    const adminEmail = "zz-admin@example.com";
    const env = { AUTH_SECRET: "test-secret", ADMIN_EMAILS: adminEmail, seatmark_kv: kv } as unknown as Env;
    const cookie = await adminCookie(env, adminEmail);
    const { response, data } = await call("GET", "https://www.seatmark.cn/api/admin/reservations", { env, cookie });
    expect(response.status).toBe(200);
    const items = data.items as Array<{ email: string }>;
    expect(items).toHaveLength(200);
    expect(items[0]!.email).toBe("t299@example.com");
    expect(items[199]!.email).toBe("t100@example.com");
    expect(data.truncated).toBe(false);

    const { response: reserveRes } = await call("POST", "http://localhost:5173/api/team/reserve", {
      body: { email: "team-ttl@example.com", teamSize: "10" },
      env,
    });
    expect(reserveRes.status).toBe(200);
    expect(RESERVE_ARCHIVE_TTL_SECONDS).toBe(365 * 24 * 3600);
    const archive = puts.find((p) => p.key.startsWith("reserve:"));
    expect(archive?.ttl).toBe(RESERVE_ARCHIVE_TTL_SECONDS);
  });

  it("匿名访问 /api/admin/feedback、/api/admin/reservations 仍为 401", async () => {
    const { kv } = pagedKv();
    const env = { AUTH_SECRET: "test-secret", ADMIN_EMAILS: "zz-admin@example.com", seatmark_kv: kv } as unknown as Env;
    for (const path of ["/api/admin/feedback", "/api/admin/reservations"]) {
      const { response } = await call("GET", `https://www.seatmark.cn${path}`, { env });
      expect(response.status).toBe(401);
    }
  });
});

describe("第 361 轮：/api/redeem 两段式核销「死码窗口」修复", () => {
  async function devCookie(env: Env, email: string) {
    const { data: codeData } = await call("POST", "http://localhost:5173/api/auth/code", {
      body: { email },
      env,
    });
    const { response: verifyRes } = await call("POST", "http://localhost:5173/api/auth/verify", {
      body: { email, code: codeData.devCode },
      env,
    });
    expect(verifyRes.status).toBe(200);
    return (verifyRes.headers.get("Set-Cookie") || "").split(";")[0];
  }

  async function setup(tag: string) {
    const blob = createMockBlobStore();
    const adminEmail = `${tag}-admin@example.com`;
    const env: Env = { AUTH_SECRET: "test-secret", ADMIN_EMAILS: adminEmail, seatmark_blob: blob };
    const adminCk = await devCookie(env, adminEmail);
    const { response: gen, data: genData } = await call("POST", "https://www.seatmark.cn/api/admin/codes", {
      env,
      cookie: adminCk,
      body: { days: 30, count: 1, note: tag },
    });
    expect(gen.status).toBe(200);
    const code = (genData.codes as string[])[0];
    const recordKey = [...blob.data.keys()].find((k) => k.startsWith("redeem:"))!;
    return { blob, env, code, recordKey };
  }

  function readRecord(blob: ReturnType<typeof createMockBlobStore>, key: string) {
    return JSON.parse(blob.data.get(key)!) as { usedBy: string | null; usedAt: string | null; days: number };
  }

  it("(a) 发放落库 putUser 抛错 → 503 兑换未完成，记录回滚 usedBy=null；同用户重试成功且 pro 只发一次", async () => {
    const { blob, env, code, recordKey } = await setup("dead-a");
    const email = "dead-a-user@example.com";
    const cookie = await devCookie(env, email);
    const before = JSON.parse(blob.data.get(`user:${email}`)!) as { proUntil?: string };
    const baseUntil = Date.parse(before.proUntil || "") || 0;

    let failUserWrites = true;
    const rawSet = blob.set.bind(blob);
    blob.set = async (key, value) => {
      if (failUserWrites && key === `user:${email}`) throw new Error("blob write failed");
      return rawSet(key, value);
    };

    const first = await call("POST", "https://www.seatmark.cn/api/redeem", { env, cookie, body: { code } });
    expect(first.response.status).toBe(503);
    expect(first.data.error).toBe("兑换未完成，请稍后重试");
    expect(readRecord(blob, recordKey).usedBy).toBeNull();
    expect(readRecord(blob, recordKey).usedAt).toBeNull();
    // 用户会员未被发放
    const afterFail = JSON.parse(blob.data.get(`user:${email}`)!) as { proUntil?: string };
    expect(Date.parse(afterFail.proUntil || "") || 0).toBe(baseUntil);

    failUserWrites = false;
    const retry = await call("POST", "https://www.seatmark.cn/api/redeem", { env, cookie, body: { code } });
    expect(retry.response.status).toBe(200);
    expect(retry.data.ok).toBe(true);
    expect(retry.data.already).toBeUndefined();
    expect(retry.data.days).toBe(30);
    expect(readRecord(blob, recordKey).usedBy).toBe(email);
    const granted = JSON.parse(blob.data.get(`user:${email}`)!) as { proUntil: string };
    const grantedUntil = Date.parse(granted.proUntil);
    // 只叠加一次 30 天（允许秒级误差）
    expect(Math.abs(grantedUntil - Math.max(baseUntil, Date.now()) - 30 * 86400000)).toBeLessThan(5000);

    // 第三次：幂等 already:true，会员不再叠加
    const again = await call("POST", "https://www.seatmark.cn/api/redeem", { env, cookie, body: { code } });
    expect(again.response.status).toBe(200);
    expect(again.data.already).toBe(true);
    const still = JSON.parse(blob.data.get(`user:${email}`)!) as { proUntil: string };
    expect(Date.parse(still.proUntil)).toBe(grantedUntil);
  });

  it("(b) confirm 回读被他人占用 → 409 已被使用，且不覆盖他人记录、不发放", async () => {
    const { blob, env, code, recordKey } = await setup("dead-b");
    const email = "dead-b-user@example.com";
    const other = "dead-b-other@example.com";
    const cookie = await devCookie(env, email);
    const before = JSON.parse(blob.data.get(`user:${email}`)!) as { proUntil?: string };

    // 模拟并发写-写重叠：本人认领写入后，他人的认领在回读前后到（覆盖为 other）
    const rawSet = blob.set.bind(blob);
    blob.set = async (key, value) => {
      await rawSet(key, value);
      if (key === recordKey && (JSON.parse(value) as { usedBy: string | null }).usedBy === email) {
        const rec = JSON.parse(value) as Record<string, unknown>;
        await rawSet(key, JSON.stringify({ ...rec, usedBy: other, usedAt: new Date().toISOString() }));
      }
    };

    const res = await call("POST", "https://www.seatmark.cn/api/redeem", { env, cookie, body: { code } });
    expect(res.response.status).toBe(409);
    expect(res.data.error).toBe("兑换码已被使用");
    expect(readRecord(blob, recordKey).usedBy).toBe(other);
    const after = JSON.parse(blob.data.get(`user:${email}`)!) as { proUntil?: string };
    expect(after.proUntil).toBe(before.proUntil);
  });

  it("(c) confirm 回读为空/损坏 → 503 并回滚认领，不按「已被使用」误报", async () => {
    const { blob, env, code, recordKey } = await setup("dead-c");
    const email = "dead-c-user@example.com";
    const cookie = await devCookie(env, email);

    let corruptOnce = true;
    const rawGet = blob.get.bind(blob);
    blob.get = async (key, options) => {
      const raw = await rawGet(key, options);
      if (corruptOnce && key === recordKey && raw && (JSON.parse(raw) as { usedBy: string | null }).usedBy === email) {
        corruptOnce = false;
        return "{not-json";
      }
      return raw;
    };

    const res = await call("POST", "https://www.seatmark.cn/api/redeem", { env, cookie, body: { code } });
    expect(res.response.status).toBe(503);
    expect(res.data.error).toBe("兑换未完成，请稍后重试");
    expect(readRecord(blob, recordKey).usedBy).toBeNull();

    const retry = await call("POST", "https://www.seatmark.cn/api/redeem", { env, cookie, body: { code } });
    expect(retry.response.status).toBe(200);
    expect(retry.data.days).toBe(30);
  });
});

describe("第 361 轮：/api/quota/consume 幂等键先写、日用量后写", () => {
  async function memberCookie(env: Env, email: string) {
    const { data: codeData } = await call("POST", "http://localhost:5173/api/auth/code", {
      body: { email },
      env,
    });
    const { response: verifyRes } = await call("POST", "http://localhost:5173/api/auth/verify", {
      body: { email, code: codeData.devCode },
      env,
    });
    expect(verifyRes.status).toBe(200);
    return (verifyRes.headers.get("Set-Cookie") || "").split(";")[0];
  }

  it("源码顺序：幂等键 put 出现在日用量 put 之前", () => {
    const src = readFileSync(EDGE_DEFAULT_PATH, "utf-8");
    const idemIdx = src.indexOf("if (idempotencyKey) await kv.put(idempotencyKey, '1', dailyTtl)");
    const usageIdx = src.indexOf("await kv.put(`usage:${email}:${status.date}`, String(used), dailyTtl)");
    expect(idemIdx).toBeGreaterThan(0);
    expect(usageIdx).toBeGreaterThan(idemIdx);
  });

  it("幂等键写成功、日用量写失败（第二次 put 抛错）→ 重试同 exportId 返回 already:true，used 不再 +1", async () => {
    const blob = createMockBlobStore();
    const email = "idem-order@example.com";
    const env: Env = { AUTH_SECRET: "test-secret", seatmark_blob: blob };
    const cookie = await memberCookie(env, email);
    const exportId = "0f1e2d3c-4b5a-4697-8877-665544332211";

    let failCounterOnce = true;
    const rawSet = blob.set.bind(blob);
    blob.set = async (key, value) => {
      if (failCounterOnce && key.startsWith(`usage:${email}:`) && !key.includes(":id:")) {
        failCounterOnce = false;
        throw new Error("blob write failed");
      }
      return rawSet(key, value);
    };

    const first = await call("POST", "https://www.seatmark.cn/api/quota/consume", {
      env,
      cookie,
      body: { exportId },
    });
    expect(first.response.status).toBe(500);
    // 幂等键已落、计数未落
    expect([...blob.data.keys()].some((k) => k.startsWith(`usage:${email}:`) && k.endsWith(`:id:${exportId}`))).toBe(true);
    expect([...blob.data.keys()].some((k) => k.startsWith(`usage:${email}:`) && !k.includes(":id:"))).toBe(false);

    const retry = await call("POST", "https://www.seatmark.cn/api/quota/consume", {
      env,
      cookie,
      body: { exportId },
    });
    expect(retry.response.status).toBe(200);
    expect(retry.data.already).toBe(true);
    expect(retry.data.used).toBe(0);
    expect([...blob.data.keys()].some((k) => k.startsWith(`usage:${email}:`) && !k.includes(":id:"))).toBe(false);

    // 新的 exportId 正常计数为 1（少扣一次偏向用户，不会多扣）
    const next = await call("POST", "https://www.seatmark.cn/api/quota/consume", {
      env,
      cookie,
      body: { exportId: "aaaaaaaa-0000-4000-8000-000000000009" },
    });
    expect(next.response.status).toBe(200);
    expect(next.data.used).toBe(1);
  });
});

describe("第 361 轮：写路由清单守卫（MEMORY_UNSAFE_ROUTES 登记完整）", () => {
  /** 仅清 cookie、无任何存储写入的只读豁免 */
  const READ_ONLY_EXEMPT = ["/api/auth/logout"];

  it("[[default]].js 中全部 path+method 写路由都在 MEMORY_UNSAFE_ROUTES 或豁免名单", () => {
    const src = readFileSync(EDGE_DEFAULT_PATH, "utf-8");
    const routes = [...src.matchAll(/path === '(\/api\/[^']+)' && method === '(POST|PUT|PATCH|DELETE)'/g)].map(
      (m) => [m[1], m[2]] as [string, string],
    );
    expect(routes.length).toBeGreaterThanOrEqual(14);
    const registry = MEMORY_UNSAFE_ROUTES as Record<string, string[]>;
    for (const [path, method] of routes) {
      const registered = Array.isArray(registry[path]) && registry[path].includes(method);
      expect(registered || READ_ONLY_EXEMPT.includes(path), `${method} ${path} 未登记 MEMORY_UNSAFE_ROUTES`).toBe(true);
    }
  });

  it("嵌套形式 `if (method === 'PUT')` 所属路径也已登记", () => {
    const src = readFileSync(EDGE_DEFAULT_PATH, "utf-8");
    const registry = MEMORY_UNSAFE_ROUTES as Record<string, string[]>;
    const nested = [...src.matchAll(/^\s*if \(method === '(PUT|POST|PATCH|DELETE)'\) \{/gm)];
    expect(nested.length).toBeGreaterThan(0);
    for (const m of nested) {
      const head = src.slice(0, m.index);
      const owner = [...head.matchAll(/path === '(\/api\/[^']+)'/g)].pop();
      expect(owner, "嵌套方法分支前应有 path 判断").toBeTruthy();
      const path = owner![1];
      expect(registry[path]?.includes(m[1]), `${m[1]} ${path} 未登记 MEMORY_UNSAFE_ROUTES`).toBe(true);
    }
  });

  it("豁免名单中的路由确实不写存储（/api/auth/logout 仅清 cookie）", async () => {
    const { kv } = await getStorage({});
    const before = (await kv.list({ prefix: "", limit: 10000 })).keys.length;
    const { response } = await call("POST", "https://www.seatmark.cn/api/auth/logout", {
      env: { SEATMARK_ALLOW_MEMORY_STORAGE: "", AUTH_SECRET: "test-secret" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain("sm_session=");
    const after = (await kv.list({ prefix: "", limit: 10000 })).keys.length;
    expect(after).toBe(before);
  });
});

describe("第 361 轮：/api/feedback 存档归入 memory fail-closed 口径", () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore JS 模块无类型声明
  const feedbackModule = () => import("../../../edge-functions/api/feedback.js");

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function post(env: Record<string, string>) {
    const { onRequest: onFeedback } = await feedbackModule();
    const response: Response = await onFeedback({
      request: new Request("https://www.seatmark.cn/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "suggestion", content: "memory fail closed" }),
      }),
      env,
    });
    return { response, data: (await response.json()) as Record<string, unknown> };
  }

  async function fbKeyCount() {
    const { kv } = await getStorage({});
    return (await kv.list({ prefix: "fb:", limit: 10000 })).keys.length;
  }

  it("memory 且未放行、无 FEEDBACK_WEBHOOK → 503 且不写内存假存档", async () => {
    const before = await fbKeyCount();
    const { response, data } = await post({ SEATMARK_ALLOW_MEMORY_STORAGE: "" });
    expect(response.status).toBe(503);
    expect(data.error).toBe("反馈服务暂时不可用，请稍后再试");
    expect(response.headers.get("X-SeatMark-Storage")).toBe("memory");
    expect(await fbKeyCount()).toBe(before);
  });

  it("memory 且未放行、配 FEEDBACK_WEBHOOK 投递成功 → 200，仍不写内存假存档，并发存档告警", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        calls.push(String(url));
        return new Response("{}", { status: 200 });
      }),
    );
    const before = await fbKeyCount();
    const { response, data } = await post({
      SEATMARK_ALLOW_MEMORY_STORAGE: "",
      FEEDBACK_WEBHOOK: "https://open.feishu.cn/open-apis/bot/v2/hook/test-only",
      ALERT_WEBHOOK: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test-only",
    });
    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(await fbKeyCount()).toBe(before);
    // 等待 waitUntil 回退路径的告警 fetch 完成
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.some((u) => u.startsWith("https://open.feishu.cn/"))).toBe(true);
    expect(calls.some((u) => u.startsWith("https://qyapi.weixin.qq.com/"))).toBe(true);
  });

  it("memory 且未放行、webhook 投递失败 → 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const { response } = await post({
      SEATMARK_ALLOW_MEMORY_STORAGE: "",
      FEEDBACK_WEBHOOK: "https://open.feishu.cn/open-apis/bot/v2/hook/test-only",
    });
    expect(response.status).toBe(503);
  });

  it("显式放行（本地联调）与 Blob/KV 正常路径不受影响：无 webhook 也 200 并存档", async () => {
    const allowed = await post({ SEATMARK_ALLOW_MEMORY_STORAGE: "1" });
    expect(allowed.response.status).toBe(200);

    const blob = createMockBlobStore();
    const { onRequest: onFeedback } = await feedbackModule();
    const response: Response = await onFeedback({
      request: new Request("https://www.seatmark.cn/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bug", content: "blob path" }),
      }),
      env: { SEATMARK_ALLOW_MEMORY_STORAGE: "", seatmark_blob: blob },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("X-SeatMark-Storage")).toBe("blob");
    expect([...blob.data.keys()].some((k) => k.startsWith("fb:"))).toBe(true);
  });
});

describe("第 361 轮：登录侧枚举抹平（无密码账号 → 401 通用文案）", () => {
  const PASSWORD = "super-secret-1";

  async function timed<T>(fn: () => Promise<T>) {
    const t0 = performance.now();
    const result = await fn();
    return { result, ms: performance.now() - t0 };
  }

  it("无密码账号登录 401「邮箱或密码不正确」，且计入失败计数；耗时与错误密码同量级", async () => {
    const blob = createMockBlobStore();
    const env: Env = { AUTH_SECRET: "test-secret", seatmark_blob: blob };
    const legacy = "enum-legacy@example.com";
    const normal = "enum-normal@example.com";
    // devCode 通道建无密码账号
    const { data: codeData } = await call("POST", "http://localhost:5173/api/auth/code", { body: { email: legacy }, env });
    await call("POST", "http://localhost:5173/api/auth/verify", { body: { email: legacy, code: codeData.devCode }, env });
    expect(JSON.parse(blob.data.get(`user:${legacy}`)!)).not.toHaveProperty("passwordHash");
    await call("POST", "https://www.seatmark.cn/api/auth/register", { body: { email: normal, password: PASSWORD }, env });

    // 预热一次 PBKDF2，避免首个 WebCrypto 调用的冷启动扰动
    await call("POST", "https://www.seatmark.cn/api/auth/login", { body: { email: normal, password: "warm-up-wrong" }, env });

    const legacyRun = await timed(() =>
      call("POST", "https://www.seatmark.cn/api/auth/login", { body: { email: legacy, password: PASSWORD }, env }),
    );
    expect(legacyRun.result.response.status).toBe(401);
    expect(legacyRun.result.data.error).toBe("邮箱或密码不正确");
    const failRaw = blob.data.get(`pwfail:${legacy}`);
    expect(failRaw).toBeTruthy();
    const { value } = unwrapTtl(failRaw) as { value: string };
    expect((JSON.parse(value) as { count: number }).count).toBe(1);

    const wrongRun = await timed(() =>
      call("POST", "https://www.seatmark.cn/api/auth/login", { body: { email: normal, password: "wrong-password" }, env }),
    );
    expect(wrongRun.result.response.status).toBe(401);
    expect(wrongRun.result.data.error).toBe("邮箱或密码不正确");

    const nobodyRun = await timed(() =>
      call("POST", "https://www.seatmark.cn/api/auth/login", { body: { email: "enum-nobody@example.com", password: PASSWORD }, env }),
    );
    expect(nobodyRun.result.response.status).toBe(401);
    expect(nobodyRun.result.data.error).toBe("邮箱或密码不正确");
    expect(blob.data.has("pwfail:enum-nobody@example.com")).toBe(false);

    // 宽松量级断言：三条 401 路径都含一次 PBKDF2，彼此在 4 倍以内
    const ratio = (a: number, b: number) => Math.max(a, b) / Math.max(1, Math.min(a, b));
    expect(ratio(legacyRun.ms, wrongRun.ms)).toBeLessThan(4);
    expect(ratio(nobodyRun.ms, wrongRun.ms)).toBeLessThan(4);
  });

  it("正常密码登录与 10 次失败锁定不回归；无密码账号连续失败同样锁定", async () => {
    const blob = createMockBlobStore();
    const env: Env = { AUTH_SECRET: "test-secret", seatmark_blob: blob };
    const legacy = "enum-lock@example.com";
    const { data: codeData } = await call("POST", "http://localhost:5173/api/auth/code", { body: { email: legacy }, env });
    await call("POST", "http://localhost:5173/api/auth/verify", { body: { email: legacy, code: codeData.devCode }, env });
    for (let i = 0; i < 10; i++) {
      const { response } = await call("POST", "https://www.seatmark.cn/api/auth/login", { body: { email: legacy, password: PASSWORD }, env });
      expect(response.status).toBe(401);
    }
    const locked = await call("POST", "https://www.seatmark.cn/api/auth/login", { body: { email: legacy, password: PASSWORD }, env });
    expect(locked.response.status).toBe(429);

    const normal = "enum-ok@example.com";
    await call("POST", "https://www.seatmark.cn/api/auth/register", { body: { email: normal, password: PASSWORD }, env });
    const ok = await call("POST", "https://www.seatmark.cn/api/auth/login", { body: { email: normal, password: PASSWORD }, env });
    expect(ok.response.status).toBe(200);
  });
});
