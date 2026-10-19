// test/otp.test.js
import test from "node:test";
import assert from "node:assert/strict";

import {
  generateNumericOTP,
  maskEmail,
  hashOTP,
} from "../src/services/otpService.js";

test("generateNumericOTP generates 6-digit uniform numeric codes", () => {
  for (let i = 0; i < 50; i++) {
    const otp = generateNumericOTP(6);
    assert.equal(otp.length, 6);
    assert.match(otp, /^\d{6}$/);
    const num = Number(otp);
    assert.ok(num >= 100000 && num <= 999999);
  }
});

test("generateNumericOTP supports custom length", () => {
  const otp4 = generateNumericOTP(4);
  assert.equal(otp4.length, 4);
  assert.match(otp4, /^\d{4}$/);

  const otp8 = generateNumericOTP(8);
  assert.equal(otp8.length, 8);
  assert.match(otp8, /^\d{8}$/);
});

test("maskEmail correctly masks local part of email", () => {
  assert.equal(maskEmail("student@university.edu"), "s*****t@university.edu");
  assert.equal(maskEmail("ab@example.com"), "a*@example.com");
  assert.equal(maskEmail("john.doe@test.org"), "j*****e@test.org");
  assert.equal(maskEmail(""), "");
});

test("hashOTP generates consistent SHA-256 digests", async () => {
  const code = "482910";
  const hash1 = await hashOTP(code);
  const hash2 = await hashOTP(code);
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64); // SHA-256 hex string

  const differentHash = await hashOTP("482911");
  assert.notEqual(hash1, differentHash);
});
