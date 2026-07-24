// Setup: register Vue SFC plugin and happy-dom globals
import { Window } from "happy-dom";

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

Object.defineProperty(happyWindow, "matchMedia", {
  value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  writable: true,
});

import vuePlugin from "./.vue-plugin";
Bun.plugin(vuePlugin);
