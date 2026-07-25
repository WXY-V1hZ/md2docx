import { afterEach, describe, expect, mock, test } from "bun:test";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h } from "vue";

import { useAutoUpdate } from "../../frontend/composables/useAutoUpdate";

let activeWrapper: VueWrapper | undefined;

afterEach(() => {
  activeWrapper?.unmount();
  activeWrapper = undefined;
});

describe("useAutoUpdate", () => {
  test("先订阅再恢复状态，并在卸载时清理监听", async () => {
    const cleanup = mock(() => {});
    let listener: ((snapshot: UpdateSnapshot) => void) | undefined;
    Object.defineProperty(window, "md2docx", {
      configurable: true,
      value: {
        onUpdateState: mock((callback: (snapshot: UpdateSnapshot) => void) => {
          listener = callback;
          return cleanup;
        }),
        getUpdateState: mock(() =>
          Promise.resolve({ state: "available" as const, version: "2.7.0" }),
        ),
      },
    });

    const wrapper = mount(
      defineComponent({
        setup() {
          const updater = useAutoUpdate();
          return () => h("span", updater.visible.value ? updater.update.value.version : "hidden");
        },
      }),
    );
    activeWrapper = wrapper;
    await flushPromises();
    expect(wrapper.text()).toBe("2.7.0");

    listener?.({ state: "downloaded", version: "2.7.0" });
    await flushPromises();
    expect(wrapper.text()).toBe("2.7.0");

    wrapper.unmount();
    activeWrapper = undefined;
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test("开发预览不调用更新桥接并可模拟下载", async () => {
    const onUpdateState = mock(() => () => {});
    const getUpdateState = mock(() => Promise.resolve({ state: "idle" as const }));
    const downloadUpdate = mock(() => Promise.resolve());
    Object.defineProperty(window, "md2docx", {
      configurable: true,
      value: { onUpdateState, getUpdateState, downloadUpdate },
    });

    let updater: ReturnType<typeof useAutoUpdate> | undefined;
    const wrapper = mount(
      defineComponent({
        setup() {
          const previewUpdater = useAutoUpdate({ preview: true });
          updater = previewUpdater;
          return () => h("span", previewUpdater.update.value.state);
        },
      }),
    );
    activeWrapper = wrapper;

    expect(updater?.update.value).toMatchObject({
      state: "available",
      preview: true,
      version: "3.0.0",
    });
    expect(onUpdateState).not.toHaveBeenCalled();
    expect(getUpdateState).not.toHaveBeenCalled();

    await updater?.download();
    expect(updater?.update.value.state).toBe("downloading");
    expect(downloadUpdate).not.toHaveBeenCalled();
  });
});
