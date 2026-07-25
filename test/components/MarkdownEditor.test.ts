import { describe, expect, test } from "bun:test";
import { mount } from "@vue/test-utils";

import MarkdownEditor from "../../frontend/components/MarkdownEditor.vue";

describe("MarkdownEditor", () => {
  test("输入文档名和 Markdown 内容并显示统计", async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        name: "未命名",
        content: "",
        disabled: false,
      },
    });

    await wrapper.get<HTMLInputElement>('input[aria-label="文档名称"]').setValue("实验报告");
    await wrapper
      .get<HTMLTextAreaElement>('textarea[aria-label="Markdown 内容"]')
      .setValue("# 标题\n\n正文");
    await wrapper.setProps({ content: "# 标题\n\n正文" } as never);

    expect(wrapper.emitted("update:name")?.at(-1)).toEqual(["实验报告"]);
    expect(wrapper.emitted("update:content")?.at(-1)).toEqual(["# 标题\n\n正文"]);
    expect(wrapper.text()).toContain("3 行");
    expect(wrapper.text()).toContain("8 字符");
  });

  test("转换期间禁用编辑并显示就地错误", () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        name: "文档",
        content: "# 标题",
        disabled: true,
        error: "Pandoc 不可用",
      },
    });

    expect(wrapper.get("textarea").attributes()).toHaveProperty("disabled");
    expect(wrapper.get("input").attributes()).toHaveProperty("disabled");
    expect(wrapper.text()).toContain("Pandoc 不可用");
    expect(wrapper.get('[role="alert"]').classes()).toContain("markdown-editor__error");
    expect(wrapper.find("footer").exists()).toBe(false);
  });
});
