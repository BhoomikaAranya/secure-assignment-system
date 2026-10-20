

import { useState } from "react";
import {
  signFileHash,
  verifyFileSignature,
} from "../services/digitalSignatureService";


function SecurityDashboard({
  currentUser,
  auditLogs = [],
  myAssignments = [],
  onBack,
}) {
    
  const [verificationResults, setVerificationResults] = useState({});
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [signatureTestResults, setSignatureTestResults] = useState(null);
  const [isTestingSignature, setIsTestingSignature] = useState(false);

  const runSignatureTest = async () => {
    setIsTestingSignature(true);
    setSignatureTestResults(null);

    try {
      const testHash = "assignment-signature-test-123";

      const testSignature = await signFileHash(
        testHash,
        "dashboard-test@example.com"
      );

      const valid = await verifyFileSignature(
        testHash,
        testSignature.signature,
        testSignature.publicKey
      );

      const changedHash = await verifyFileSignature(
        "modified-assignment-hash",
        testSignature.signature,
        testSignature.publicKey
      );

      const invalidSignature = btoa("not-a-real-signature");
      let wrongSignature = false;

      try {
        wrongSignature = await verifyFileSignature(
          testHash,
          invalidSignature,
          testSignature.publicKey
        );
      } catch {
        wrongSignature = false;
      }

      setSignatureTestResults({
        valid,
        changedHash,
        wrongSignature,
        passed: valid && !changedHash && !wrongSignature,
      });
    } catch (error) {
      setSignatureTestResults({
        error: error.message || "Signature test failed.",
      });
    } finally {
      setIsTestingSignature(false);
    }
  };

  
  const verifyAllSignatures = async () => {
    setIsVerifying(true);

    try {
      const results = {};

      for (const item of myAssignments) {
        const id = item.submissionId || item.id || item.title;

        if (
          !item.fileHash ||
          !item.digitalSignature ||
          !item.signingPublicKey
        ) {
          results[id] = "Missing signature data";
          continue;
        }

        try {
          const isValid = await verifyFileSignature(
            item.fileHash,
            item.digitalSignature,
            item.signingPublicKey
          );

          results[id] = isValid ? "Valid" : "Invalid";
        } catch {
          results[id] = "Verification failed";
        }
      }

      setVerificationResults(results);
    } finally {
      setIsVerifying(false);
    }
  };


  const verifiedSubmissions = myAssignments.filter(
    (item) =>
      item.fileHash &&
      item.digitalSignature &&
      item.signingPublicKey
  ).length;

  const pendingSubmissions = myAssignments.filter(
    (item) => item.status === "Pending"
  ).length;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1>🔐 Security Dashboard</h1>
          <p>Secure Assignment Submission System</p>
          <small>Logged in as: {currentUser}</small>
        </div>

        {onBack && (
          <button onClick={onBack} style={styles.backButton}>
            Back to Dashboard
          </button>
        )}
      </header>

      <section style={styles.cards}>
        <div style={styles.card}>
          <h3>My Submissions</h3>
          <p style={styles.number}>{myAssignments.length}</p>
        </div>

        <div style={styles.card}>
          <h3>Pending Reviews</h3>
          <p style={styles.number}>{pendingSubmissions}</p>
        </div>

        <div style={styles.card}>
          <h3>Signature Data Present</h3>
          <p style={styles.number}>{verifiedSubmissions}</p>
          <small>
            These records contain signature data; they have not
            yet been cryptographically verified here.
          </small>
        </div>
      </section>

      <section style={styles.panel}>
        <h2>Submission Security Records</h2>
        
        <button
          onClick={runSignatureTest}
          disabled={isTestingSignature}
          style={{
            padding: "10px 16px",
            marginBottom: "16px",
            background: "#1d4ed8",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: isTestingSignature ? "wait" : "pointer",
          }}
        >
          {isTestingSignature
            ? "Testing..."
            : "🧪 Test Signature Integrity"}
        </button>

        {signatureTestResults && (
          <div
            style={{
              padding: "16px",
              marginBottom: "20px",
              borderRadius: "8px",
              background: signatureTestResults.passed
                ? "#dcfce7"
                : "#fee2e2",
              color: signatureTestResults.passed
                ? "#166534"
                : "#991b1b",
            }}
          >
            <h3>Digital Signature Test Results</h3>

            {signatureTestResults.error ? (
              <p>Test error: {signatureTestResults.error}</p>
            ) : (
              <>
                <p>
                  Original signature:{" "}
                  {String(signatureTestResults.valid)}
                </p>
                <p>
                  Changed hash:{" "}
                  {String(signatureTestResults.changedHash)}
                </p>
                <p>
                  Incorrect signature:{" "}
                  {String(signatureTestResults.wrongSignature)}
                </p>
                <strong>
                  {signatureTestResults.passed
                    ? "SUCCESS: All tests passed!"
                    : "FAILED: Check the test results."}
                </strong>
              </>
            )}
          </div>
        )}

        
        <button
          onClick={verifyAllSignatures}
          disabled={isVerifying}
          style={{
            padding: "10px 16px",
            marginBottom: "16px",
            background: "#166534",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: isVerifying ? "wait" : "pointer",
          }}
        >
          {isVerifying ? "Verifying..." : "🔐 Verify Signatures"}
        </button>


        {myAssignments.length === 0 ? (
          <p>No submissions found.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>File Hash</th>
                  <th>Signature Data</th>
                  <th>Verification</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {myAssignments.map((item, index) => (
                  <tr key={item.submissionId || index}>
                    <td>{item.title || "Untitled"}</td>
                    <td>
                      {item.fileHash ? "Present" : "Missing"}
                    </td>
                    <td>
                      {item.digitalSignature &&
                      item.signingPublicKey
                        ? "Present"
                        : "Missing"}
                    </td>
                    
                    <td>
                      {verificationResults[
                        item.submissionId || item.id || item.title
                      ] || "Not checked"}
                    </td>

                    <td>{item.status || "Unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={styles.panel}>
        <h2>Recent Audit Events</h2>

        {auditLogs.length === 0 ? (
          <p>No audit events have been loaded.</p>
        ) : (
          auditLogs.slice(0, 10).map((log, index) => (
            <div key={log.id || index} style={styles.log}>
              <strong>{log.action || "Recorded event"}</strong>
              <p>{log.user || "Unknown user"}</p>
              <small>{log.timestamp || "Time unavailable"}</small>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "28px",
    background: "#f3f6f5",
    color: "#1f2937",
    fontFamily: "Arial, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "28px",
  },
  backButton: {
    padding: "10px 16px",
    border: "none",
    borderRadius: "8px",
    background: "#166534",
    color: "white",
    cursor: "pointer",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  card: {
    padding: "20px",
    borderRadius: "12px",
    background: "white",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  number: {
    fontSize: "30px",
    fontWeight: "bold",
    color: "#166534",
    margin: "10px 0",
  },
  panel: {
    background: "white",
    padding: "22px",
    borderRadius: "12px",
    marginBottom: "22px",
    overflowX: "auto",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },
  log: {
    padding: "12px 0",
    borderBottom: "1px solid #e5e7eb",
  },
};

export default SecurityDashboard;
