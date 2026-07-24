import { NoTextLayerError } from "./errors";

const MAX_EXTRACTED_CHARS = 50_000;

export async function extractDocxText(file: Blob): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xmlPaths = Object.keys(zip.files)
    .filter((path) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(path))
    .sort((left, right) => sortDocxXmlPath(left) - sortDocxXmlPath(right));

  const parts: string[] = [];
  for (const path of xmlPaths) {
    const entry = zip.file(path);
    if (!entry) continue;
    const text = extractTextFromWordXml(await entry.async("text"));
    if (text) parts.push(text);
  }

  const text = parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) {
    throw new NoTextLayerError("DOCX did not contain readable contract text.");
  }

  return text.slice(0, MAX_EXTRACTED_CHARS);
}

function extractTextFromWordXml(xml: string) {
  const output: string[] = [];
  const tokenPattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>|<\/w:p>/g;

  for (const match of xml.matchAll(tokenPattern)) {
    if (match[1] !== undefined) {
      output.push(decodeXml(match[1]));
    } else if (match[0].startsWith("<w:tab")) {
      output.push("\t");
    } else {
      output.push("\n");
    }
  }

  return output.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function sortDocxXmlPath(path: string) {
  if (path === "word/header.xml") return 0;
  if (/^word\/header\d+\.xml$/.test(path)) return 1;
  if (path === "word/document.xml") return 2;
  if (path === "word/footer.xml") return 3;
  if (/^word\/footer\d+\.xml$/.test(path)) return 4;
  return 5;
}
