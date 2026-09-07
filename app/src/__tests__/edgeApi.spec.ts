/**
 * edge-functions/api/[[default]].js 的桩测试：
 * 直接调用 onRequest（内存 KV 降级），覆盖本轮新增的
 * devCode 环境限制与 /api/admin/health 健康检查。
 */
import { describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest } from "../../../edge-functions/api/[[default]].js";

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
  }: { body?: unknown; env?: Env; cookie?: string } = {},
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
  const headers = new Headers();
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

  it("公开公告与健康检查仍可响应，健康检查只报告密钥缺口", async () => {
    const ann = await call("GET", "https://www.seatmark.cn/api/announcement", {
      env: noSecret,
    });
    expect(ann.response.status).toBe(200);
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
    // 未设密码时直接登录提示先注册
    const { response: earlyRes } = await call(
      "POST",
      "https://www.seatmark.cn/api/auth/login",
      {
        body: { email: "legacy@example.com", password: PASSWORD },
      },
    );
    expect(earlyRes.status).toBe(409);
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
    expect(response.headers.get("X-SeatMark-Rev")).toMatch(/^r\d+$/);
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
    expect(response.headers.get("X-SeatMark-Rev")).toMatch(/^r\d+$/);
    expect(response.headers.get("X-SeatMark-Storage")).toBe("memory");
  });
});
