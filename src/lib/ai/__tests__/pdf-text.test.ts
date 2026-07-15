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
    vi.unstubAllEnvs();
    vi.doUnmock("@napi-rs/canvas");
    vi.doUnmock("pdf-parse");
    vi.doUnmock("pdf-parse/worker");
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

  it("configures pdf-parse with the bundled worker data URL outside tests", async () => {
    vi.stubEnv("NODE_ENV", "production");
    deleteRuntimeGlobals();

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

    const setWorker = vi.fn();

    vi.doMock("pdf-parse/worker", () => ({
      getData: () => "data:text/javascript;base64,worker-bundle",
    }));

    vi.doMock("pdf-parse", () => ({
      PDFParse: class {
        static setWorker = setWorker;

        async getText() {
          return { text: "A lease with a real text layer." };
        }

        async destroy() {}
      },
    }));

    const { extractPdfText } = await import("../pdf-text");
    await extractPdfText({
      arrayBuffer: async () => new TextEncoder().encode("%PDF-test").buffer,
    } as Blob);

    expect(setWorker).toHaveBeenCalledWith("data:text/javascript;base64,worker-bundle");
  });

  it("times out and still destroys the parser if getText hangs", async () => {
    vi.useFakeTimers();
    const destroy = vi.fn(async () => {});

    vi.doMock("pdf-parse", () => ({
      PDFParse: class {
        async getText() {
          return new Promise(() => {
            // Never resolves — simulates a hung/pathological PDF parse.
          });
        }

        async destroy() {
          await destroy();
        }
      },
    }));

    try {
      const { extractPdfText } = await import("../pdf-text");
      const pending = extractPdfText({
        arrayBuffer: async () => new TextEncoder().encode("%PDF-test").buffer,
      } as Blob);

      const assertion = expect(pending).rejects.toThrow("PDF text extraction timed out.");
      await vi.advanceTimersByTimeAsync(45_000);
      await assertion;
      expect(destroy).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
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
