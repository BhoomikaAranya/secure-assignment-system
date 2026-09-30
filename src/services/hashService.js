// src/services/hashService.js

/**
 * Calculate SHA-256 from raw file bytes.
 */
async function calculateSHA256FromArrayBuffer(arrayBuffer) {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    arrayBuffer
  );

  const hashArray = Array.from(
    new Uint8Array(hashBuffer)
  );

  return hashArray
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

/**
 * Generate SHA-256 hash for a selected file.
 */
export async function calculateSHA256(file) {
  if (!file) {
    throw new Error("No file selected.");
  }

  const arrayBuffer = await file.arrayBuffer();

  return calculateSHA256FromArrayBuffer(
    arrayBuffer
  );
}

/**
 * Generate SHA-256 hash for a file available at a URL.
 *
 * Used to verify whether the currently stored/downloaded
 * file matches the original SHA-256 hash.
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

  return calculateSHA256FromArrayBuffer(
    arrayBuffer
  );
}