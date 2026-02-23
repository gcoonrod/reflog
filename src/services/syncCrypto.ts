// Sync encryption pipeline: JSON → compress → encrypt → base64
// Separate from crypto.ts which handles field-level encryption for local storage.

function concatBuffers(a: Uint8Array, b: ArrayBuffer): Uint8Array {
  const result = new Uint8Array(a.byteLength + b.byteLength);
  result.set(a, 0);
  result.set(new Uint8Array(b), a.byteLength);
  return result;
}

function base64Encode(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i] ?? 0);
  }
  return btoa(binary);
}

function base64Decode(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function compress(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  void writer.write(data as unknown as BufferSource);
  void writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(buf);
}

async function decompress(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  void writer.write(data as unknown as BufferSource);
  void writer.close();
  const buf = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(buf);
}

export async function encryptForSync(
  record: object,
  key: CryptoKey,
): Promise<string> {
  const json = JSON.stringify(record);
  const compressed = await compress(new TextEncoder().encode(json));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    compressed,
  );
  return base64Encode(concatBuffers(iv, ciphertext));
}

export async function decryptFromSync(
  blob: string,
  key: CryptoKey,
): Promise<unknown> {
  const raw = base64Decode(blob);
  const iv = raw.slice(0, 12);
  const ciphertext = raw.slice(12);
  const compressed = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  const json = await decompress(new Uint8Array(compressed));
  return JSON.parse(new TextDecoder().decode(json)) as unknown;
}
