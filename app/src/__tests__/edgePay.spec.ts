/**
 * 支付链路测试：edge-functions/api/[[default]].js + _alipay.js
 *
 * 用真实 WebCrypto RSA2 密钥对走完整协议：
 * - APP 密钥对充当 ALIPAY_PRIVATE_KEY（下单签名）；
 * - 另一对「支付宝」密钥对的公钥充当 ALIPAY_PUBLIC_KEY（验签），
 *   其私钥在测试里模拟支付宝给异步通知/网关响应签名。
 * 因此 notify 验签、查询补偿验签、幂等发放都是真密码学校验，不是桩。
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest } from "../../../edge-functions/api/[[default]].js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { signContent } from "../../../edge-functions/api/_alipay.js";

const BASE = "https://www.seatmark.cn";
const PASSWORD = "super-secret-1";

/** 内存 KV（模拟 seatmark_kv 绑定） */
function createKv() {
  const data = new Map<string, string>();
  return {
    data,
    async get(key: string) {
      return data.has(key) ? (data.get(key) as string) : null;
    },
    async put(key: string, value: string) {
      data.set(key, String(value));
    },
    async delete(key: string) {
      data.delete(key);
    },
    async list({ prefix = "", limit = 256, cursor = "" } = {}) {
      const keys = [...data.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? keys.indexOf(cursor) + 1 : 0;
      const page = keys.slice(start, start + limit);
      const hasMore = start + limit < keys.length;
      return {
        keys: page.map((name) => ({ name })),
        complete: !hasMore,
        cursor: hasMore ? page[page.length - 1] : null,
      };
    },
  };
}

type Kv = ReturnType<typeof createKv>;

interface Env {
  [key: string]: unknown;
  seatmark_kv?: Kv;
}

function testEnv(env: Env = {}): Env {
  return {
    AUTH_SECRET: "test-secret",
    ADMIN_EMAILS: "admin@seatmark.cn",
    SEATMARK_ALLOW_MEMORY_STORAGE: "1",
    DEV: "1",
    ...env,
  };
}

/** 生成 RSA2 密钥对 → { privateKeyPkcs8B64, publicKeySpkiB64, privateKey } */
async function genRsaPair() {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  const b64 = (buf: ArrayBuffer) => Buffer.from(buf).toString("base64");
  return { privateKeyB64: b64(pkcs8), publicKeyB64: b64(spki), privateKey: pair.privateKey };
}

async function rsaSign(privateKey: CryptoKey, content: string) {
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(content),
  );
  return Buffer.from(sig).toString("base64");
}

/** 用「支付宝」私钥给通知/响应参数签名（模拟真实支付宝私钥不可得的镜像侧） */
async function alipaySignParams(privateKey: CryptoKey, params: Record<string, string>) {
  const { sign, sign_type, ...rest } = params;
  return rsaSign(privateKey, signContent(rest));
}

let appKeys: Awaited<ReturnType<typeof genRsaPair>>;
let alipayKeys: Awaited<ReturnType<typeof genRsaPair>>;

function payEnv(kv: Kv, extra: Env = {}): Env {
  return testEnv({
    seatmark_kv: kv,
    ALIPAY_APP_ID: "2021000000000001",
    ALIPAY_PRIVATE_KEY: appKeys.privateKeyB64,
    ALIPAY_PUBLIC_KEY: alipayKeys.publicKeyB64,
    ALIPAY_GATEWAY: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
    ALIPAY_SELLER_ID: "2088100000000001",
    ...extra,
  });
}

async function call(
  method: string,
  path: string,
  {
    body,
    rawBody,
    contentType,
    env,
    cookie,
  }: {
    body?: unknown;
    rawBody?: string;
    contentType?: string;
    env?: Env;
    cookie?: string;
  } = {},
) {
  const headers = new Headers();
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (contentType) headers.set("Content-Type", contentType);
  if (cookie) headers.set("Cookie", cookie);
  const request = new Request(`${BASE}${path}`, {
    method,
    headers,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const response = await onRequest({ request, env: testEnv(env) });
  const text = await response.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // notify 返回纯文本 success/fail
  }
  return { response, data, text };
}

async function solvedCaptcha(env: Env) {
  const res = await onRequest({
    request: new Request(`${BASE}/api/auth/captcha`),
    env: testEnv(env),
  });
  const data = (await res.json()) as { token: string; image: string };
  const b64 = data.image.replace(/^data:image\/svg\+xml;base64,/, "");
  const svg = Buffer.from(b64, "base64").toString("utf-8");
  const answer = [...svg.matchAll(/<text [^>]*>([^<])<\/text>/g)].map((m) => m[1]).join("");
  if (answer.length !== 4) throw new Error(`无法解析验证码图片字符：${svg}`);
  return { captchaToken: data.token, captchaAnswer: answer.toLowerCase() };
}

async function registerUser(kv: Kv, email: string, env: Env = {}) {
  const body = { email, password: PASSWORD, ...(await solvedCaptcha({ seatmark_kv: kv, ...env })) };
  const { response } = await call("POST", "/api/auth/register", {
    body,
    env: { seatmark_kv: kv, ...env },
  });
  expect(response.status).toBe(200);
  const cookie = (response.headers.get("Set-Cookie") || "").split(";")[0];
  expect(cookie).toContain("sm_session=");
  return cookie;
}

/** 直接写 KV 造一个待支付订单（等价 POST /api/pay/order 的产物） */
async function seedOrder(kv: Kv, email: string, overrides: Record<string, unknown> = {}) {
  const order = {
    no: `SMTEST${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    email,
    plan: "pro-30",
    amount: "5.90",
    days: 30,
    subject: "SeatMark 专业版（30 天）",
    status: "wait_pay",
    createdAt: new Date().toISOString(),
    lastQueryAt: 0,
    events: [],
    ...overrides,
  };
  await kv.put(`payorder:${order.no}`, JSON.stringify(order));
  return order;
}

async function buildNotifyBody(order: { no: string; amount: string }, overrides: Record<string, string> = {}) {
  const params: Record<string, string> = {
    app_id: "2021000000000001",
    auth_app_id: "2021000000000001",
    charset: "utf-8",
    gmt_create: "2025-01-01 10:00:00",
    gmt_payment: "2025-01-01 10:00:10",
    notify_id: `nid-${Math.random().toString(36).slice(2)}`,
    notify_time: "2025-01-01 10:00:12",
    notify_type: "trade_status_sync",
    out_trade_no: order.no,
    seller_id: "2088100000000001",
    seller_email: "sandbox-seller@alipay.com",
    sign_type: "RSA2",
    subject: "SeatMark 专业版（30 天）",
    total_amount: order.amount,
    trade_no: `2025${Math.random().toString().slice(2, 18)}`,
    trade_status: "TRADE_SUCCESS",
    version: "1.0",
    ...overrides,
  };
  // 显式传入的 sign（如伪造签名用例）优先生效；否则按支付宝规则签名
  params.sign = Object.hasOwn(overrides, "sign")
    ? overrides.sign
    : await alipaySignParams(alipayKeys.privateKey, params);
  return new URLSearchParams(params).toString();
}

async function getProUntil(kv: Kv, email: string) {
  const raw = await kv.get(`user:${email}`);
  const user = JSON.parse(raw || "{}") as { proUntil?: string };
  return user.proUntil ? Date.parse(user.proUntil) : 0;
}

beforeAll(async () => {
  appKeys = await genRsaPair();
  alipayKeys = await genRsaPair();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/pay/order 下单", () => {
  it("未登录 → 401", async () => {
    const kv = createKv();
    const { response, data } = await call("POST", "/api/pay/order", {
      body: { plan: "pro-30" },
      env: payEnv(kv),
    });
    expect(response.status).toBe(401);
    expect((data as { error: string }).error).toBe("请先登录");
  });

  it("缺支付配置 → 503 pay_not_configured（fail closed）", async () => {
    const kv = createKv();
    const cookie = await registerUser(kv, "nocfg@example.com");
    const { response, data } = await call("POST", "/api/pay/order", {
      body: { plan: "pro-30" },
      env: testEnv({ seatmark_kv: kv }),
      cookie,
    });
    expect(response.status).toBe(503);
    expect((data as { code: string }).code).toBe("pay_not_configured");
  });

  it("下单成功 → 收银台表单含签名参数，订单落 KV 为 wait_pay", async () => {
    const kv = createKv();
    const cookie = await registerUser(kv, "buyer@example.com");
    const { response, data } = await call("POST", "/api/pay/order", {
      body: { plan: "pro-30" },
      env: payEnv(kv),
      cookie,
    });
    expect(response.status).toBe(200);
    const d = data as { orderNo: string; amount: string; days: number; paymentHtml: string };
    expect(d.orderNo).toMatch(/^SM/);
    expect(d.amount).toBe("5.90");
    expect(d.days).toBe(30);
    expect(d.paymentHtml).toContain("alipay.trade.page.pay");
    expect(d.paymentHtml).toContain("FAST_INSTANT_TRADE_PAY");
    expect(d.paymentHtml).toContain('name="sign"');
    // out_trade_no 等订单字段在 biz_content JSON 内（HTML 转义后反转义解析）
    const getVal = (name: string) => {
      const m = d.paymentHtml.match(new RegExp(`name="${name}" value="([^"]*)"`));
      return m ? m[1] : null;
    };
    const biz = JSON.parse(
      (getVal("biz_content") || "")
        .replaceAll("&quot;", '"')
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&amp;", "&"),
    ) as { out_trade_no: string; total_amount: string; product_code: string };
    expect(biz.out_trade_no).toBe(d.orderNo);
    expect(biz.total_amount).toBe("5.90");
    expect(biz.product_code).toBe("FAST_INSTANT_TRADE_PAY");
    expect(getVal("sign")).toBeTruthy();
    const orderRaw = await kv.get(`payorder:${d.orderNo}`);
    const order = JSON.parse(orderRaw || "{}") as { status: string; email: string; amount: string };
    expect(order.status).toBe("wait_pay");
    expect(order.email).toBe("buyer@example.com");
    expect(order.amount).toBe("5.90");
  });

  it("团队版 team-30 下单 → ¥19.90，订单 plan 标记 team-30", async () => {
    const kv = createKv();
    const cookie = await registerUser(kv, "teambuyer@example.com");
    const { response, data } = await call("POST", "/api/pay/order", {
      body: { plan: "team-30" },
      env: payEnv(kv),
      cookie,
    });
    expect(response.status).toBe(200);
    const d = data as { orderNo: string; amount: string; days: number };
    expect(d.amount).toBe("19.90");
    expect(d.days).toBe(30);
    const order = JSON.parse((await kv.get(`payorder:${d.orderNo}`)) || "{}") as {
      plan: string;
      amount: string;
    };
    expect(order.plan).toBe("team-30");
    expect(order.amount).toBe("19.90");
  });

  it("未知套餐 → 400", async () => {
    const kv = createKv();
    const cookie = await registerUser(kv, "badplan@example.com");
    const { response } = await call("POST", "/api/pay/order", {
      body: { plan: "team-forever" },
      env: payEnv(kv),
      cookie,
    });
    expect(response.status).toBe(400);
  });
});

describe("POST /api/pay/notify 异步通知", () => {
  it("验签通过 + TRADE_SUCCESS → success，订单 paid 且天数到账", async () => {
    const kv = createKv();
    await registerUser(kv, "paid@example.com");
    const order = await seedOrder(kv, "paid@example.com");
    const body = await buildNotifyBody(order);
    const { response, text } = await call("POST", "/api/pay/notify", {
      rawBody: body,
      contentType: "application/x-www-form-urlencoded",
      env: payEnv(kv),
    });
    expect(response.status).toBe(200);
    expect(text).toBe("success");
    const stored = JSON.parse((await kv.get(`payorder:${order.no}`)) || "{}") as {
      status: string;
      tradeNo: string;
      paidSource: string;
    };
    expect(stored.status).toBe("paid");
    expect(stored.tradeNo).toBeTruthy();
    expect(stored.paidSource).toBe("notify");
    const until = await getProUntil(kv, "paid@example.com");
    expect(until).toBeGreaterThan(Date.now() + 29 * 86400000);
  });

  it("同一 notify_id 重复投递 → success 且不重复发放", async () => {
    const kv = createKv();
    await registerUser(kv, "dup@example.com");
    const order = await seedOrder(kv, "dup@example.com");
    const params = Object.fromEntries(new URLSearchParams(await buildNotifyBody(order)));
    const body = new URLSearchParams(params).toString();
    const first = await call("POST", "/api/pay/notify", {
      rawBody: body,
      contentType: "application/x-www-form-urlencoded",
      env: payEnv(kv),
    });
    expect(first.text).toBe("success");
    const untilAfterFirst = await getProUntil(kv, "dup@example.com");
    const second = await call("POST", "/api/pay/notify", {
      rawBody: body,
      contentType: "application/x-www-form-urlencoded",
      env: payEnv(kv),
    });
    expect(second.text).toBe("success");
    const untilAfterSecond = await getProUntil(kv, "dup@example.com");
    expect(untilAfterSecond).toBe(untilAfterFirst);
  });

  it("签名无效 → fail，订单不发放", async () => {
    const kv = createKv();
    await registerUser(kv, "badsgn@example.com");
    const order = await seedOrder(kv, "badsgn@example.com");
    const before = await getProUntil(kv, "badsgn@example.com");
    const body = await buildNotifyBody(order, { sign: "invalid-signature==" });
    const { text } = await call("POST", "/api/pay/notify", {
      rawBody: body,
      contentType: "application/x-www-form-urlencoded",
      env: payEnv(kv),
    });
    expect(text).toBe("fail");
    const stored = JSON.parse((await kv.get(`payorder:${order.no}`)) || "{}") as { status: string };
    expect(stored.status).toBe("wait_pay");
    // 注册送 7 天试用，断言未因伪造通知追加发放
    expect(await getProUntil(kv, "badsgn@example.com")).toBe(before);
  });

  it("金额与本地订单不一致 → fail，不发放", async () => {
    const kv = createKv();
    await registerUser(kv, "amt@example.com");
    const order = await seedOrder(kv, "amt@example.com");
    const body = await buildNotifyBody(order, { total_amount: "0.01" });
    const { text } = await call("POST", "/api/pay/notify", {
      rawBody: body,
      contentType: "application/x-www-form-urlencoded",
      env: payEnv(kv),
    });
    expect(text).toBe("fail");
    const stored = JSON.parse((await kv.get(`payorder:${order.no}`)) || "{}") as { status: string };
    expect(stored.status).toBe("wait_pay");
  });

  it("seller_id 与配置不符 → fail", async () => {
    const kv = createKv();
    await registerUser(kv, "seller@example.com");
    const order = await seedOrder(kv, "seller@example.com");
    const body = await buildNotifyBody(order, { seller_id: "9999999999999999" });
    const { text } = await call("POST", "/api/pay/notify", {
      rawBody: body,
      contentType: "application/x-www-form-urlencoded",
      env: payEnv(kv),
    });
    expect(text).toBe("fail");
    const stored = JSON.parse((await kv.get(`payorder:${order.no}`)) || "{}") as { status: string };
    expect(stored.status).toBe("wait_pay");
  });

  it("app_id 不匹配 → fail", async () => {
    const kv = createKv();
    await registerUser(kv, "appid@example.com");
    const order = await seedOrder(kv, "appid@example.com");
    const body = await buildNotifyBody(order, { app_id: "9999999999999999" });
    const { text } = await call("POST", "/api/pay/notify", {
      rawBody: body,
      contentType: "application/x-www-form-urlencoded",
      env: payEnv(kv),
    });
    expect(text).toBe("fail");
  });

  it("未知订单号 → fail", async () => {
    const kv = createKv();
    const body = await buildNotifyBody({ no: "SMMISSING", amount: "19.00" });
    const { text } = await call("POST", "/api/pay/notify", {
      rawBody: body,
      contentType: "application/x-www-form-urlencoded",
      env: payEnv(kv),
    });
    expect(text).toBe("fail");
  });

  it("带退款字段的成功态通知 → success 但不发放（退款事件不误判为收款）", async () => {
    const kv = createKv();
    await registerUser(kv, "refundevt@example.com");
    const order = await seedOrder(kv, "refundevt@example.com");
    const refundEvtBefore = await getProUntil(kv, "refundevt@example.com");
    const body = await buildNotifyBody(order, {
      trade_status: "TRADE_SUCCESS",
      gmt_refund: "2025-01-02 10:00:00",
      refund_fee: "19.00",
      out_biz_no: "RQ1",
    });
    const { text } = await call("POST", "/api/pay/notify", {
      rawBody: body,
      contentType: "application/x-www-form-urlencoded",
      env: payEnv(kv),
    });
    expect(text).toBe("success");
    const stored = JSON.parse((await kv.get(`payorder:${order.no}`)) || "{}") as {
      status: string;
      events: { status: string }[];
    };
    expect(stored.status).toBe("wait_pay");
    expect(stored.events.length).toBeGreaterThan(0);
    expect(await getProUntil(kv, "refundevt@example.com")).toBe(refundEvtBefore);
  });
});

describe("GET /api/pay/order 订单查询与补偿", () => {
  it("非订单所有者 → 404", async () => {
    const kv = createKv();
    await registerUser(kv, "owner@example.com");
    const otherCookie = await registerUser(kv, "other@example.com");
    const order = await seedOrder(kv, "owner@example.com");
    const { response } = await call("GET", `/api/pay/order?no=${order.no}`, {
      env: payEnv(kv),
      cookie: otherCookie,
    });
    expect(response.status).toBe(404);
  });

  it("不 refresh 时不发起网关请求", async () => {
    const kv = createKv();
    const cookie = await registerUser(kv, "q@example.com");
    const order = await seedOrder(kv, "q@example.com");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { response, data } = await call("GET", `/api/pay/order?no=${order.no}`, {
      env: payEnv(kv),
      cookie,
    });
    expect(response.status).toBe(200);
    expect((data as { order: { status: string } }).order.status).toBe("wait_pay");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refresh=1 时交易查询补偿：网关验签通过且 TRADE_SUCCESS → paid + 发放", async () => {
    const kv = createKv();
    const cookie = await registerUser(kv, "comp@example.com");
    const order = await seedOrder(kv, "comp@example.com");

    // 模拟支付宝网关：响应体节点用「支付宝」私钥签名（alipayExec 必须验签通过才采信）
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const headers = new Headers((init as RequestInit | undefined)?.headers);
      expect(headers.get("Content-Type")).toContain("application/x-www-form-urlencoded");
      const reqParams = Object.fromEntries(
        new URLSearchParams(String((init as RequestInit | undefined)?.body ?? "")),
      );
      expect(reqParams.method).toBe("alipay.trade.query");
      expect(reqParams.app_id).toBe("2021000000000001");
      expect(reqParams.sign).toBeTruthy();
      const nodeJson = JSON.stringify({
        code: "10000",
        msg: "Success",
        out_trade_no: order.no,
        trade_no: "2025010100000001",
        trade_status: "TRADE_SUCCESS",
        total_amount: "5.90",
        buyer_logon_id: "san***@sandbox.com",
        buyer_user_id: "2088000000000001",
      });
      const sign = await rsaSign(alipayKeys.privateKey, nodeJson);
      return new Response(JSON.stringify({ alipay_trade_query_response: JSON.parse(nodeJson), sign }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const { response, data } = await call("GET", `/api/pay/order?no=${order.no}&refresh=1`, {
      env: payEnv(kv),
      cookie,
    });
    expect(response.status).toBe(200);
    const d = data as { order: { status: string; tradeNo: string }; pro: { active: boolean } };
    expect(d.order.status).toBe("paid");
    expect(d.order.tradeNo).toBe("2025010100000001");
    expect(d.pro.active).toBe(true);
    const stored = JSON.parse((await kv.get(`payorder:${order.no}`)) || "{}") as { paidSource: string };
    expect(stored.paidSource).toBe("query");
    expect(await getProUntil(kv, "comp@example.com")).toBeGreaterThan(0);
  });

  it("refresh=1 时网关响应验签失败 → 订单不发放（防伪造响应）", async () => {
    const kv = createKv();
    const cookie = await registerUser(kv, "forge@example.com");
    const order = await seedOrder(kv, "forge@example.com");
    const forgeBefore = await getProUntil(kv, "forge@example.com");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          alipay_trade_query_response: {
            code: "10000",
            msg: "Success",
            out_trade_no: order.no,
            trade_no: "2025010100000001",
            trade_status: "TRADE_SUCCESS",
            total_amount: "5.90",
          },
          sign: "forged-signature==",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const { response, data } = await call("GET", `/api/pay/order?no=${order.no}&refresh=1`, {
      env: payEnv(kv),
      cookie,
    });
    expect(response.status).toBe(200);
    expect((data as { order: { status: string } }).order.status).toBe("wait_pay");
    expect(await getProUntil(kv, "forge@example.com")).toBe(forgeBefore);
  });
});

describe("管理端支付接口", () => {
  it("非管理员 → 403", async () => {
    const kv = createKv();
    const cookie = await registerUser(kv, "notadmin@example.com");
    const { response } = await call("GET", "/api/admin/orders", {
      env: payEnv(kv),
      cookie,
    });
    expect(response.status).toBe(403);
  });

  it("管理员可见订单列表", async () => {
    const kv = createKv();
    const adminCookie = await registerUser(kv, "admin@seatmark.cn");
    await seedOrder(kv, "admin@seatmark.cn", { no: "SMADMINLIST1" });
    const { response, data } = await call("GET", "/api/admin/orders", {
      env: payEnv(kv),
      cookie: adminCookie,
    });
    expect(response.status).toBe(200);
    const orders = (data as { orders: { no: string }[] }).orders;
    expect(orders.some((o) => o.no === "SMADMINLIST1")).toBe(true);
  });

  it("已支付订单可退款：网关确认 fund_change=Y 后落 refunded", async () => {
    const kv = createKv();
    const adminCookie = await registerUser(kv, "admin@seatmark.cn");
    const order = await seedOrder(kv, "admin@seatmark.cn", { status: "paid", tradeNo: "T1" });
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      const nodeJson = JSON.stringify({
        code: "10000",
        msg: "Success",
        trade_no: "T1",
        out_trade_no: order.no,
        buyer_logon_id: "san***@sandbox.com",
        buyer_user_id: "2088000000000001",
        refund_fee: "5.90",
        fund_change: "Y",
        out_request_no: "RQTEST1",
      });
      const sign = await rsaSign(alipayKeys.privateKey, nodeJson);
      return new Response(JSON.stringify({ alipay_trade_refund_response: JSON.parse(nodeJson), sign }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const { response, data } = await call("POST", "/api/admin/pay/refund", {
      body: { orderNo: order.no, reason: "test refund" },
      env: payEnv(kv),
      cookie: adminCookie,
    });
    expect(response.status).toBe(200);
    const d = data as { ok: boolean; status: string; refundedFee: string };
    expect(d.ok).toBe(true);
    expect(d.status).toBe("refunded");
    expect(d.refundedFee).toBe("5.90");
  });

  it("未支付订单不可退款", async () => {
    const kv = createKv();
    const adminCookie = await registerUser(kv, "admin@seatmark.cn");
    const order = await seedOrder(kv, "admin@seatmark.cn");
    const { response } = await call("POST", "/api/admin/pay/refund", {
      body: { orderNo: order.no },
      env: payEnv(kv),
      cookie: adminCookie,
    });
    expect(response.status).toBe(409);
  });
});
