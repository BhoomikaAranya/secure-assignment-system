// src/components/OTPVerification.jsx
import { useState, useEffect } from "react";
import { maskEmail } from "../services/otpService";

function OTPVerification({
  email,
  onVerify,
  onResend,
  onCancel,
  expiresAt,
  simulatedCode,
  isVerifying,
}) {
  const [enteredOtp, setEnteredOtp] = useState("");
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  );
  const [resendCooldown, setResendCooldown] = useState(30);
  const [errorMsg, setErrorMsg] = useState("");

  // Countdown timer for OTP expiration
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  // Cooldown timer for Resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [resendCooldown]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (enteredOtp.length !== 6) {
      setErrorMsg("Please enter all 6 digits.");
      return;
    }
    setErrorMsg("");
    try {
      await onVerify(enteredOtp);
    } catch (err) {
      setErrorMsg(err.message || "Verification failed.");
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setErrorMsg("");
    try {
      await onResend();
      setResendCooldown(30);
      setEnteredOtp("");
    } catch (err) {
      setErrorMsg(err.message || "Failed to resend code.");
    }
  };

  return (
    <div
      style={{
        maxWidth: "460px",
        margin: "60px auto",
        padding: "30px",
        border: "1px solid #e0e0e0",
        borderRadius: "10px",
        backgroundColor: "#ffffff",
        boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "42px", marginBottom: "10px" }}>🔐</div>

      <h2 style={{ margin: "0 0 10px 0", color: "#1a202c" }}>
        Two-Factor Authentication
      </h2>

      <p style={{ color: "#4a5568", fontSize: "14px", lineHeight: "1.5", margin: "0 0 20px 0" }}>
        We have sent a 6-digit verification code to:
        <br />
        <b style={{ color: "#2b6cb0" }}>{maskEmail(email)}</b>
      </p>

      {/* Simulated code display for local development & testing */}
      {simulatedCode && (
        <div
          style={{
            backgroundColor: "#ebf8ff",
            border: "1px dashed #3182ce",
            borderRadius: "6px",
            padding: "10px",
            marginBottom: "20px",
            fontSize: "13px",
            color: "#2b6cb0",
          }}
        >
          <b>📧 In-Development Code:</b> <code style={{ fontSize: "16px", fontWeight: "bold" }}>{simulatedCode}</code>
          <div style={{ fontSize: "11px", color: "#718096", marginTop: "4px" }}>
            (Delivered instantly for testing. When EmailJS credentials are set, this delivers directly via email.)
          </div>
        </div>
      )}

      {/* Timer badge */}
      <div style={{ marginBottom: "20px" }}>
        {timeLeft > 0 ? (
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              backgroundColor: timeLeft < 60 ? "#fed7d7" : "#edf2f7",
              color: timeLeft < 60 ? "#c53030" : "#4a5568",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "600",
            }}
          >
            ⏱️ Code expires in: {formatTime(timeLeft)}
          </span>
        ) : (
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              backgroundColor: "#fed7d7",
              color: "#c53030",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "600",
            }}
          >
            ⚠️ Code expired! Please request a new code.
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "20px" }}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="• • • • • •"
            value={enteredOtp}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 6);
              setEnteredOtp(val);
              setErrorMsg("");
            }}
            disabled={isVerifying || timeLeft <= 0}
            style={{
              width: "220px",
              padding: "12px 16px",
              fontSize: "24px",
              letterSpacing: "8px",
              textAlign: "center",
              border: "2px solid #cbd5e0",
              borderRadius: "8px",
              outline: "none",
              fontWeight: "bold",
            }}
            autoFocus
          />
        </div>

        {errorMsg && (
          <div
            style={{
              color: "#e53e3e",
              fontSize: "13px",
              marginBottom: "15px",
              fontWeight: "500",
            }}
          >
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={isVerifying || enteredOtp.length !== 6 || timeLeft <= 0}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor:
              isVerifying || enteredOtp.length !== 6 || timeLeft <= 0
                ? "#cbd5e0"
                : "#3182ce",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "15px",
            fontWeight: "bold",
            cursor:
              isVerifying || enteredOtp.length !== 6 || timeLeft <= 0
                ? "not-allowed"
                : "pointer",
            marginBottom: "15px",
          }}
        >
          {isVerifying ? "Verifying..." : "Verify & Sign In"}
        </button>
      </form>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "15px" }}>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0}
          style={{
            background: "none",
            border: "none",
            color: resendCooldown > 0 ? "#a0aec0" : "#3182ce",
            cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
            fontSize: "13px",
            textDecoration: "underline",
            padding: "0",
          }}
        >
          {resendCooldown > 0
            ? `Resend Code in ${resendCooldown}s`
            : "Resend Code"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          style={{
            background: "none",
            border: "none",
            color: "#718096",
            cursor: "pointer",
            fontSize: "13px",
            textDecoration: "underline",
            padding: "0",
          }}
        >
          Cancel & Log In Again
        </button>
      </div>
    </div>
  );
}

export default OTPVerification;
