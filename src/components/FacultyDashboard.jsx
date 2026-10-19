import { useState, useEffect, useCallback } from "react";
import { auth, db } from "../firebase";
import { ref, get, set, push } from "firebase/database";

import {
  calculateSHA256FromUrl,
  calculateSHA256FromArrayBuffer,
} from "../services/hashService";

import {
  generateECCKeyPair,
  exportECCPublicKey,
  protectPrivateKeyWithPassphrase,
  unlockPrivateKeyWithPassphrase,
  unwrapAESKeyForFaculty,
  decryptFile,
} from "../services/encryptionService";

function FacultyDashboard({
  currentUser,
  allAssignments,
  loadAllAssignments,
  updateAssignmentStatus,
  logout,
  assignmentTitle,
  setAssignmentTitle,
  assignmentSubject,
  setAssignmentSubject,
  deadline,
  setDeadline,
  createAssignment,
  auditLogs,
  loadAuditLogs,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  // =====================================================
  // CRYPTOGRAPHIC KEY MANAGEMENT STATES (IN-MEMORY ONLY)
  // =====================================================
  const [unlockedPrivateKey, setUnlockedPrivateKey] = useState(null);
  const [keyStatus, setKeyStatus] = useState("checking"); // "checking" | "not_found" | "locked" | "unlocked"
  const [keyInfo, setKeyInfo] = useState(null);
  const [isProcessingKey, setIsProcessingKey] = useState(false);

  // Verification state map: { [submissionId]: { status: "verified"|"failed", computedHash: string } }
  const [verificationMap, setVerificationMap] = useState({});
  const [decryptingMap, setDecryptingMap] = useState({});

  // =====================================================
  // CHECK REGISTERED KEY STATUS IN FIREBASE
  // =====================================================
  const checkKeyStatus = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const pubSnap = await get(ref(db, `facultyKeys/${user.uid}/publicKey`));
      const privSnap = await get(ref(db, `facultyKeys/${user.uid}/protectedPrivateKey`));

      if (pubSnap.exists() && privSnap.exists()) {
        setKeyInfo({
          ownerUid: user.uid,
          updatedAt: privSnap.val().updatedAt || pubSnap.val().updatedAt || "N/A",
        });
        setKeyStatus(unlockedPrivateKey ? "unlocked" : "locked");
      } else {
        setKeyInfo(null);
        setKeyStatus("not_found");
      }
    } catch (err) {
      console.error("Failed to check key status:", err);
      setKeyStatus("not_found");
    }
  }, [unlockedPrivateKey]);

  useEffect(() => {
    checkKeyStatus();
  }, [checkKeyStatus]);

  // =====================================================
  // REGISTER NEW ECC KEY PAIR (PROTECTED WITH PASSPHRASE)
  // =====================================================
  const registerFacultyKey = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to register an encryption key.");
      return;
    }

    if (keyStatus === "locked" || keyStatus === "unlocked") {
      const confirmed = window.confirm(
        "⚠️ CAUTION: You already have a registered encryption key.\n\n" +
        "If you generate a new key pair, you will NOT be able to decrypt past submissions encrypted with your previous key unless you restore that key.\n\n" +
        "Are you sure you want to replace your key pair?"
      );
      if (!confirmed) return;
    }

    const passphrase = window.prompt(
      "Set an unlocking passphrase for your private key (minimum 8 characters):\n" +
      "⚠️ Do NOT forget this passphrase. Without it, encrypted student submissions cannot be decrypted."
    );

    if (!passphrase) return;

    if (passphrase.length < 8) {
      alert("Passphrase must be at least 8 characters long.");
      return;
    }

    const confirmPassphrase = window.prompt("Confirm your unlocking passphrase:");
    if (passphrase !== confirmPassphrase) {
      alert("Passphrases do not match. Key registration cancelled.");
      return;
    }

    try {
      setIsProcessingKey(true);

      // Generate ECC P-256 Key Pair
      const keyPair = await generateECCKeyPair();

      // Protect private key with PBKDF2-SHA256 (200k iterations) + AES-256-GCM
      const protectedPrivate = await protectPrivateKeyWithPassphrase(
        keyPair.privateKey,
        passphrase
      );

      // Export public key as JWK
      const publicJwk = await exportECCPublicKey(keyPair.publicKey);

      const timestamp = new Date().toISOString();

      // Store in Firebase under facultyKeys/{uid}
      await set(ref(db, `facultyKeys/${user.uid}/publicKey`), {
        ...publicJwk,
        ownerUid: user.uid,
        email: user.email || currentUser,
        updatedAt: timestamp,
      });

      await set(ref(db, `facultyKeys/${user.uid}/protectedPrivateKey`), {
        ...protectedPrivate,
        ownerUid: user.uid,
        updatedAt: timestamp,
      });

      // Audit log
      await push(ref(db, "auditLogs"), {
        action: "Faculty registered new ECC P-256 key pair",
        user: user.email || currentUser,
        userUid: user.uid,
        timestamp,
      });

      // Cache unlocked private key in memory for this session
      setUnlockedPrivateKey(keyPair.privateKey);
      setKeyStatus("unlocked");
      setKeyInfo({ ownerUid: user.uid, updatedAt: timestamp });

      alert(
        "✅ ECC Key Pair Generated Successfully!\n\n" +
        "Your public key is registered for students to wrap submission keys.\n" +
        "Your private key is protected with PBKDF2-SHA256 and stored securely."
      );
    } catch (err) {
      console.error("Key registration failed:", err);
      alert("Failed to register key pair: " + err.message);
    } finally {
      setIsProcessingKey(false);
    }
  };

  // =====================================================
  // UNLOCK PRIVATE KEY WITH PASSPHRASE (INTO MEMORY)
  // =====================================================
  const unlockPrivateKey = async (optionalProvidedPassphrase = null) => {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in.");
      return null;
    }

    const passphrase =
      optionalProvidedPassphrase ||
      window.prompt("Enter your passphrase to unlock your faculty private key:");

    if (!passphrase) return null;

    try {
      setIsProcessingKey(true);

      const privSnap = await get(
        ref(db, `facultyKeys/${user.uid}/protectedPrivateKey`)
      );

      if (!privSnap.exists()) {
        throw new Error("No protected private key found. Please register your key pair first.");
      }

      const protectedData = privSnap.val();
      const privateKey = await unlockPrivateKeyWithPassphrase(
        protectedData,
        passphrase
      );

      setUnlockedPrivateKey(privateKey);
      setKeyStatus("unlocked");

      if (!optionalProvidedPassphrase) {
        alert("🔓 Key unlocked successfully in session memory!");
      }

      return privateKey;
    } catch (err) {
      console.error("Unlock key failed:", err);
      alert("❌ Unlock failed: " + err.message);
      return null;
    } finally {
      setIsProcessingKey(false);
    }
  };

  // =====================================================
  // LOCK PRIVATE KEY (CLEAR FROM MEMORY)
  // =====================================================
  const lockPrivateKey = () => {
    setUnlockedPrivateKey(null);
    setKeyStatus("locked");
    alert("🔒 Faculty key locked. In-memory private key cleared.");
  };

  // =====================================================
  // GET PLAGIARISM STATUS STYLE
  // =====================================================
  const getPlagiarismColor = (status) => {
    switch (status) {
      case "High Similarity":
        return "red";
      case "Moderate Similarity":
        return "orange";
      case "Low Similarity":
        return "green";
      case "No Previous Submission":
        return "blue";
      case "Analysis Failed":
        return "red";
      default:
        return "gray";
    }
  };

  // =====================================================
  // VERIFY CIPHERTEXT INTEGRITY (FOR ENCRYPTED SUBMISSIONS)
  // =====================================================
  const verifyCiphertextIntegrity = async (assignment) => {
    if (!assignment.fileUrl) {
      alert("File URL is not available.");
      return false;
    }

    if (!assignment.ciphertextHash) {
      alert("No ciphertext SHA-256 hash is recorded for this submission.");
      return false;
    }

    try {
      setVerificationMap((prev) => ({
        ...prev,
        [assignment.id]: { status: "verifying" },
      }));

      const response = await fetch(assignment.fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file from storage: HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const currentHash = await calculateSHA256FromArrayBuffer(arrayBuffer);

      const isValid =
        currentHash.toLowerCase() === assignment.ciphertextHash.toLowerCase();

      if (isValid) {
        setVerificationMap((prev) => ({
          ...prev,
          [assignment.id]: {
            status: "verified",
            computedHash: currentHash,
          },
        }));
        alert(
          "✅ File Integrity Verified!\n\n" +
          "The downloaded ciphertext exactly matches the stored SHA-256 hash:\n" +
          currentHash
        );
        return true;
      } else {
        setVerificationMap((prev) => ({
          ...prev,
          [assignment.id]: {
            status: "failed",
            computedHash: currentHash,
          },
        }));
        alert(
          "❌ File Integrity Failed!\n\n" +
          "The ciphertext does NOT match the original submission hash.\n" +
          "Stored: " + assignment.ciphertextHash + "\n" +
          "Calculated: " + currentHash + "\n\n" +
          "Decryption is blocked to prevent processing tampered or corrupted files."
        );
        return false;
      }
    } catch (err) {
      console.error("Ciphertext integrity verification failed:", err);
      setVerificationMap((prev) => ({
        ...prev,
        [assignment.id]: { status: "failed", error: err.message },
      }));
      alert("Unable to verify ciphertext integrity: " + err.message);
      return false;
    }
  };

  // =====================================================
  // VERIFY PLAINTEXT FILE INTEGRITY (FOR LEGACY SUBMISSIONS)
  // =====================================================
  const verifyLegacyFileIntegrity = async (assignment) => {
    try {
      if (!assignment.fileUrl) {
        alert("File URL is not available.");
        return;
      }

      if (!assignment.fileHash) {
        alert("No original SHA-256 hash is stored for this submission.");
        return;
      }

      alert("Verifying file integrity. Please wait...");
      const currentHash = await calculateSHA256FromUrl(assignment.fileUrl);

      if (assignment.fileHash.toLowerCase() === currentHash.toLowerCase()) {
        alert(
          "✅ File Integrity Verified!\n\n" +
          "The current file matches the original SHA-256 hash:\n" +
          currentHash
        );
      } else {
        alert(
          "❌ File Integrity Failed!\n\n" +
          "The current file does NOT match the original SHA-256 hash."
        );
      }
    } catch (error) {
      console.error("Legacy integrity verification failed:", error);
      alert("Unable to verify file integrity: " + error.message);
    }
  };

  // =====================================================
  // DECRYPT AND DOWNLOAD ASSIGNMENT
  // =====================================================
  const decryptAndDownloadAssignment = async (assignment) => {
    // 1. Mandatory Integrity Check:
    let isVerified = verificationMap[assignment.id]?.status === "verified";
    if (!isVerified) {
      const verifiedNow = await verifyCiphertextIntegrity(assignment);
      if (!verifiedNow) {
        alert("🛑 Decryption Blocked: File integrity verification failed or was not satisfied.");
        return;
      }
    }

    // 2. Ensure Faculty Private Key is Unlocked in Memory:
    let privateKey = unlockedPrivateKey;
    if (!privateKey) {
      privateKey = await unlockPrivateKey();
      if (!privateKey) {
        return; // User cancelled or unlock failed
      }
    }

    // 3. Validate Wrapped AES Key
    if (!assignment.wrappedAESKey) {
      alert("This submission does not contain wrapped AES key metadata.");
      return;
    }

    if (!assignment.iv) {
      alert("This submission does not contain initialization vector (IV) metadata.");
      return;
    }

    try {
      setDecryptingMap((prev) => ({ ...prev, [assignment.id]: true }));

      // 4. Unwrap AES Key using Faculty Private Key
      const aesKey = await unwrapAESKeyForFaculty(
        assignment.wrappedAESKey,
        privateKey
      );

      // 5. Fetch Ciphertext from Cloudinary
      const response = await fetch(assignment.fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch ciphertext from storage: HTTP ${response.status}`);
      }
      const ciphertextBlob = await response.blob();

      // 6. Decrypt Ciphertext with AES-256-GCM
      const decryptedBlob = await decryptFile(
        ciphertextBlob,
        aesKey,
        assignment.iv,
        assignment.fileMimeType || "application/octet-stream"
      );

      // 7. Trigger Browser Download with Original Filename
      const downloadName = assignment.fileName || `decrypted_${assignment.submissionId}.pdf`;
      const objectUrl = URL.createObjectURL(decryptedBlob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Revoke URL after a safe interval
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

      // 8. Audit log for decryption
      const user = auth.currentUser;
      if (user) {
        await push(ref(db, "auditLogs"), {
          action: `Faculty decrypted submission: ${assignment.submissionId} (${assignment.title})`,
          user: user.email || currentUser,
          userUid: user.uid,
          timestamp: new Date().toISOString(),
        });
      }

      alert(`✅ Decryption successful!\n\nDownloaded original file: ${downloadName}`);
    } catch (err) {
      console.error("Decryption failed:", err);
      alert("❌ Decryption failed:\n\n" + err.message);
    } finally {
      setDecryptingMap((prev) => ({ ...prev, [assignment.id]: false }));
    }
  };

  // =====================================================
  // RETURN UI
  // =====================================================
  return (
    <div style={{ padding: "30px", maxWidth: "1000px", margin: "0 auto", fontFamily: "sans-serif" }}>

      {/* =================================================
          HEADER
      ================================================= */}
      <h1>Faculty Dashboard</h1>
      <h3>Welcome {currentUser}</h3>

      {/* =================================================
          CRYPTOGRAPHIC KEY MANAGEMENT PANEL
      ================================================= */}
      <div
        style={{
          border: "2px solid #0056b3",
          padding: "16px",
          borderRadius: "6px",
          backgroundColor: "#f4f8ff",
          marginBottom: "25px",
        }}
      >
        <h3 style={{ marginTop: 0, color: "#003366" }}>
          🔐 Faculty Cryptographic Key Management (ECC P-256 / PBKDF2)
        </h3>

        {keyStatus === "checking" && <p>Checking encryption key status...</p>}

        {keyStatus === "not_found" && (
          <div>
            <p style={{ color: "#d9534f", fontWeight: "bold" }}>
              ⚠️ No encryption key pair registered for this faculty account.
            </p>
            <p style={{ fontSize: "14px", color: "#555" }}>
              Students will not be able to securely encrypt submissions for your assignments until you register your ECC key pair.
            </p>
            <button
              onClick={registerFacultyKey}
              disabled={isProcessingKey}
              style={{
                padding: "8px 16px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              🔑 Generate & Register ECC Key Pair
            </button>
          </div>
        )}

        {keyStatus === "locked" && (
          <div>
            <p style={{ color: "#e67e22", fontWeight: "bold" }}>
              🔒 Key Status: Registered & Locked (Private key not loaded in memory)
            </p>
            <p style={{ fontSize: "13px", color: "#555" }}>
              Last updated: {keyInfo?.updatedAt}
            </p>
            <button
              onClick={() => unlockPrivateKey()}
              disabled={isProcessingKey}
              style={{
                padding: "8px 16px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                marginRight: "10px",
              }}
            >
              🔓 Unlock Private Key with Passphrase
            </button>
            <button
              onClick={registerFacultyKey}
              disabled={isProcessingKey}
              style={{
                padding: "8px 12px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Regenerate Key Pair
            </button>
          </div>
        )}

        {keyStatus === "unlocked" && (
          <div>
            <p style={{ color: "#28a745", fontWeight: "bold" }}>
              🔓 Key Status: Unlocked in Session Memory
            </p>
            <p style={{ fontSize: "13px", color: "#555" }}>
              Your private key is held securely in active memory for this session and will never be logged or stored in plaintext.
            </p>
            <button
              onClick={lockPrivateKey}
              style={{
                padding: "8px 16px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              🔒 Lock Key (Clear Memory)
            </button>
          </div>
        )}
      </div>

      {/* =================================================
          CREATE ASSIGNMENT
      ================================================= */}
      <div style={{ border: "1px solid #ccc", padding: "16px", borderRadius: "6px", marginBottom: "25px" }}>
        <h3>Create Assignment</h3>

        <input
          type="text"
          placeholder="Assignment Title"
          value={assignmentTitle}
          onChange={(e) => setAssignmentTitle(e.target.value)}
          style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
        />

        <br /><br />

        <input
          type="text"
          placeholder="Subject"
          value={assignmentSubject}
          onChange={(e) => setAssignmentSubject(e.target.value)}
          style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
        />

        <br /><br />

        <label>
          <b>Submission Deadline:</b>
          <br />
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            style={{ padding: "8px", marginTop: "4px" }}
          />
        </label>

        <br /><br />

        <button
          onClick={createAssignment}
          style={{
            padding: "8px 16px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Create Assignment
        </button>
      </div>

      {/* =================================================
          ACTION BUTTONS
      ================================================= */}
      <button onClick={loadAllAssignments} style={{ padding: "8px 16px" }}>
        Refresh Submissions
      </button>

      <button
        onClick={loadAuditLogs}
        style={{ marginLeft: "10px", padding: "8px 16px" }}
      >
        View Audit Logs
      </button>

      <br /><br />

      {/* =================================================
          ASSIGNMENT STATISTICS
      ================================================= */}
      <h2>Assignment Statistics</h2>
      <p>Total Assignments: {allAssignments.length}</p>
      <p>Pending: {allAssignments.filter((a) => a.status === "Pending").length}</p>
      <p>Approved: {allAssignments.filter((a) => a.status === "Approved").length}</p>
      <p>Rejected: {allAssignments.filter((a) => a.status === "Rejected").length}</p>

      <hr style={{ margin: "20px 0" }} />

      {/* =================================================
          AUDIT LOGS
      ================================================= */}
      {auditLogs.length > 0 && (
        <div style={{ marginBottom: "25px" }}>
          <h2>Audit Logs</h2>
          <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid #ddd", padding: "10px" }}>
            {auditLogs.map((log, index) => (
              <div
                key={log.id || index}
                style={{
                  borderBottom: "1px solid #eee",
                  padding: "6px 0",
                  fontSize: "13px",
                }}
              >
                <b>{log.action}</b> — User: {log.user} ({log.timestamp})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================
          SEARCH
      ================================================= */}
      <h2>Search Assignments</h2>
      <input
        type="text"
        placeholder="Search by title, subject, student email, or submission ID"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
      />

      <br /><br />

      {/* =================================================
          ASSIGNMENT LIST
      ================================================= */}
      <h2>Student Submissions</h2>

      {allAssignments.length === 0 ? (
        <p style={{ color: "gray" }}>No submissions found for your subjects/assignments.</p>
      ) : (
        allAssignments
          .filter((assignment) =>
            (
              (assignment.title || "") +
              " " +
              (assignment.subject || "") +
              " " +
              (assignment.studentEmail || "") +
              " " +
              (assignment.submissionId || "")
            )
              .toLowerCase()
              .includes(searchTerm.toLowerCase())
          )
          .map((assignment, index) => {
            const isEncrypted = Boolean(
              assignment.isEncrypted ||
              assignment.wrappedAESKey ||
              assignment.ciphertextHash
            );

            const vState = verificationMap[assignment.id] || { status: "idle" };
            const isDecrypting = Boolean(decryptingMap[assignment.id]);

            return (
              <div
                key={assignment.id || index}
                style={{
                  border: isEncrypted ? "2px solid #0056b3" : "1px solid #888",
                  borderRadius: "6px",
                  padding: "16px",
                  marginBottom: "18px",
                  backgroundColor: isEncrypted ? "#fafcff" : "white",
                }}
              >
                {/* Security Mode Badge */}
                <div style={{ marginBottom: "8px" }}>
                  {isEncrypted ? (
                    <span
                      style={{
                        backgroundColor: "#e3f2fd",
                        color: "#0d47a1",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        border: "1px solid #90caf9",
                      }}
                    >
                      🔒 End-to-End Encrypted (AES-256-GCM + ECC P-256)
                    </span>
                  ) : (
                    <span
                      style={{
                        backgroundColor: "#f5f5f5",
                        color: "#616161",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        border: "1px solid #ccc",
                      }}
                    >
                      📄 Legacy Plaintext Submission
                    </span>
                  )}
                </div>

                <h4>{assignment.title}</h4>
                <p><b>Student:</b> {assignment.studentEmail}</p>
                <p><b>Subject:</b> {assignment.subject}</p>
                <p><b>Submission ID:</b> <code>{assignment.submissionId}</code></p>
                <p><b>Original Filename:</b> {assignment.fileName || "N/A"}</p>

                {/* Encrypted Workflow vs Legacy Workflow */}
                {isEncrypted ? (
                  <div
                    style={{
                      backgroundColor: "#f0f4f8",
                      border: "1px solid #cbd5e1",
                      padding: "12px",
                      borderRadius: "6px",
                      marginTop: "10px",
                      marginBottom: "15px",
                    }}
                  >
                    <p style={{ margin: "4px 0", wordBreak: "break-all", fontSize: "12px" }}>
                      <b>Ciphertext SHA-256:</b> <code>{assignment.ciphertextHash}</code>
                    </p>

                    {vState.status === "verified" && (
                      <p style={{ color: "#28a745", fontWeight: "bold", margin: "6px 0" }}>
                        ✅ Ciphertext Integrity Verified (SHA-256 matches)
                      </p>
                    )}

                    {vState.status === "failed" && (
                      <p style={{ color: "#dc3545", fontWeight: "bold", margin: "6px 0" }}>
                        ❌ Ciphertext Integrity Failed! Do not decrypt.
                      </p>
                    )}

                    <div style={{ marginTop: "10px" }}>
                      <button
                        onClick={() => verifyCiphertextIntegrity(assignment)}
                        disabled={vState.status === "verifying"}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#17a2b8",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          marginRight: "10px",
                        }}
                      >
                        {vState.status === "verifying"
                          ? "Checking Hash..."
                          : "Verify Ciphertext Integrity"}
                      </button>

                      <button
                        onClick={() => decryptAndDownloadAssignment(assignment)}
                        disabled={isDecrypting}
                        style={{
                          padding: "6px 14px",
                          backgroundColor: "#28a745",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: isDecrypting ? "wait" : "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        {isDecrypting ? "🔓 Decrypting..." : "🔓 Decrypt & Download Original File"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: "10px", marginBottom: "15px" }}>
                    {assignment.fileUrl && (
                      <p>
                        <a href={assignment.fileUrl} target="_blank" rel="noreferrer">
                          View Submitted File (Plaintext)
                        </a>
                      </p>
                    )}

                    {assignment.fileUrl && assignment.fileHash && (
                      <button onClick={() => verifyLegacyFileIntegrity(assignment)}>
                        Verify Plaintext File Integrity
                      </button>
                    )}
                  </div>
                )}

                {assignment.description && <p><b>Description:</b> {assignment.description}</p>}
                <p><b>Submitted:</b> {assignment.submittedAt}</p>

                <p
                  style={{
                    color:
                      assignment.status === "Approved"
                        ? "green"
                        : assignment.status === "Rejected"
                        ? "red"
                        : "orange",
                  }}
                >
                  <b>Status:</b> {assignment.status}
                </p>

                {/* Plagiarism Analysis */}
                <div
                  style={{
                    border: "1px solid #ccc",
                    padding: "10px",
                    marginTop: "10px",
                    marginBottom: "10px",
                    backgroundColor: "#fbfbfb",
                    borderRadius: "4px",
                  }}
                >
                  <h4 style={{ margin: "0 0 8px 0" }}>Plagiarism Analysis</h4>
                  {assignment.plagiarismAnalyzed ? (
                    <>
                      <p><b>Similarity:</b> {assignment.plagiarismSimilarity}%</p>
                      <p
                        style={{
                          color: getPlagiarismColor(assignment.plagiarismStatus),
                          fontWeight: "bold",
                        }}
                      >
                        <b>Result:</b> {assignment.plagiarismStatus}
                      </p>
                      {assignment.matchedSubmissionId && (
                        <p><b>Matched Submission:</b> {assignment.matchedSubmissionId}</p>
                      )}
                    </>
                  ) : (
                    <p style={{ color: "gray" }}>Plagiarism analysis was not performed for this submission.</p>
                  )}
                </div>

                {/* Feedback */}
                {assignment.feedback && (
                  <p><b>Feedback:</b> {assignment.feedback}</p>
                )}

                {/* Approve / Reject */}
                {assignment.status === "Pending" && (
                  <div style={{ marginTop: "10px" }}>
                    <button
                      onClick={() => updateAssignmentStatus(assignment.id, "Approved")}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#28a745",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateAssignmentStatus(assignment.id, "Rejected")}
                      style={{
                        marginLeft: "10px",
                        padding: "6px 12px",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })
      )}

      <hr style={{ margin: "25px 0" }} />

      <button onClick={logout} style={{ padding: "8px 16px" }}>
        Logout
      </button>
    </div>
  );
}

export default FacultyDashboard;