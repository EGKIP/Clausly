const PDF_MAGIC_NUMBER = [0x25, 0x50, 0x44, 0x46]; // "%PDF"
const ZIP_MAGIC_NUMBER = [0x50, 0x4b, 0x03, 0x04]; // "PK..."
const PNG_MAGIC_NUMBER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Checks the PDF magic number rather than trusting a client-supplied MIME type. */
export function isPdfSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC_NUMBER.length) return false;
  return PDF_MAGIC_NUMBER.every((byte, index) => bytes[index] === byte);
}

export function isZipSignature(bytes: Uint8Array): boolean {
  if (bytes.length < ZIP_MAGIC_NUMBER.length) return false;
  return ZIP_MAGIC_NUMBER.every((byte, index) => bytes[index] === byte);
}

export function isPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_MAGIC_NUMBER.length) return false;
  return PNG_MAGIC_NUMBER.every((byte, index) => bytes[index] === byte);
}

export function isJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
