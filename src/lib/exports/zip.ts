import JSZip from "jszip";

export async function buildExportZip({
  clausesCsv,
  datesCsv,
}: {
  clausesCsv: string;
  datesCsv: string;
}) {
  const zip = new JSZip();
  zip.file("clauses.csv", clausesCsv);
  zip.file("dates.csv", datesCsv);
  return zip.generateAsync({ type: "nodebuffer" });
}
