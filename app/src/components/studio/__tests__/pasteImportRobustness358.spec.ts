// @vitest-environment jsdom
/**
 * 第 358 轮：粘贴导入鲁棒性 —— 超大文本不抛 RangeError 而是业务行数上限错误；
 * 面板解析 300ms 去抖、超过 2000 字符改为手动解析；映射面板列出未使用列。
 */
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DataImportPanel from "@/components/studio/DataImportPanel.vue";
import MappingPanel from "@/components/studio/MappingPanel.vue";
import { setLocale } from "@/i18n";
import { createAppRouter } from "@/router";
import { useWorkspaceStore } from "@/stores/workspace";
import * as excel from "@/utils/excel";
import {
  IMPORT_TOO_MANY_ROWS_MESSAGE,
  PASTE_MANUAL_PARSE_THRESHOLD,
  PASTE_PARSE_DEBOUNCE_MS,
} from "@/utils/importLimits";

describe("第 358 轮：parsePastedRoster 大文本", () => {
  it("70000 行粘贴：不抛 RangeError，抛出与文件导入同口径的行数上限错误", () => {
    const text = Array.from(
      { length: 70_000 },
      (_, i) => `姓名${i}\t班级${i % 30}`,
    ).join("\n");
    let caught: unknown;
    try {
      excel.parsePastedRoster(text);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RangeError);
    expect((caught as Error).message).toBe(IMPORT_TOO_MANY_ROWS_MESSAGE);
  });

  it("正常样本 a,b\\n1,2 解析结果不变", () => {
    expect(excel.parsePastedRoster("a,b\n1,2")).toEqual({
      headers: ["姓名", "列2"],
      rows: [
        { 姓名: "a", 列2: "b" },
        { 姓名: "1", 列2: "2" },
      ],
      headerDetected: false,
    });
    expect(excel.parsePastedRoster("姓名,班级\n张伟,一班")).toEqual({
      headers: ["姓名", "班级"],
      rows: [{ 姓名: "张伟", 班级: "一班" }],
      headerDetected: true,
    });
  });
});

describe("第 358 轮：DataImportPanel 粘贴解析去抖 / 手动解析", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function openPaste() {
    const wrapper = mount(DataImportPanel, {
      attachTo: document.body,
      global: { plugins: [createAppRouter()], stubs: { RouterLink: true } },
    });
    await wrapper.vm.$nextTick();
    const openBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("粘贴名单"))!;
    await openBtn.trigger("click");
    await wrapper.vm.$nextTick();
    const textarea = document.body.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="粘贴名单内容"]',
    )!;
    expect(textarea).toBeTruthy();
    return { wrapper, textarea };
  }

  async function type(textarea: HTMLTextAreaElement, value: string) {
    textarea.value = value;
    textarea.dispatchEvent(new Event("input"));
    await Promise.resolve();
  }

  it("连续输入 5 次只解析 1 次（300ms 去抖），到时后摘要渲染出识别行数", async () => {
    const spy = vi.spyOn(excel, "parsePastedRoster");
    const { wrapper, textarea } = await openPaste();
    for (let i = 1; i <= 5; i++) {
      await type(
        textarea,
        Array.from({ length: i }, (_, k) => `甲${k}`).join("\n"),
      );
      await vi.advanceTimersByTimeAsync(PASTE_PARSE_DEBOUNCE_MS - 50);
    }
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(PASTE_PARSE_DEBOUNCE_MS);
    expect(spy).toHaveBeenCalledTimes(1);
    await wrapper.vm.$nextTick();
    const summary = document.body.querySelector(
      '[data-testid="paste-summary"]',
    );
    expect(summary?.textContent).toContain("5");
    wrapper.unmount();
  });

  it("超过 2000 字符：不再自动解析，出现「解析名单」按钮，点击后才解析一次", async () => {
    const spy = vi.spyOn(excel, "parsePastedRoster");
    const { wrapper, textarea } = await openPaste();
    const big = Array.from(
      { length: 400 },
      (_, i) => `甲${String(i).padStart(6, "0")}`,
    ).join("\n");
    expect(big.length).toBeGreaterThan(PASTE_MANUAL_PARSE_THRESHOLD);
    await type(textarea, big);
    await vi.advanceTimersByTimeAsync(PASTE_PARSE_DEBOUNCE_MS * 5);
    await wrapper.vm.$nextTick();
    expect(spy).not.toHaveBeenCalled();
    expect(
      document.body.querySelector('[data-testid="paste-summary"]'),
    ).toBeNull();
    const parseBtn = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="paste-parse-button"]',
    );
    expect(parseBtn).toBeTruthy();
    parseBtn!.click();
    await wrapper.vm.$nextTick();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(
      document.body.querySelector('[data-testid="paste-summary"]')?.textContent,
    ).toContain("400");
    wrapper.unmount();
  });

  it("超过行数上限：面板显示业务错误文案而不是崩溃", async () => {
    const { wrapper, textarea } = await openPaste();
    const tooMany = Array.from({ length: 10_001 }, (_, i) => `n${i}`).join(
      "\n",
    );
    await type(textarea, tooMany);
    document.body
      .querySelector<HTMLButtonElement>('[data-testid="paste-parse-button"]')!
      .click();
    await wrapper.vm.$nextTick();
    expect(
      document.body.querySelector('[data-testid="paste-error"]')?.textContent,
    ).toBe(IMPORT_TOO_MANY_ROWS_MESSAGE);
    wrapper.unmount();
  });
});

describe("第 358 轮：MappingPanel 未使用列提示", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });
  afterEach(async () => {
    await setLocale("zh");
  });

  function seed() {
    const ws = useWorkspaceStore();
    ws.excel.headers = ["姓名", "考场", "职务", "备注"];
    ws.excel.rows = [{ 姓名: "甲", 考场: "3", 职务: "主任", 备注: "x" }];
    const name = ws.mappableFields.find((f) => f.label === "姓名")!;
    const room = ws.mappableFields.find((f) => f.label === "考场")!;
    for (const f of ws.mappableFields) {
      ws.setMappingValue(
        f.id,
        f.id === name.id ? "姓名" : f.id === room.id ? "考场" : "",
      );
    }
    return ws;
  }

  it("4 列仅映射 2 列：渲染出剩余列名（中文顿号分隔）", async () => {
    seed();
    const wrapper = mount(MappingPanel, {
      global: { plugins: [createAppRouter()], stubs: { RouterLink: true } },
    });
    await wrapper.vm.$nextTick();
    const hint = wrapper.get('[data-testid="mapping-unused-columns"]');
    expect(hint.text()).toBe("未使用列：职务、备注");
    expect(hint.classes()).toContain("text-slate-400");
    wrapper.unmount();
  });

  it("英文：Unused columns 文案；全部列被使用（含组合映射）时不渲染", async () => {
    const ws = seed();
    await setLocale("en");
    const wrapper = mount(MappingPanel, {
      global: { plugins: [createAppRouter()], stubs: { RouterLink: true } },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="mapping-unused-columns"]').text()).toBe(
      "Unused columns: 职务, 备注",
    );

    const room = ws.mappableFields.find((f) => f.label === "考场")!;
    ws.setMappingValue(room.id, "{考场}-{职务}-{备注}");
    await wrapper.vm.$nextTick();
    expect(
      wrapper.find('[data-testid="mapping-unused-columns"]').exists(),
    ).toBe(false);
    wrapper.unmount();
  });
});
