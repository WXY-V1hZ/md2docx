import { afterEach, describe, expect, test } from "bun:test";
import { mount, type VueWrapper } from "@vue/test-utils";

import AppSelect from "../../frontend/components/AppSelect.vue";

let activeWrapper: VueWrapper | undefined;

afterEach(() => {
  activeWrapper?.unmount();
  activeWrapper = undefined;
  document.body.replaceChildren();
});

const options = [
  { value: "first", label: "第一个一级标题" },
  { value: "single", label: "唯一的一级标题" },
  { value: "filename", label: "文件名" },
];

describe("AppSelect", () => {
  test("使用应用内菜单选择选项", async () => {
    const wrapper = mount(AppSelect, {
      props: { modelValue: "first", options, ariaLabel: "标题来源" },
      global: { stubs: { Teleport: true } },
    });
    activeWrapper = wrapper;

    await wrapper.get(".app-select__trigger").trigger("click");
    expect(wrapper.get('[role="listbox"]').attributes("aria-label")).toBe("标题来源");
    expect(wrapper.findAll('[role="option"]')[0]!.attributes("aria-selected")).toBe("true");

    await wrapper.findAll('[role="option"]')[2]!.trigger("click");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["filename"]);
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
  });

  test("支持方向键、Enter 与 Escape", async () => {
    const wrapper = mount(AppSelect, {
      props: { modelValue: "first", options, ariaLabel: "标题来源" },
      global: { stubs: { Teleport: true } },
    });
    activeWrapper = wrapper;
    const trigger = wrapper.get(".app-select__trigger");

    await trigger.trigger("keydown", { key: "Enter" });
    await trigger.trigger("keydown", { key: "ArrowDown" });
    await trigger.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["single"]);

    await trigger.trigger("keydown", { key: "Enter" });
    await trigger.trigger("keydown", { key: "Escape" });
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
  });
});
