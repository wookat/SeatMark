/**
 * /api/analytics/pv 自建访客统计桩测试：
 * - EdgeOne eo.geo 国家码计数与未知地域降级（'XX'）
 * - IP+日去重（同 IP 当日重复上报只计一次）
 * - 内存存储降级时 fail closed（持久化计数不能丢）
 * - /api/admin/overview 聚合 visitorsToday（国家 + 一级页面分布）
 */
import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest } from "../../../edge-functions/api/[[default]].js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { unwrapTtl } from "../../../edge-functions/api/_storage.js";

interface Env {
  AUTH_SECRET?: string;
  ADMIN_EMAILS?: string;
  SEATMARK_ALLOW_MEMORY_STORAGE?: string;
  seatmark_blob?: MockBlobStore;
}

function withTestEnv(env: Env): Env {
  return { SEATMARK_ALLOW_MEMORY_STORAGE: "1", DEV: "1", ...env } as Env;
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

const PV_URL = "https://www.seatmark.cn/api/analytics/pv";
const TODAY = new Date().toISOString().slice(0, 10);

/** 构造上报请求：ip 走 EdgeOne 注入的 EO-Connecting-IP；cc 注入 request.eo.geo 模拟运行时地域 */
async function pv(
  ip: string,
  {
    path = "/",
    cc,
    env = {},
  }: { path?: string; cc?: string; env?: Env } = {},
) {
  const request = new Request(PV_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "EO-Connecting-IP": ip,
    },
    body: JSON.stringify({ path }),
  });
  if (cc !== undefined) {
    // EdgeOne 运行时把访客地域挂在 request.eo.geo 上，标准 Request 无此字段，测试时手动注入
    Object.assign(request, { eo: { geo: { countryCodeAlpha2: cc } } });
  }
  const response: Response = await onRequest({
    request,
    env: withTestEnv(env),
  });
  return { response, data: (await response.json()) as Record<string, unknown> };
}

/** Blob 适配层对带 TTL 写入存包装值 {"v":…,"exp":…}，断言前解包 */
function counterOf(blob: { data: Map<string, string> }, key: string): string | null {
  const raw = blob.data.get(key);
  return raw === undefined ? null : (unwrapTtl(raw).value as string | null);
}

describe("POST /api/analytics/pv 访客统计", () => {
  it("首次上报按 EdgeOne eo.geo 国家码计数：total/cc/page 各 +1", async () => {
    const blob = createMockBlobStore();
    const { response, data } = await pv("10.0.0.1", {
      path: "/",
      cc: "US",
      env: { seatmark_blob: blob },
    });
    expect(response.status).toBe(200);
    expect(data.counted).toBe(true);
    expect(data.country).toBe("US");
    expect(counterOf(blob, `ana:pv:${TODAY}:total`)).toBe("1");
    expect(counterOf(blob, `ana:pv:${TODAY}:cc:US`)).toBe("1");
    expect(counterOf(blob, `ana:pv:${TODAY}:p:home`)).toBe("1");
  });

  it("路径归一化为一级目录：/templates/foo → p:templates；查询串不进入键名", async () => {
    const blob = createMockBlobStore();
    const { data } = await pv("10.0.0.2", {
      path: "/templates/foo?q=alice&name=bob",
      cc: "CN",
      env: { seatmark_blob: blob },
    });
    expect(data.counted).toBe(true);
    expect(counterOf(blob, `ana:pv:${TODAY}:p:templates`)).toBe("1");
    // 用户输入不允许进入统计键
    for (const key of blob.data.keys()) {
      expect(key).not.toContain("alice");
      expect(key).not.toContain("bob");
      expect(key).not.toContain("foo");
    }
  });

  it("同 IP 当日重复上报：去重命中 counted:false，计数不涨", async () => {
    const blob = createMockBlobStore();
    const env = { seatmark_blob: blob };
    await pv("10.0.0.3", { path: "/", cc: "JP", env });
    const { data } = await pv("10.0.0.3", { path: "/studio", cc: "JP", env });
    expect(data.counted).toBe(false);
    expect(counterOf(blob, `ana:pv:${TODAY}:total`)).toBe("1");
    expect(counterOf(blob, `ana:pv:${TODAY}:p:studio`)).toBeNull();
  });

  it("不同 IP 同日分别计数：total 累加、同国家合并", async () => {
    const blob = createMockBlobStore();
    const env = { seatmark_blob: blob };
    await pv("10.0.0.4", { path: "/", cc: "SG", env });
    await pv("10.0.0.5", { path: "/studio", cc: "SG", env });
    expect(counterOf(blob, `ana:pv:${TODAY}:total`)).toBe("2");
    expect(counterOf(blob, `ana:pv:${TODAY}:cc:SG`)).toBe("2");
    expect(counterOf(blob, `ana:pv:${TODAY}:p:home`)).toBe("1");
    expect(counterOf(blob, `ana:pv:${TODAY}:p:studio`)).toBe("1");
  });

  it("eo.geo 缺失（本地 dev / 未知地域）：归 'XX' 计数", async () => {
    const blob = createMockBlobStore();
    const { data } = await pv("10.0.0.6", { env: { seatmark_blob: blob } });
    expect(data.country).toBe("XX");
    expect(counterOf(blob, `ana:pv:${TODAY}:cc:XX`)).toBe("1");
  });

  it("eo.geo 字段非法（非两字母大写）：同样归 'XX'，不信任客户端伪造值", async () => {
    const blob = createMockBlobStore();
    const { data } = await pv("10.0.0.7", { cc: "fake", env: { seatmark_blob: blob } });
    expect(data.country).toBe("XX");
    expect(counterOf(blob, `ana:pv:${TODAY}:cc:FA`)).toBeNull();
    expect(counterOf(blob, `ana:pv:${TODAY}:cc:XX`)).toBe("1");
  });

  it("内存存储降级且未放行：fail closed 503 storage_unavailable", async () => {
    // 配上 AUTH_SECRET 隔离密钥缺失的 fail closed，单独验证存储降级分支
    const { response, data } = await pv("10.0.0.8", {
      env: { SEATMARK_ALLOW_MEMORY_STORAGE: "", AUTH_SECRET: "test-secret" },
    });
    expect(response.status).toBe(503);
    expect(data.error).toBe("storage_unavailable");
  });
});

describe("GET /api/admin/overview 聚合 visitorsToday", () => {
  it("返回当日国家与一级页面分布（按计数降序，top 12 截断）", async () => {
    const blob = createMockBlobStore();
    const adminEmail = "geo-admin@example.com";
    const env: Env = {
      AUTH_SECRET: "test-secret",
      ADMIN_EMAILS: adminEmail,
      seatmark_blob: blob,
    };
    // 预置当日统计键（与端点写入的键结构一致）
    blob.data.set(`ana:pv:${TODAY}:total`, "6");
    blob.data.set(`ana:pv:${TODAY}:cc:CN`, "4");
    blob.data.set(`ana:pv:${TODAY}:cc:US`, "1");
    blob.data.set(`ana:pv:${TODAY}:cc:XX`, "1");
    blob.data.set(`ana:pv:${TODAY}:p:home`, "3");
    blob.data.set(`ana:pv:${TODAY}:p:studio`, "2");
    blob.data.set(`ana:pv:${TODAY}:p:templates`, "1");

    // 管理员邮箱验证码登录（DEV=1 时 devCode 回显验证码）
    const codeReq = new Request("https://www.seatmark.cn/api/auth/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail }),
    });
    const codeRes: Response = await onRequest({ request: codeReq, env: withTestEnv(env) });
    const { devCode } = (await codeRes.json()) as { devCode: string };
    const verifyReq = new Request("https://www.seatmark.cn/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, code: devCode }),
    });
    const verifyRes: Response = await onRequest({
      request: verifyReq,
      env: withTestEnv(env),
    });
    const cookie = (verifyRes.headers.get("Set-Cookie") || "").split(";")[0];

    const ovReq = new Request("https://www.seatmark.cn/api/admin/overview", {
      headers: { Cookie: cookie },
    });
    const ovRes: Response = await onRequest({ request: ovReq, env: withTestEnv(env) });
    const ov = (await ovRes.json()) as {
      visitorsToday: {
        total: number;
        countries: { cc: string; count: number }[];
        pages: { path: string; count: number }[];
      };
    };
    expect(ovRes.status).toBe(200);
    expect(ov.visitorsToday.total).toBe(6);
    expect(ov.visitorsToday.countries).toEqual([
      { cc: "CN", count: 4 },
      { cc: "US", count: 1 },
      { cc: "XX", count: 1 },
    ]);
    expect(ov.visitorsToday.pages).toEqual([
      { path: "home", count: 3 },
      { path: "studio", count: 2 },
      { path: "templates", count: 1 },
    ]);
  });
});
