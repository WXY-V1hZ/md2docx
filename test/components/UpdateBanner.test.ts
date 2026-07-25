import { afterEach, describe, expect, test } from "bun:test";
import { mount, type VueWrapper } from "@vue/test-utils";

import UpdateBanner from "../../frontend/components/UpdateBanner.vue";

let activeWrapper: VueWrapper | undefined;

afterEach(() => {
  activeWrapper?.unmount();
  activeWrapper = undefined;
});

describe("UpdateBanner", () => {
  test("可用状态显示版本并触发下载", async () => {
    const wrapper = mount(UpdateBanner, {
      props: { update: { state: "available", version: "2.7.0" } },
    });
    activeWrapper = wrapper;

    expect(wrapper.text()).toContain("md2docx 2.7.0 可以下载");
    await wrapper.get(".update-banner__button--primary").trigger("click");
    expect(wrapper.emitted("download")).toHaveLength(1);
  });

  test("下载状态提供可访问进度和稳定速率", () => {
    const wrapper = mount(UpdateBanner, {
      props: {
        update: {
          state: "downloading",
          version: "2.7.0",
          progress: 42.4,
          bytesPerSecond: 1.5 * 1024 * 1024,
        },
      },
    });
    activeWrapper = wrapper;

    expect(wrapper.text()).toContain("42% · 1.5 MB/s");
    expect(wrapper.get('[role="progressbar"]').attributes("aria-valuenow")).toBe("42");
    expect(wrapper.find(".update-banner__close").exists()).toBe(false);
  });

  test("失败状态显示友好信息并允许重试或关闭", async () => {
    const wrapper = mount(UpdateBanner, {
      props: {
        update: {
          state: "error",
          message: "无法连接更新服务器，请检查网络后重试。",
          retry: "check",
        },
      },
    });
    activeWrapper = wrapper;

    expect(wrapper.text()).not.toContain("ERR_");
    await wrapper.get(".update-banner__button").trigger("click");
    await wrapper.get(".update-banner__close").trigger("click");
    expect(wrapper.emitted("retry")).toHaveLength(1);
    expect(wrapper.emitted("dismiss")).toHaveLength(1);
  });

  test("开发预览带有明确标记", () => {
    const wrapper = mount(UpdateBanner, {
      props: {
        update: {
          state: "available",
          version: "3.0.0",
          preview: true,
        },
      },
    });
    activeWrapper = wrapper;

    expect(wrapper.get(".update-banner__preview").text()).toBe("预览");
  });
});
