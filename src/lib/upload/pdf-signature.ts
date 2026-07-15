const PDF_MAGIC_NUMBER = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

/** Checks the PDF magic number rather than trusting a client-supplied MIME type. */
export function isPdfSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC_NUMBER.length) return false;
  return PDF_MAGIC_NUMBER.every((byte, index) => bytes[index] === byte);
}
