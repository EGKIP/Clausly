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

const MAX_NON_TEXT_BYTE_RATIO = 0.05;

/** Unlike pdf/docx/png/jpg, plain-text uploads have no magic number to check, so a
 * binary file renamed to .txt (e.g. a PDF) would otherwise be accepted and later
 * silently mis-decoded as garbled text instead of failing with a clear error. A NUL
 * byte, or more than a handful of other non-printable control bytes, is a reliable
 * signal the content isn't text (see git's own binary-detection heuristic). */
export function looksLikeTextContent(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return true;
  let nonTextBytes = 0;
  for (const byte of bytes) {
    if (byte === 0x00) return false;
    // Allow common whitespace control bytes (tab, LF, CR); anything else
    // below 0x20, and the DEL byte, counts against the ratio.
    const isControl = byte < 0x20 || byte === 0x7f;
    const isAllowedWhitespace = byte === 0x09 || byte === 0x0a || byte === 0x0d;
    if (isControl && !isAllowedWhitespace) nonTextBytes++;
  }
  return nonTextBytes / bytes.length <= MAX_NON_TEXT_BYTE_RATIO;
}
