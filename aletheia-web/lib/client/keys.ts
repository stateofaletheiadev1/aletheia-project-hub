'use client';

// Ed25519 identity keys, generated in the browser with WebCrypto. Only the public key is sent
// to the State; the private key is handed to the person as a PEM file and never leaves
// their device.

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

export async function generateIdentityKey(): Promise<{ publicKey: string; privatePem: string }> {
  if (!globalThis.crypto?.subtle) throw new Error('This browser cannot create keys here. Use a current browser over HTTPS.');
  let pair: CryptoKeyPair;
  try {
    pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  } catch {
    throw new Error('This browser does not support Ed25519 keys yet. Please update it, or use a current Chrome, Edge, Firefox or Safari.');
  }
  const publicKey = hex(await crypto.subtle.exportKey('raw', pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const b64 = btoa(String.fromCharCode(...pkcs8));
  const privatePem = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`;
  return { publicKey, privatePem };
}

export function saveTextFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/x-pem-file' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
