import { afterEach, describe, expect, it, vi } from "vitest";

const originalGlobals = {
  DOMMatrix: globalThis.DOMMatrix,
  DOMPoint: globalThis.DOMPoint,
  DOMRect: globalThis.DOMRect,
  ImageData: globalThis.ImageData,
  Path2D: globalThis.Path2D,
};

describe("extractPdfText", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@napi-rs/canvas");
    vi.doUnmock("pdf-parse");
    restoreGlobal("DOMMatrix", originalGlobals.DOMMatrix);
    restoreGlobal("DOMPoint", originalGlobals.DOMPoint);
    restoreGlobal("DOMRect", originalGlobals.DOMRect);
    restoreGlobal("ImageData", originalGlobals.ImageData);
    restoreGlobal("Path2D", originalGlobals.Path2D);
    Reflect.deleteProperty(globalThis, "__CLAUSLY_NODE_CANVAS_RUNTIME__");
  });

  it("installs Node canvas DOM shims before importing pdf-parse", async () => {
    deleteRuntimeGlobals();
    const sawDomMatrix = vi.fn();

    class TestDOMMatrix {}
    class TestDOMPoint {}
    class TestDOMRect {}
    class TestImageData {}
    class TestPath2D {}

    Reflect.set(globalThis, "__CLAUSLY_NODE_CANVAS_RUNTIME__", {
      DOMMatrix: TestDOMMatrix,
      DOMPoint: TestDOMPoint,
      DOMRect: TestDOMRect,
      ImageData: TestImageData,
      Path2D: TestPath2D,
    });

    vi.doMock("pdf-parse", () => ({
      PDFParse: class {
        constructor() {
          sawDomMatrix(globalThis.DOMMatrix);
        }

        async getText() {
          return { text: "A lease with a real text layer." };
        }

        async destroy() {}
      },
    }));

    const { extractPdfText } = await import("../pdf-text");
    const text = await extractPdfText({
      arrayBuffer: async () => new TextEncoder().encode("%PDF-test").buffer,
    } as Blob);

    expect(text).toBe("A lease with a real text layer.");
    expect(sawDomMatrix).toHaveBeenCalledWith(globalThis.DOMMatrix);
    expect(globalThis.DOMMatrix).toBe(TestDOMMatrix);
  });
});

function deleteRuntimeGlobals() {
  Reflect.deleteProperty(globalThis, "DOMMatrix");
  Reflect.deleteProperty(globalThis, "DOMPoint");
  Reflect.deleteProperty(globalThis, "DOMRect");
  Reflect.deleteProperty(globalThis, "ImageData");
  Reflect.deleteProperty(globalThis, "Path2D");
  Reflect.deleteProperty(globalThis, "__CLAUSLY_NODE_CANVAS_RUNTIME__");
}

function restoreGlobal(key: keyof typeof originalGlobals, value: (typeof originalGlobals)[typeof key]) {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, key);
    return;
  }

  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
}
