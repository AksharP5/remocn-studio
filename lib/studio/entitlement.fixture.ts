// A throwaway Ed25519 pair for tests that need a document that verifies:
// the private half signs the way `signEntitlement` does on the landing, the
// public half is what a test swaps in for `ENTITLEMENT_PUBLIC_KEY`.

let pair: Promise<CryptoKeyPair> | null = null;

function keys(): Promise<CryptoKeyPair> {
  pair ??= crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]) as Promise<CryptoKeyPair>;
  return pair;
}

function base64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

export async function testPublicKey(): Promise<string> {
  const { publicKey } = await keys();
  return base64(await crypto.subtle.exportKey("raw", publicKey));
}

export async function signedBy(
  document: Record<string, unknown>
): Promise<{ algorithm: "ed25519"; payload: string; signature: string }> {
  const { privateKey } = await keys();
  const payload = btoa(JSON.stringify(document));
  const signature = await crypto.subtle.sign(
    "Ed25519",
    privateKey,
    new TextEncoder().encode(payload)
  );
  return { algorithm: "ed25519", payload, signature: base64(signature) };
}
