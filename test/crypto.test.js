// test/crypto.test.js
import test from "node:test";
import assert from "node:assert/strict";

import {
  generateAESKey,
  encryptFile,
  decryptFile,
  exportAESKey,
  importAESKey,
  generateECCKeyPair,
  exportECCPublicKey,
  importECCPublicKey,
  exportECCPrivateKey,
  importECCPrivateKey,
  wrapAESKeyForFaculty,
  unwrapAESKeyForFaculty,
  protectPrivateKeyWithPassphrase,
  unlockPrivateKeyWithPassphrase,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from "../src/services/encryptionService.js";

import {
  calculateSHA256,
  calculateSHA256FromArrayBuffer,
} from "../src/services/hashService.js";

test("Base64 and ArrayBuffer round-trip conversion", () => {
  const original = new Uint8Array([0, 1, 2, 255, 128, 42, 99]);
  const base64 = arrayBufferToBase64(original);
  const recovered = new Uint8Array(base64ToArrayBuffer(base64));
  assert.deepEqual(Array.from(recovered), Array.from(original));
});

test("AES key export and import as Base64", async () => {
  const originalKey = await generateAESKey();
  const exported = await exportAESKey(originalKey);
  assert.equal(typeof exported, "string");
  assert.ok(exported.length > 20);

  const importedKey = await importAESKey(exported);
  assert.ok(importedKey);

  // Verify encryption with original and decryption with imported key
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const message = new TextEncoder().encode("Export Import Key Test");
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    originalKey,
    message
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    importedKey,
    ciphertext
  );
  assert.equal(new TextDecoder().decode(plaintext), "Export Import Key Test");
});

test("AES-256-GCM file encryption and decryption round-trip", async () => {
  const sampleText = "Secure Assignment System - End to End Test Content";
  const blob = new Blob([sampleText], { type: "text/plain" });

  const { encryptedBlob, iv, key } = await encryptFile(blob);

  assert.ok(encryptedBlob instanceof Blob);
  assert.equal(iv.length, 12);
  assert.ok(key);

  const decryptedBlob = await decryptFile(encryptedBlob, key, iv, "text/plain");
  const decryptedText = await decryptedBlob.text();

  assert.equal(decryptedText, sampleText);
});

test("Tampered ciphertext fails AES-256-GCM decryption", async () => {
  const sampleText = "Confidential student research paper";
  const blob = new Blob([sampleText], { type: "text/plain" });
  const { encryptedBlob, iv, key } = await encryptFile(blob);

  const buffer = await encryptedBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Tamper with one byte of the ciphertext/tag
  bytes[bytes.length - 1] ^= 0x01;

  const tamperedBlob = new Blob([bytes]);

  await assert.rejects(
    async () => {
      await decryptFile(tamperedBlob, key, iv);
    },
    /Decryption failed/
  );
});

test("ECC P-256 key generation, export, and import", async () => {
  const keyPair = await generateECCKeyPair();
  const publicJwk = await exportECCPublicKey(keyPair.publicKey);
  const privateJwk = await exportECCPrivateKey(keyPair.privateKey);

  assert.equal(publicJwk.kty, "EC");
  assert.equal(publicJwk.crv, "P-256");
  assert.equal(privateJwk.kty, "EC");

  const importedPublic = await importECCPublicKey(publicJwk);
  const importedPrivate = await importECCPrivateKey(privateJwk);

  assert.ok(importedPublic);
  assert.ok(importedPrivate);
});

test("AES key wrapping for faculty and unwrapping with private key", async () => {
  const facultyPair = await generateECCKeyPair();
  const aesKey = await generateAESKey();

  const wrapped = await wrapAESKeyForFaculty(aesKey, facultyPair.publicKey);

  assert.equal(wrapped.version, 1);
  assert.equal(wrapped.algorithm, "ECDH-P256-HKDF-SHA256-AES-GCM");
  assert.ok(wrapped.ephemeralPublicKey);
  assert.ok(wrapped.wrappedKey);

  const unwrappedKey = await unwrapAESKeyForFaculty(wrapped, facultyPair.privateKey);
  assert.ok(unwrappedKey);

  const originalMessage = "Assignment test payload 12345";
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(originalMessage)
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    unwrappedKey,
    ciphertext
  );

  assert.equal(new TextDecoder().decode(decrypted), originalMessage);
});

test("Unauthorized faculty cannot unwrap another faculty's wrapped AES key", async () => {
  const facultyA = await generateECCKeyPair();
  const facultyB = await generateECCKeyPair();
  const aesKey = await generateAESKey();

  const wrappedForA = await wrapAESKeyForFaculty(aesKey, facultyA.publicKey);

  await assert.rejects(
    async () => {
      await unwrapAESKeyForFaculty(wrappedForA, facultyB.privateKey);
    },
    /Unable to unwrap AES key/
  );
});

test("Passphrase-based private key protection and unlocking", async () => {
  const facultyPair = await generateECCKeyPair();
  const passphrase = "SuperSecureFacultyPassphrase2026!";

  const protectedData = await protectPrivateKeyWithPassphrase(
    facultyPair.privateKey,
    passphrase
  );

  assert.equal(protectedData.version, 1);
  assert.equal(protectedData.kdf, "PBKDF2-SHA256");
  assert.ok(protectedData.salt);
  assert.ok(protectedData.iv);
  assert.ok(protectedData.ciphertext);

  const unlockedPrivateKey = await unlockPrivateKeyWithPassphrase(
    protectedData,
    passphrase
  );
  assert.ok(unlockedPrivateKey);

  const aesKey = await generateAESKey();
  const wrapped = await wrapAESKeyForFaculty(aesKey, facultyPair.publicKey);
  const unwrapped = await unwrapAESKeyForFaculty(wrapped, unlockedPrivateKey);
  assert.ok(unwrapped);

  await assert.rejects(
    async () => {
      await unlockPrivateKeyWithPassphrase(protectedData, "WrongPassphrase123!");
    },
    /Incorrect passphrase/
  );
});

test("calculateSHA256 supports Blob and ArrayBuffer", async () => {
  const data = new TextEncoder().encode("Hello World");
  const hashFromBuffer = await calculateSHA256FromArrayBuffer(data.buffer);
  const blob = new Blob([data]);
  const hashFromBlob = await calculateSHA256(blob);

  assert.equal(hashFromBuffer, "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e");
  assert.equal(hashFromBlob, hashFromBuffer);
});
