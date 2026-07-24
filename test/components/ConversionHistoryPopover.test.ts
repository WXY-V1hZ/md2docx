import { Window } from "happy-dom";
import { describe, expect, test } from "bun:test";
import { mount } from "@vue/test-utils";

import ConversionHistoryPopover from "../../frontend/components/ConversionHistoryPopover.vue";
import ConversionHistoryItem from "../../frontend/components/ConversionHistoryItem.vue";
import type { HistoryRecord } from "../../frontend/composables/useConversionManager";

// === happy-dom 环境 ===

const happyWindow = new Window();
const {
  document,
  navigator,
  HTMLElement,
  HTMLButtonElement,
  HTMLInputElement,
  customElements,
  Event,
  KeyboardEvent,
  MouseEvent,
  Node,
  Document,
  DOMParser,
  CSSStyleSheet,
  SVGElement,
} = happyWindow;

// @ts-ignore
globalThis.window = happyWindow;
// @ts-ignore
globalThis.document = document;
// @ts-ignore
globalThis.navigator = navigator;
// @ts-ignore
globalThis.HTMLElement = HTMLElement;
// @ts-ignore
globalThis.HTMLButtonElement = HTMLButtonElement;
// @ts-ignore
globalThis.HTMLInputElement = HTMLInputElement;
// @ts-ignore
globalThis.customElements = customElements;
// @ts-ignore
globalThis.Event = Event;
// @ts-ignore
globalThis.KeyboardEvent = KeyboardEvent;
// @ts-ignore
globalThis.MouseEvent = MouseEvent;
// @ts-ignore
globalThis.Node = Node;
// @ts-ignore
globalThis.Document = Document;
// @ts-ignore
globalThis.DOMParser = DOMParser;
// @ts-ignore
globalThis.CSSStyleSheet = CSSStyleSheet;
// @ts-ignore
globalThis.SVGElement = SVGElement;

// === 额外 Mock ===

Object.defineProperty(happyWindow, "matchMedia", {
  value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  writable: true,
});

Object.defineProperty(happyWindow, "md2docx", {
  value: {},
  configurable: true,
});

// === Helpers ===

function createRecord(overrides: Partial<HistoryRecord> = {}): HistoryRecord {
  return {
    id: "rec-1",
    sourcePath: "/home/user/test.md",
    sourceName: "test.md",
    outputPath: "/home/user/test.docx",
    preset: "default",
    status: "success",
    startedAt: Date.now() - 60_000,
    completedAt: Date.now(),
    unread: false,
    ...overrides,
  };
}

// === 测试 ===

describe("ConversionHistoryPopover", () => {
  test("空记录显示空状态", () => {
    const wrapper = mount(ConversionHistoryPopover, {
      props: { records: [] },
    });

    const section = wrapper.find("#conversion-history");
    expect(section.exists()).toBe(true);

    // 标题
    expect(section.find(".popover__title").text()).toBe("转换记录");

    // 空状态提示
    expect(section.find(".popover__empty").text()).toContain("暂无记录");

    // 无清除按钮
    expect(section.find(".popover__clear").exists()).toBe(false);

    // 无列表项
    expect(wrapper.findAllComponents(ConversionHistoryItem).length).toBe(0);
  });

  test("有记录时渲染列表项和清除按钮", () => {
    const records = [
      createRecord({ id: "rec-1", sourceName: "doc1.md" }),
      createRecord({ id: "rec-2", sourceName: "doc2.md" }),
    ];
    const wrapper = mount(ConversionHistoryPopover, {
      props: { records },
    });

    // 标题始终存在
    expect(wrapper.find(".popover__title").text()).toBe("转换记录");

    // 清除按钮可见
    const clearBtn = wrapper.find(".popover__clear");
    expect(clearBtn.exists()).toBe(true);
    expect(clearBtn.text()).toBe("清除");

    // TransitionGroup 使用 popover__list
    expect(wrapper.find(".popover__list").exists()).toBe(true);

    // 每个记录对应一个 item
    const items = wrapper.findAllComponents(ConversionHistoryItem);
    expect(items.length).toBe(2);
  });

  test("清除按钮点击触发 clear 事件", () => {
    const records = [createRecord()];
    const wrapper = mount(ConversionHistoryPopover, {
      props: { records },
    });

    wrapper.find(".popover__clear").trigger("click");

    expect(wrapper.emitted("clear")).toBeDefined();
    expect(wrapper.emitted("clear")!.length).toBe(1);
    // clear 事件不携带参数
    expect(wrapper.emitted("clear")![0]).toEqual([]);
  });

  test("清除按钮在全为 converting 时隐藏", () => {
    const records = [
      createRecord({ status: "converting", outputPath: undefined }),
      createRecord({ id: "rec-2", status: "converting", outputPath: undefined }),
    ];
    const wrapper = mount(ConversionHistoryPopover, {
      props: { records },
    });

    expect(wrapper.find(".popover__clear").exists()).toBe(false);
  });

  test("每个 item 接收正确的 record prop 并向上冒泡事件", () => {
    const records = [
      createRecord({ id: "rec-1", sourceName: "doc1.md" }),
      createRecord({ id: "rec-2", sourceName: "doc2.md" }),
    ];
    const wrapper = mount(ConversionHistoryPopover, {
      props: { records },
    });

    const items = wrapper.findAllComponents(ConversionHistoryItem);
    expect(items.length).toBe(2);

    // 验证 prop 传递
    // @ts-expect-error - "record" is a known prop, but @vue/test-utils types are imprecise for SFC props
    expect(items[0]!.props("record")).toEqual(records[0]);
    // @ts-expect-error - same as above
    expect(items[1]!.props("record")).toEqual(records[1]);

    // openFile 冒泡
    items[0]!.vm.$emit("openFile", records[0]!.outputPath!);
    expect(wrapper.emitted("openFile")).toBeDefined();
    expect(wrapper.emitted("openFile")![0]).toEqual([records[0]!.outputPath!]);

    // showInFolder 冒泡
    items[1]!.vm.$emit("showInFolder", records[1]!.outputPath!);
    expect(wrapper.emitted("showInFolder")).toBeDefined();
    expect(wrapper.emitted("showInFolder")![0]).toEqual([records[1]!.outputPath!]);

    // regenerate 冒泡
    items[1]!.vm.$emit("regenerate", records[1]!.id);
    expect(wrapper.emitted("regenerate")).toBeDefined();
    expect(wrapper.emitted("regenerate")![0]).toEqual([records[1]!.id]);

    // removeRecord 冒泡（子组件 emit 'remove'，父组件 re-emit 为 'removeRecord'）
    items[0]!.vm.$emit("remove", records[0]!.id);
    expect(wrapper.emitted("removeRecord")).toBeDefined();
    expect(wrapper.emitted("removeRecord")![0]).toEqual([records[0]!.id]);
  });
});
