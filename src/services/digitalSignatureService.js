
const DATABASE_NAME = "AssignmentDigitalSignatures";
const STORE_NAME = "signingKeys";

const encoder = new TextEncoder();

function openKeyDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Could not open key database."));
  });
}

async function readStoredKey(email) {
  const database = await openKeyDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(email);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

async function saveStoredKey(email, keyData) {
  const database = await openKeyDatabase();

  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");

      transaction.objectStore(STORE_NAME).put(keyData, email);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error || new Error("Saving signing key failed."));
    });
  } finally {
    database.close();
  }
}

function toBase64(bytes) {
  let binary = "";

  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);

  return Uint8Array.from(binary, (character) =>
    character.charCodeAt(0)
  );
}

async function getOrCreateKeyPair(email) {
  if (!email) {
    throw new Error("Student email is required.");
  }

  const stored = await readStoredKey(email);

  if (stored?.privateKey && stored?.publicKey) {
    return stored;
  }

  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    false,
    ["sign", "verify"]
  );

  const exportedPublicKey = await crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey
  );

  const keyData = {
    privateKey: keyPair.privateKey,
    publicKey: toBase64(exportedPublicKey),
  };

  await saveStoredKey(email, keyData);

  return keyData;
}

/**
 * Sign a SHA-256 file hash with the student's private key.
 * The private key is never exported or sent to Firebase.
 */
export async function signFileHash(fileHash, studentEmail) {
  if (!fileHash) {
    throw new Error("File hash is required for signing.");
  }

  if (!crypto?.subtle || !globalThis.indexedDB) {
    throw new Error("Secure signing is not supported in this browser.");
  }

  const { privateKey, publicKey } =
    await getOrCreateKeyPair(studentEmail);

  const signature = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256",
    },
    privateKey,
    encoder.encode(fileHash)
  );

  return {
    signature: toBase64(signature),
    publicKey,
    algorithm: "ECDSA-P256-SHA256",
  };
}

/**
 * Verify a signature against a file hash and public key.
 */
export async function verifyFileSignature(
  fileHash,
  signature,
  publicKey
) {
  if (!fileHash || !signature || !publicKey) {
    throw new Error("File hash, signature, and public key are required.");
  }

  const importedPublicKey = await crypto.subtle.importKey(
    "spki",
    fromBase64(publicKey),
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["verify"]
  );

  return crypto.subtle.verify(
    {
      name: "ECDSA",
      hash: "SHA-256",
    },
    importedPublicKey,
    fromBase64(signature),
    encoder.encode(fileHash)
  );
}
