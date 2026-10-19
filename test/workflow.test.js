// test/workflow.test.js
import test from "node:test";
import assert from "node:assert/strict";

import {
  generateECCKeyPair,
  exportECCPublicKey,
  importECCPublicKey,
  protectPrivateKeyWithPassphrase,
  unlockPrivateKeyWithPassphrase,
  encryptFile,
  decryptFile,
  wrapAESKeyForFaculty,
  unwrapAESKeyForFaculty,
} from "../src/services/encryptionService.js";

import {
  calculateSHA256,
  calculateSHA256FromArrayBuffer,
} from "../src/services/hashService.js";

test("End-to-End Workflow: Faculty key setup -> Student encryption -> Ciphertext integrity -> Faculty decryption", async () => {
  // ==========================================
  // 1. FACULTY SETUP
  // ==========================================
  const facultyPair = await generateECCKeyPair();
  const facultyPassphrase = "FacultySecretPassphrase2026!";

  // Protect private key with passphrase using PBKDF2-SHA256 + AES-GCM
  const protectedPrivateKey = await protectPrivateKeyWithPassphrase(
    facultyPair.privateKey,
    facultyPassphrase
  );

  // Export public key as JWK (stored in Firebase)
  const publicJwk = await exportECCPublicKey(facultyPair.publicKey);

  // ==========================================
  // 2. STUDENT SUBMISSION
  // ==========================================
  // Student retrieves and imports faculty public key
  const importedFacultyPublicKey = await importECCPublicKey(publicJwk);

  // Student prepares assignment file
  const originalContent = "Antigravity Secure Assignment System: Formal Submission Content 2026";
  const studentFile = new Blob([originalContent], { type: "application/pdf" });

  // Compute original file hash
  const originalFileHash = await calculateSHA256(studentFile);

  // Encrypt original file with AES-256-GCM
  const { encryptedBlob, ivBase64, key: aesKey } = await encryptFile(studentFile);

  // Wrap AES key for faculty ECC public key
  const wrappedAESKey = await wrapAESKeyForFaculty(aesKey, importedFacultyPublicKey);

  // Compute ciphertext SHA-256 hash
  const ciphertextHash = await calculateSHA256(encryptedBlob);

  assert.ok(ciphertextHash);
  assert.notEqual(ciphertextHash, originalFileHash); // Ciphertext is not plaintext

  // ==========================================
  // 3. FACULTY VERIFICATION & INTEGRITY CHECK
  // ==========================================
  // Read ciphertext bytes
  const ciphertextBuffer = await encryptedBlob.arrayBuffer();
  const computedHash = await calculateSHA256FromArrayBuffer(ciphertextBuffer);

  // Verify SHA-256
  assert.equal(computedHash.toLowerCase(), ciphertextHash.toLowerCase());

  // Tampered ciphertext fails verification
  const tamperedBytes = new Uint8Array(ciphertextBuffer.slice(0));
  tamperedBytes[0] ^= 0xff;
  const tamperedHash = await calculateSHA256FromArrayBuffer(tamperedBytes.buffer);
  assert.notEqual(tamperedHash.toLowerCase(), ciphertextHash.toLowerCase());

  // ==========================================
  // 4. FACULTY UNLOCKS KEY & DECRYPTS
  // ==========================================
  // Faculty unlocks private key with passphrase
  const unlockedPrivateKey = await unlockPrivateKeyWithPassphrase(
    protectedPrivateKey,
    facultyPassphrase
  );
  assert.ok(unlockedPrivateKey);

  // Unwrap AES key
  const unwrappedAESKey = await unwrapAESKeyForFaculty(
    wrappedAESKey,
    unlockedPrivateKey
  );
  assert.ok(unwrappedAESKey);

  // Decrypt ciphertext to original file
  const decryptedBlob = await decryptFile(
    new Blob([ciphertextBuffer]),
    unwrappedAESKey,
    ivBase64,
    "application/pdf"
  );

  const decryptedText = await decryptedBlob.text();
  assert.equal(decryptedText, originalContent);

  // Verify hash of decrypted file matches original
  const decryptedHash = await calculateSHA256(decryptedBlob);
  assert.equal(decryptedHash, originalFileHash);
});

test("Legacy record detection and compatibility", () => {
  const legacyRecord = {
    submissionId: "SUB-LEGACY-001",
    studentEmail: "student@example.com",
    title: "Old Assignment",
    subject: "Cryptography",
    fileUrl: "https://res.cloudinary.com/demo/raw/upload/legacy.pdf",
    fileHash: "abcdef123456",
  };

  const encryptedRecord = {
    submissionId: "SUB-ENC-002",
    studentEmail: "student@example.com",
    title: "New Assignment",
    subject: "Cryptography",
    fileUrl: "https://res.cloudinary.com/demo/raw/upload/SUB-ENC-002.bin",
    isEncrypted: true,
    ciphertextHash: "998877665544",
    wrappedAESKey: { version: 1 },
    iv: "dGVzdGl2MTIzNA==",
  };

  const isLegacyEncrypted = Boolean(
    legacyRecord.isEncrypted ||
    legacyRecord.wrappedAESKey ||
    legacyRecord.ciphertextHash
  );

  const isNewEncrypted = Boolean(
    encryptedRecord.isEncrypted ||
    encryptedRecord.wrappedAESKey ||
    encryptedRecord.ciphertextHash
  );

  assert.equal(isLegacyEncrypted, false);
  assert.equal(isNewEncrypted, true);
});
