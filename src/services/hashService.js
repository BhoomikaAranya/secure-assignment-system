// src/services/hashService.js

/**
 * Calculate SHA-256 hex string from raw bytes or ArrayBuffer.
 */
export async function calculateSHA256FromArrayBuffer(arrayBuffer) {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    arrayBuffer
  );

  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate SHA-256 hash for a File, Blob, ArrayBuffer, or TypedArray.
 */
export async function calculateSHA256(fileOrBytes) {
  if (!fileOrBytes) {
    throw new Error("No data provided for SHA-256 calculation.");
  }

  if (fileOrBytes instanceof ArrayBuffer) {
    return calculateSHA256FromArrayBuffer(fileOrBytes);
  }

  if (ArrayBuffer.isView(fileOrBytes)) {
    return calculateSHA256FromArrayBuffer(fileOrBytes.buffer);
  }

  if (typeof fileOrBytes.arrayBuffer === "function") {
    const arrayBuffer = await fileOrBytes.arrayBuffer();
    return calculateSHA256FromArrayBuffer(arrayBuffer);
  }

  throw new Error("Unsupported data format for SHA-256 calculation.");
}

/**
 * Generate SHA-256 hash for a file available at a URL.
 *
 * Used to verify whether the currently stored/downloaded
 * file matches the stored SHA-256 hash.
 */
export async function calculateSHA256FromUrl(fileUrl) {
  if (!fileUrl) {
    throw new Error("No file URL provided.");
  }

  const response = await fetch(fileUrl);

  if (!response.ok) {
    throw new Error(
      `Unable to fetch file. HTTP status: ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  return calculateSHA256FromArrayBuffer(arrayBuffer);
}