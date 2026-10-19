// src/services/encryptionService.js

/**
 * Convert ArrayBuffer or TypedArray to Base64.
 */
export function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 to ArrayBuffer.
 */
export function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a random AES-256 key for AES-GCM encryption.
 */
export async function generateAESKey() {
  return crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a File or Blob using AES-256-GCM.
 *
 * Returns:
 * - encryptedBlob: Blob (application/octet-stream)
 * - iv: Uint8Array (12 bytes)
 * - ivBase64: string
 * - key: CryptoKey
 */
export async function encryptFile(file) {
  if (!file) {
    throw new Error("No file provided.");
  }

  // Read the original file bytes
  const arrayBuffer = await file.arrayBuffer();

  // Generate a random AES-256 key
  const key = await generateAESKey();

  // Generate a random 96-bit (12-byte) IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the file bytes
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    arrayBuffer
  );

  const encryptedBlob = new Blob([encryptedBuffer], {
    type: "application/octet-stream",
  });

  return {
    encryptedBlob,
    iv,
    ivBase64: arrayBufferToBase64(iv),
    key,
  };
}

/**
 * Decrypt an encrypted Blob or ArrayBuffer using AES-256-GCM.
 *
 * @param {Blob|ArrayBuffer} encryptedData - Ciphertext bytes
 * @param {CryptoKey} key - AES-GCM CryptoKey
 * @param {Uint8Array|ArrayBuffer|string} iv - 12-byte IV (or Base64 string)
 * @param {string} [mimeType="application/octet-stream"] - Expected output MIME type
 */
export async function decryptFile(
  encryptedData,
  key,
  iv,
  mimeType = "application/octet-stream"
) {
  if (!encryptedData) {
    throw new Error("No encrypted file provided.");
  }

  if (!key) {
    throw new Error("No AES key provided.");
  }

  if (!iv) {
    throw new Error("No initialization vector provided.");
  }

  let ivBuffer;
  if (typeof iv === "string") {
    ivBuffer = new Uint8Array(base64ToArrayBuffer(iv));
  } else if (iv instanceof Uint8Array) {
    ivBuffer = iv;
  } else {
    ivBuffer = new Uint8Array(iv);
  }

  const encryptedBuffer =
    encryptedData instanceof Blob
      ? await encryptedData.arrayBuffer()
      : encryptedData;

  let decryptedBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBuffer,
      },
      key,
      encryptedBuffer
    );
  } catch (err) {
    throw new Error("Decryption failed. The file may be corrupted or the key is invalid.", {
      cause: err,
    });
  }

  return new Blob([decryptedBuffer], {
    type: mimeType || "application/octet-stream",
  });
}

/**
 * Export an AES key as Base64.
 */
export async function exportAESKey(key) {
  const rawKey = await crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(rawKey);
}

/**
 * Import a Base64 AES-256 key.
 */
export async function importAESKey(base64Key) {
  const rawKey = base64ToArrayBuffer(base64Key);
  return crypto.subtle.importKey(
    "raw",
    rawKey,
    {
      name: "AES-GCM",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Generate an ECC P-256 key pair for ECDH key sharing.
 */
export async function generateECCKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveBits"]
  );
}

/**
 * Export a public ECC key as JWK.
 */
export async function exportECCPublicKey(publicKey) {
  return crypto.subtle.exportKey("jwk", publicKey);
}

/**
 * Import a faculty public ECC key.
 */
export async function importECCPublicKey(publicJwk) {
  return crypto.subtle.importKey(
    "jwk",
    publicJwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    []
  );
}

/**
 * Export private key material as JWK.
 */
export async function exportECCPrivateKey(privateKey) {
  return crypto.subtle.exportKey("jwk", privateKey);
}

/**
 * Import an ECC private key for key derivation.
 */
export async function importECCPrivateKey(privateJwk) {
  return crypto.subtle.importKey(
    "jwk",
    privateJwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveBits"]
  );
}

/**
 * Derive an AES-GCM key-encryption key using ECDH + HKDF.
 */
async function deriveWrappingKey(privateKey, publicKey, salt) {
  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    256
  );

  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: new TextEncoder().encode(
        "secure-assignment-system-aes-key-wrap-v1"
      ),
    },
    hkdfKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Wrap an assignment AES key for the intended faculty public key.
 */
export async function wrapAESKeyForFaculty(aesKey, facultyPublicKey) {
  const ephemeralPair = await generateECCKeyPair();

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const wrappingKey = await deriveWrappingKey(
    ephemeralPair.privateKey,
    facultyPublicKey,
    salt
  );

  const rawAESKey = await crypto.subtle.exportKey("raw", aesKey);

  const wrappedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    wrappingKey,
    rawAESKey
  );

  return {
    version: 1,
    algorithm: "ECDH-P256-HKDF-SHA256-AES-GCM",
    ephemeralPublicKey: await exportECCPublicKey(ephemeralPair.publicKey),
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    wrappedKey: arrayBufferToBase64(wrappedBuffer),
  };
}

/**
 * Unwrap an assignment AES key using the faculty private key.
 */
export async function unwrapAESKeyForFaculty(wrappedData, facultyPrivateKey) {
  if (
    !wrappedData ||
    wrappedData.version !== 1 ||
    !wrappedData.ephemeralPublicKey ||
    !wrappedData.salt ||
    !wrappedData.iv ||
    !wrappedData.wrappedKey
  ) {
    throw new Error("Invalid wrapped AES key data.");
  }

  const ephemeralPublicKey = await importECCPublicKey(
    wrappedData.ephemeralPublicKey
  );

  const salt = new Uint8Array(base64ToArrayBuffer(wrappedData.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(wrappedData.iv));
  const wrappedKey = base64ToArrayBuffer(wrappedData.wrappedKey);

  const wrappingKey = await deriveWrappingKey(
    facultyPrivateKey,
    ephemeralPublicKey,
    salt
  );

  let rawAESKey;
  try {
    rawAESKey = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      wrappingKey,
      wrappedKey
    );
  } catch (err) {
    throw new Error("Unable to unwrap AES key. The faculty private key does not match or the key material is corrupted.", {
      cause: err,
    });
  }

  return crypto.subtle.importKey(
    "raw",
    rawAESKey,
    {
      name: "AES-GCM",
    },
    false,
    ["decrypt"]
  );
}

// ============================================================================
// PASSPHRASE-BASED FACULTY PRIVATE KEY PROTECTION (PBKDF2 + AES-256-GCM)
// ============================================================================

/**
 * Derive an AES-256-GCM encryption key from a passphrase using PBKDF2-SHA256.
 */
export async function derivePassphraseKey(passphrase, salt, iterations = 200000) {
  const encoder = new TextEncoder();
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const saltBytes = salt instanceof Uint8Array ? salt : new Uint8Array(salt);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations,
      hash: "SHA-256",
    },
    passphraseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Protect an ECC private key with a user-provided passphrase.
 *
 * Returns an encrypted record:
 * {
 *   version: 1,
 *   kdf: "PBKDF2-SHA256",
 *   iterations: 200000,
 *   salt: base64,
 *   iv: base64,
 *   ciphertext: base64
 * }
 */
export async function protectPrivateKeyWithPassphrase(privateKey, passphrase) {
  if (!passphrase || typeof passphrase !== "string" || passphrase.length < 8) {
    throw new Error("Passphrase must be at least 8 characters long.");
  }
  if (!privateKey) {
    throw new Error("No private key provided to protect.");
  }

  const jwk = await exportECCPrivateKey(privateKey);
  const jwkBytes = new TextEncoder().encode(JSON.stringify(jwk));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iterations = 200000;

  const derivedKey = await derivePassphraseKey(passphrase, salt, iterations);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    derivedKey,
    jwkBytes
  );

  return {
    version: 1,
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(encryptedBuffer),
  };
}

/**
 * Unlock a passphrase-protected ECC private key.
 *
 * @param {Object} protectedData - Protected key record
 * @param {string} passphrase - User passphrase
 * @returns {Promise<CryptoKey>} Unlocked ECDH CryptoKey
 */
export async function unlockPrivateKeyWithPassphrase(protectedData, passphrase) {
  if (
    !protectedData ||
    !protectedData.ciphertext ||
    !protectedData.salt ||
    !protectedData.iv
  ) {
    throw new Error("Invalid protected private key format.");
  }
  if (!passphrase) {
    throw new Error("Please enter your key unlock passphrase.");
  }

  const salt = base64ToArrayBuffer(protectedData.salt);
  const iv = new Uint8Array(base64ToArrayBuffer(protectedData.iv));
  const ciphertext = base64ToArrayBuffer(protectedData.ciphertext);
  const iterations = protectedData.iterations || 200000;

  const derivedKey = await derivePassphraseKey(passphrase, salt, iterations);

  let decryptedBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      derivedKey,
      ciphertext
    );
  } catch (err) {
    throw new Error("Incorrect passphrase or corrupted key backup data.", {
      cause: err,
    });
  }

  const jwkString = new TextDecoder().decode(decryptedBuffer);
  const jwk = JSON.parse(jwkString);

  return importECCPrivateKey(jwk);
}
