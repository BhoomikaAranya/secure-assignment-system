function StudentDashboard({
  currentUser,
  userRole,
  openSecurityDashboard,
  title,
  setTitle,
  subject,
  setSubject,
  description,
  setDescription,
  submitAssignment,
  loadAssignments,
  myAssignments,
  logout,
  receipt,
  availableAssignments,
  loadAvailableAssignments,
  selectedAssignmentId,
  setSelectedAssignmentId,
  selectedFile,
  setSelectedFile,
  isSubmitting = false,
}) {

  return (
    <div style={{ padding: "30px", maxWidth: "900px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1>Student Dashboard</h1>

      <h3>Welcome {currentUser}</h3>

      <h4>Role: {userRole}</h4>

      {selectedAssignmentId ? (
        <div
          style={{
            padding: "10px",
            backgroundColor: "#e8f5e9",
            border: "1px solid #4caf50",
            borderRadius: "4px",
            marginBottom: "15px",
          }}
        >
          <b>🎯 Target Assignment:</b> {title} ({subject})
        </div>
      ) : (
        <div
          style={{
            padding: "10px",
            backgroundColor: "#fff3e0",
            border: "1px solid #ff9800",
            borderRadius: "4px",
            marginBottom: "15px",
          }}
        >
          ⚠️ Please select an assignment from <b>Available Assignments</b> below before submitting.
        </div>
      )}

      <input
        type="text"
        placeholder="Assignment Title"
        value={title}
        readOnly
        style={{ width: "100%", padding: "8px", boxSizing: "border-box", backgroundColor: "#f9f9f9" }}
      />

      <br /><br />

      <input
        type="text"
        placeholder="Subject"
        value={subject}
        readOnly
        style={{ width: "100%", padding: "8px", boxSizing: "border-box", backgroundColor: "#f9f9f9" }}
      />

      <br /><br />

      <textarea
        placeholder="Description / Remarks (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
      />

      <br /><br />

      <div style={{ border: "1px dashed #666", padding: "15px", borderRadius: "4px", marginBottom: "15px" }}>
        <label>
          <b>Select File to Encrypt & Submit (.pdf, .docx, .doc):</b>
          <br /><br />
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) =>
              setSelectedFile(e.target.files?.[0] || null)
            }
          />
        </label>
        {selectedFile && (
          <p style={{ marginTop: "10px", color: "#0066cc" }}>
            📎 Selected: <b>{selectedFile.name}</b> ({(selectedFile.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      <button
        onClick={submitAssignment}
        disabled={isSubmitting || !selectedAssignmentId || !selectedFile}
        style={{
          padding: "10px 20px",
          backgroundColor: isSubmitting ? "#cccccc" : "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: isSubmitting ? "not-allowed" : "pointer",
          fontWeight: "bold",
        }}
      >
        {isSubmitting ? "🔒 Encrypting & Submitting..." : "🔒 Encrypt & Submit Assignment"}
      </button>

      <button
        onClick={loadAssignments}
        style={{ marginLeft: "10px", padding: "10px 15px" }}
      >
        My Submissions
      </button>

      <button
        onClick={loadAvailableAssignments}
        style={{ marginLeft: "10px", padding: "10px 15px" }}
      >
        Refresh Available Assignments
      </button>

      <br /><br />

      {receipt && (
        <div
          style={{
            border: "2px solid green",
            padding: "15px",
            marginBottom: "20px",
            backgroundColor: "#f0fff0",
            borderRadius: "4px",
          }}
        >
          <h3>Digital Submission Receipt</h3>
          <p><b>Submission ID:</b> {receipt.submissionId}</p>
          <p><b>Student:</b> {receipt.studentEmail}</p>
          <p><b>Assignment:</b> {receipt.title}</p>
          <p><b>Subject:</b> {receipt.subject}</p>
          <p><b>Status:</b> {receipt.status}</p>
          <p><b>Submitted At:</b> {receipt.submittedAt}</p>
          {receipt.ciphertextHash && (
            <p style={{ wordBreak: "break-all" }}>
              <b>Ciphertext SHA-256:</b> <code>{receipt.ciphertextHash}</code>
            </p>
          )}
        </div>
      )}

      <h3>Available Assignments</h3>

      {availableAssignments.length === 0 ? (
        <p style={{ color: "gray" }}>No available assignments loaded. Click &quot;Refresh Available Assignments&quot; above.</p>
      ) : (
        availableAssignments.map((assignment) => {
          const isPassed = new Date() > new Date(assignment.deadline);
          const isSelected = assignment.id === selectedAssignmentId;

          return (
            <div
              key={assignment.id}
              style={{
                border: isSelected ? "2px solid #007bff" : "1px solid #ccc",
                backgroundColor: isSelected ? "#eef6ff" : "white",
                padding: "15px",
                marginBottom: "12px",
                borderRadius: "4px",
                boxShadow: isSelected ? "0 2px 6px rgba(0,123,255,0.2)" : "none",
              }}
            >
              <h4>{assignment.title}</h4>
              <p><b>Subject:</b> {assignment.subject}</p>
              <p><b>Deadline:</b> {assignment.deadline}</p>
              {assignment.createdBy && <p><b>Faculty:</b> {assignment.createdBy}</p>}

              <button
                disabled={isPassed}
                onClick={() => {
                  setSelectedAssignmentId(assignment.id);
                  setTitle(assignment.title);
                  setSubject(assignment.subject);
                }}
                style={{
                  padding: "6px 12px",
                  backgroundColor: isSelected ? "#28a745" : isPassed ? "#ccc" : "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: isPassed ? "not-allowed" : "pointer",
                }}
              >
                {isPassed
                  ? "Deadline Passed"
                  : isSelected
                    ? "✓ Selected"
                    : "Select Assignment"}
              </button>
            </div>
          );
        })
      )}

      <h3>My Submissions</h3>

      {myAssignments.length === 0 ? (
        <p style={{ color: "gray" }}>No submissions found. Click &quot;My Submissions&quot; to load your history.</p>
      ) : (
        myAssignments.map((assignment, index) => (
          <div
            key={assignment.id || index}
            style={{
              border: "1px solid black",
              padding: "12px",
              marginBottom: "10px",
              borderRadius: "4px",
            }}
          >
            <h4>{assignment.title}</h4>
            <p><b>Submission ID:</b> {assignment.submissionId}</p>
            <p><b>Subject:</b> {assignment.subject}</p>
            <p>
              <b>Security Status:</b>{" "}
              {assignment.isEncrypted ? (
                <span style={{ color: "green", fontWeight: "bold" }}>🔒 AES-256-GCM Encrypted</span>
              ) : (
                <span style={{ color: "gray" }}>📄 Legacy Unencrypted</span>
              )}
            </p>
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

            {assignment.feedback && (
              <p style={{ color: "blue" }}>
                <b>Faculty Feedback:</b> {assignment.feedback}
              </p>
            )}

            <p>{assignment.description}</p>

            <p>
              Submitted: {assignment.submittedAt}
            </p>
          </div>
        ))
      )}

      <div style={{ marginTop: "20px" }}>
        <button
          onClick={openSecurityDashboard}
          style={{
            marginRight: "10px",
            padding: "10px 16px",
            backgroundColor: "#166534",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          🔐 Security Dashboard
        </button>

        <button onClick={logout} style={{ padding: "10px 16px", borderRadius: "8px", cursor: "pointer" }}>
          Logout
        </button>
      </div>
    </div>
  );
}

export default StudentDashboard;