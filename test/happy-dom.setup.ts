import { Window } from "happy-dom";

// ── Happy DOM globals ───────────────────────────────────────────────
const win = new Window();
const globalKeys = [
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "customElements",
  "Event",
  "KeyboardEvent",
  "MouseEvent",
  "Node",
  "Document",
  "DOMParser",
  "CSSStyleSheet",
  "SVGElement",
  "HTMLDivElement",
  "HTMLSpanElement",
  "HTMLTemplateElement",
  "HTMLUListElement",
  "HTMLLIElement",
  "Comment",
  "Text",
  "DocumentFragment",
  "HTMLParagraphElement",
  "HTMLAnchorElement",
  "HTMLImageElement",
  "HTMLBRElement",
  "Element",
  "NodeList",
  "HTMLCollection",
  "DOMTokenList",
  "Attr",
  "NamedNodeMap",
  "MutationObserver",
  "InputEvent",
  "FocusEvent",
  "WheelEvent",
  "PointerEvent",
  "CustomEvent",
  "UIEvent",
  "HTMLStyleElement",
  "HTMLMetaElement",
  "HTMLLabelElement",
  "HTMLSelectElement",
  "HTMLOptionElement",
  "HTMLFormElement",
  "DOMRect",
  "DOMRectReadOnly",
  "DOMException",
  "Range",
  "Selection",
  "XMLSerializer",
] as const;
for (const key of globalKeys) {
  // @ts-ignore
  globalThis[key] = win[key];
}
// @ts-ignore
globalThis.window = win;
// @ts-ignore
globalThis.self = win;

// ── Bun plugin: compile .vue SFC imports ────────────────────────────
import { plugin } from "bun";

plugin({
  name: "vue-sfc",
  setup(build) {
    build.onLoad({ filter: /\.vue$/ }, async (args) => {
      const { parse, compileScript, compileTemplate } = await import("vue/compiler-sfc");
      const source = await Bun.file(args.path).text();
      const { descriptor, errors } = parse(source);

      if (errors.length > 0) {
        throw new Error(`Failed to parse ${args.path}: ${errors.join(", ")}`);
      }

      let code = "";

      if (descriptor.script || descriptor.scriptSetup) {
        const compiledScript = compileScript(descriptor, {
          id: "test",
          babelParserPlugins: ["typescript"],
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const bindings = compiledScript.bindings;
        // Replace `export default` → variable assignment
        code = compiledScript.content.replace(/export\s+default\s+/, "var __vue_component__ = ");
        code += ";\n";

        if (descriptor.template) {
          const compiledTemplate = compileTemplate({
            source: descriptor.template.content,
            filename: args.path,
            id: "test",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            compilerOptions: { bindingMetadata: bindings } as any,
          });
          code += compiledTemplate.code + "\n";
          code += "__vue_component__.render = render;\n";
        }
        code += "\nexport default __vue_component__;\n";
      } else if (descriptor.template) {
        code = "var __vue_component__ = {};\n";
        const compiledTemplate = compileTemplate({
          source: descriptor.template.content,
          filename: args.path,
          id: "test",
        });
        code += compiledTemplate.code + "\n";
        code += "__vue_component__.render = render;\n";
        code += "\nexport default __vue_component__;\n";
      } else {
        code = "export default {};\n";
      }
      return { contents: code, loader: "ts" };
    });
  },
});
