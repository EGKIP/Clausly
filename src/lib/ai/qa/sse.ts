const encoder = new TextEncoder();

export function encodeSseFrame(event: string, data: object): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
