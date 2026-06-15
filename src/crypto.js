// Helper functions for Hex <-> ArrayBuffer conversion
function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

// Derive a 256-bit AES-GCM key from a password and salt using PBKDF2
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const pwBytes = enc.encode(password);
  
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    pwBytes,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  
  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt a plaintext string using a password
export async function encryptData(plainText, password) {
  if (!password) throw new Error("A senha de criptografia é obrigatória.");
  
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const enc = new TextEncoder();
  const ciphertextBuf = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(plainText)
  );
  
  return {
    encrypted: true,
    ciphertext: bufToHex(ciphertextBuf),
    salt: bufToHex(salt),
    iv: bufToHex(iv)
  };
}

// Decrypt a ciphertext object using a password
export async function decryptData(encryptedObj, password) {
  if (!password) throw new Error("A senha de criptografia é obrigatória.");
  if (!encryptedObj.ciphertext || !encryptedObj.salt || !encryptedObj.iv) {
    throw new Error("Dados criptografados inválidos ou corrompidos.");
  }
  
  const salt = new Uint8Array(hexToBuf(encryptedObj.salt));
  const iv = new Uint8Array(hexToBuf(encryptedObj.iv));
  const ciphertext = hexToBuf(encryptedObj.ciphertext);
  
  const key = await deriveKey(password, salt);
  
  const decryptedBuf = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );
  
  const dec = new TextDecoder();
  return dec.decode(decryptedBuf);
}

// Cryptographically secure hash (SHA-256) for PIN
export async function hashPin(pin) {
  if (!pin) return '';
  const enc = new TextEncoder();
  const hashBuf = await window.crypto.subtle.digest("SHA-256", enc.encode(pin));
  return bufToHex(hashBuf);
}

// Generate cryptographically secure random session IDs
export function generateSecureId(prefix = 'tauri_login_') {
  const randomBytes = new Uint8Array(16);
  window.crypto.getRandomValues(randomBytes);
  const randomHex = bufToHex(randomBytes);
  return `${prefix}${randomHex}`;
}
