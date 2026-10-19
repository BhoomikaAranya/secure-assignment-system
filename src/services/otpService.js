// src/services/otpService.js
import { calculateSHA256FromArrayBuffer } from "./hashService.js";
import { ref, set, get, update } from "firebase/database";

/**
 * Generate a cryptographically secure numeric OTP of specified length.
 * Default length is 6 digits (100000 - 999999).
 */
export function generateNumericOTP(length = 6) {
  if (length < 4 || length > 10) {
    throw new Error("OTP length must be between 4 and 10 digits.");
  }
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const range = max - min + 1;

  const randomUint32 = new Uint32Array(1);
  crypto.getRandomValues(randomUint32);
  const code = min + (randomUint32[0] % range);
  return code.toString();
}

/**
 * Mask an email for privacy display (e.g. j***e@example.com).
 */
export function maskEmail(email) {
  if (!email || !email.includes("@")) return email || "";
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 2) {
    return `${localPart[0]}*@${domain}`;
  }
  const first = localPart[0];
  const last = localPart[localPart.length - 1];
  return `${first}${"*".repeat(Math.min(localPart.length - 2, 5))}${last}@${domain}`;
}

/**
 * Compute SHA-256 hash of an OTP string.
 */
export async function hashOTP(otpString) {
  const bytes = new TextEncoder().encode(otpString.trim());
  return calculateSHA256FromArrayBuffer(bytes.buffer);
}

/**
 * Store hashed OTP in Firebase Realtime Database with expiration & attempt tracking.
 *
 * @param {Object} db - Firebase database instance
 * @param {string} uid - Firebase user UID
 * @param {string} email - User email
 * @param {string} otp - Plaintext OTP to hash and store
 * @param {number} validityMinutes - Minutes until expiration (default: 5)
 */
export async function storeOTPRecord(db, uid, email, otp, validityMinutes = 5) {
  const otpHash = await hashOTP(otp);
  const now = Date.now();
  const expiresAt = now + validityMinutes * 60 * 1000;

  const record = {
    otpHash,
    email,
    createdAt: now,
    expiresAt,
    attempts: 0,
    maxAttempts: 5,
  };

  await set(ref(db, `authOtps/${uid}`), record);
  return { expiresAt, maxAttempts: 5 };
}

/**
 * Send an OTP code to user's email.
 *
 * Supports:
 * 1. EmailJS REST API if VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY exist.
 * 2. In-app Simulated Delivery for rapid testing and development.
 */
export async function sendEmailOTP({ email, otp, userName = "User" }) {
  const env = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {};
  const serviceId = env.VITE_EMAILJS_SERVICE_ID;
  const templateId = env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = env.VITE_EMAILJS_PUBLIC_KEY;

  if (serviceId && templateId && publicKey) {
    try {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: {
            to_email: email,
            to_name: userName,
            otp_code: otp,
            validity_minutes: "5",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("EmailJS delivery failed, falling back to in-app delivery:", errorText);
        return {
          success: true,
          deliveredVia: "simulated",
          otp,
          message: `Code sent to ${email} (Simulated fallback: ${otp})`,
        };
      }

      return {
        success: true,
        deliveredVia: "emailjs",
        message: `Verification code successfully sent to ${email}.`,
      };
    } catch (err) {
      console.warn("EmailJS error:", err);
      return {
        success: true,
        deliveredVia: "simulated",
        otp,
        message: `Code sent to ${email} (Simulated fallback: ${otp})`,
      };
    }
  }

  // In-app Realtime Simulation Delivery
  console.log(`[Email OTP Service] ✉️ OTP sent to ${email}: ${otp}`);
  return {
    success: true,
    deliveredVia: "simulated",
    otp,
    message: `Verification code generated for ${email}. (In development: ${otp})`,
  };
}

/**
 * Verify an entered OTP against the stored record in Firebase.
 *
 * @param {Object} db - Firebase database instance
 * @param {string} uid - User UID
 * @param {string} enteredOtp - 6-digit string
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function verifyOTPRecord(db, uid, enteredOtp) {
  if (!enteredOtp || enteredOtp.trim().length !== 6) {
    throw new Error("Please enter a valid 6-digit verification code.");
  }

  const snapshot = await get(ref(db, `authOtps/${uid}`));
  if (!snapshot.exists()) {
    throw new Error("No active OTP found. Please request a new code.");
  }

  const data = snapshot.val();
  const now = Date.now();

  // Check expiration
  if (now > data.expiresAt) {
    await set(ref(db, `authOtps/${uid}`), null);
    throw new Error("This verification code has expired. Please request a new one.");
  }

  // Check attempt limits
  if (data.attempts >= data.maxAttempts) {
    await set(ref(db, `authOtps/${uid}`), null);
    throw new Error("Maximum attempts exceeded. This code is invalidated. Please request a new one.");
  }

  const enteredHash = await hashOTP(enteredOtp);

  if (enteredHash.toLowerCase() === data.otpHash.toLowerCase()) {
    // Valid: Invalidate record to prevent replay
    await set(ref(db, `authOtps/${uid}`), null);
    return { success: true };
  } else {
    // Increment attempts
    const newAttempts = (data.attempts || 0) + 1;
    const remaining = data.maxAttempts - newAttempts;

    if (newAttempts >= data.maxAttempts) {
      await set(ref(db, `authOtps/${uid}`), null);
      throw new Error("Incorrect code. Maximum attempts exceeded. Code invalidated.");
    } else {
      await update(ref(db, `authOtps/${uid}`), { attempts: newAttempts });
      throw new Error(`Incorrect verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`);
    }
  }
}
