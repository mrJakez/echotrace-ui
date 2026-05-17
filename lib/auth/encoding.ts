export function bytesToBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

export function base64UrlToBytes(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}
