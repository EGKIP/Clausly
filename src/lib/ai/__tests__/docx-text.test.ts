// @vitest-environment node
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { NoTextLayerError } from "../errors";
import { extractDocxText } from "../docx-text";

describe("extractDocxText", () => {
  it("extracts paragraphs from Word document XML", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", `
      <w:document>
        <w:body>
          <w:p><w:r><w:t>Lease starts September 1.</w:t></w:r></w:p>
          <w:p><w:r><w:t>Tenant must give 60 days notice.</w:t></w:r></w:p>
        </w:body>
      </w:document>
    `);
    const bytes = await zipBlobPart(zip);

    await expect(extractDocxText(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })))
      .resolves.toBe("Lease starts September 1.\nTenant must give 60 days notice.");
  });

  it("decodes XML entities and preserves simple breaks", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", `
      <w:document><w:body><w:p>
        <w:r><w:t>Fees &amp; deposits</w:t></w:r>
        <w:r><w:tab/></w:r>
        <w:r><w:t>&lt;review&gt;</w:t></w:r>
      </w:p></w:body></w:document>
    `);
    const bytes = await zipBlobPart(zip);

    await expect(extractDocxText(new Blob([bytes]))).resolves.toBe("Fees & deposits\t<review>");
  });

  it("throws when the DOCX has no readable text", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "<w:document><w:body /></w:document>");
    const bytes = await zipBlobPart(zip);

    await expect(extractDocxText(new Blob([bytes]))).rejects.toBeInstanceOf(NoTextLayerError);
  });
});

async function zipBlobPart(zip: JSZip): Promise<BlobPart> {
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
