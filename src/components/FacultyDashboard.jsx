import { useState } from "react";

import {
  calculateSHA256FromUrl,
} from "../services/hashService";

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
  // VERIFY FILE INTEGRITY
  // =====================================================

  const verifyFileIntegrity = async (assignment) => {
    try {
      // Check whether the submitted file exists
      if (!assignment.fileUrl) {
        alert("File URL is not available.");
        return;
      }

      // Check whether the original hash exists
      if (!assignment.fileHash) {
        alert(
          "No original SHA-256 hash is stored for this submission."
        );
        return;
      }

      alert(
        "Verifying file integrity. Please wait..."
      );

      // Calculate SHA-256 from the current file
      const currentHash =
        await calculateSHA256FromUrl(
          assignment.fileUrl
        );

      // Log both hashes for debugging
      console.log(
        "Stored SHA-256:",
        assignment.fileHash
      );

      console.log(
        "Current SHA-256:",
        currentHash
      );

      // Compare original hash with current hash
      if (
        assignment.fileHash.toLowerCase() ===
        currentHash.toLowerCase()
      ) {
        alert(
          "✅ File Integrity Verified!\n\n" +
          "The current file matches the original SHA-256 hash."
        );
      } else {
        alert(
          "❌ File Integrity Failed!\n\n" +
          "The current file does NOT match the original SHA-256 hash."
        );
      }
    } catch (error) {
      console.error(
        "Integrity verification failed:",
        error
      );

      alert(
        "Unable to verify file integrity.\n\n" +
        error.message
      );
    }
  };

  // =====================================================
  // RETURN UI
  // =====================================================

  return (
    <div style={{ padding: "30px" }}>

      {/* =================================================
          HEADER
      ================================================= */}

      <h1>Faculty Dashboard</h1>

      <h3>Welcome {currentUser}</h3>


      {/* =================================================
          CREATE ASSIGNMENT
      ================================================= */}

      <h3>Create Assignment</h3>

      <input
        type="text"
        placeholder="Assignment Title"
        value={assignmentTitle}
        onChange={(e) =>
          setAssignmentTitle(e.target.value)
        }
      />

      <br />
      <br />

      <input
        type="text"
        placeholder="Subject"
        value={assignmentSubject}
        onChange={(e) =>
          setAssignmentSubject(e.target.value)
        }
      />

      <br />
      <br />

      <input
        type="date"
        value={deadline}
        onChange={(e) =>
          setDeadline(e.target.value)
        }
      />

      <br />
      <br />

      <button onClick={createAssignment}>
        Create Assignment
      </button>

      <hr />


      {/* =================================================
          ACTION BUTTONS
      ================================================= */}

      <button onClick={loadAllAssignments}>
        View All Assignments
      </button>

      <button
        onClick={loadAuditLogs}
        style={{ marginLeft: "10px" }}
      >
        View Audit Logs
      </button>

      <br />
      <br />


      {/* =================================================
          ASSIGNMENT STATISTICS
      ================================================= */}

      <h2>Assignment Statistics</h2>

      <p>
        Total Assignments: {allAssignments.length}
      </p>

      <p>
        Pending:{" "}
        {
          allAssignments.filter(
            (a) => a.status === "Pending"
          ).length
        }
      </p>

      <p>
        Approved:{" "}
        {
          allAssignments.filter(
            (a) => a.status === "Approved"
          ).length
        }
      </p>

      <p>
        Rejected:{" "}
        {
          allAssignments.filter(
            (a) => a.status === "Rejected"
          ).length
        }
      </p>

      <hr />


      {/* =================================================
          AUDIT LOGS
      ================================================= */}

      <h2>Audit Logs</h2>

      {auditLogs.map((log, index) => (
        <div
          key={index}
          style={{
            border: "1px solid gray",
            padding: "8px",
            marginBottom: "5px",
          }}
        >
          <p>{log.action}</p>

          <p>
            User: {log.user}
          </p>

          <p>
            {log.timestamp}
          </p>
        </div>
      ))}


      {/* =================================================
          SEARCH
      ================================================= */}

      <h2>Search Assignments</h2>

      <input
        type="text"
        placeholder="Search by title, subject, email, submission ID"
        value={searchTerm}
        onChange={(e) =>
          setSearchTerm(e.target.value)
        }
      />

      <br />
      <br />


      {/* =================================================
          ASSIGNMENT LIST
      ================================================= */}

      {
        allAssignments
          .filter((assignment) =>
            (
              assignment.title +
              " " +
              assignment.subject +
              " " +
              assignment.studentEmail +
              " " +
              (assignment.submissionId || "")
            )
              .toLowerCase()
              .includes(
                searchTerm.toLowerCase()
              )
          )
          .map((assignment, index) => (

            <div
              key={index}
              style={{
                border: "1px solid black",
                padding: "15px",
                marginBottom: "15px",
              }}
            >

              {/* =========================================
                  ASSIGNMENT INFORMATION
              ========================================= */}

              <h4>
                {assignment.title}
              </h4>

              <p>
                <b>Student:</b>{" "}
                {assignment.studentEmail}
              </p>

              <p>
                <b>Subject:</b>{" "}
                {assignment.subject}
              </p>

              <p>
                <b>Submission ID:</b>{" "}
                {assignment.submissionId}
              </p>


              {/* =========================================
                  SUBMITTED FILE
              ========================================= */}

              {assignment.fileUrl && (
                <p>
                  <a
                    href={assignment.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Submitted File
                  </a>
                </p>
              )}

              {/* =========================================
                  SHA-256 FILE INTEGRITY VERIFICATION
              ========================================= */}

              {assignment.fileUrl &&
                assignment.fileHash && (
                  <div
                    style={{
                      marginTop: "10px",
                      marginBottom: "15px",
                    }}
                  >
                    <button
                      onClick={() =>
                        verifyFileIntegrity(
                          assignment
                        )
                      }
                    >
                      Verify File Integrity
                    </button>
                  </div>
                )}

              <p>
                {assignment.description}
              </p>

              <p>
                <b>Submitted:</b>{" "}
                {assignment.submittedAt}
              </p>


              {/* =========================================
                  SUBMISSION STATUS
              ========================================= */}

              <p
                style={{
                  color:
                    assignment.status ===
                    "Approved"
                      ? "green"
                      : assignment.status ===
                        "Rejected"
                      ? "red"
                      : "orange",
                }}
              >
                <b>Status:</b>{" "}
                {assignment.status}
              </p>


              {/* =========================================
                  PLAGIARISM ANALYSIS
              ========================================= */}

              <div
                style={{
                  border:
                    "2px solid #555",
                  padding: "12px",
                  marginTop: "15px",
                  marginBottom: "15px",
                  backgroundColor:
                    "#f5f5f5",
                }}
              >

                <h3>
                  Plagiarism Analysis
                </h3>


                {/* ---------------------------------------
                    ANALYZED
                --------------------------------------- */}

                {assignment.plagiarismAnalyzed ? (
                  <>
                    <p>
                      <b>
                        Similarity:
                      </b>{" "}
                      {assignment.plagiarismSimilarity}%
                    </p>

                    <p
                      style={{
                        color:
                          getPlagiarismColor(
                            assignment.plagiarismStatus
                          ),
                        fontWeight:
                          "bold",
                      }}
                    >
                      <b>
                        Result:
                      </b>{" "}
                      {assignment.plagiarismStatus}
                    </p>


                    {/* ---------------------------------
                        MATCHED SUBMISSION
                    --------------------------------- */}

                    {assignment.matchedSubmissionId && (
                      <p>
                        <b>
                          Matched Submission:
                        </b>{" "}
                        {assignment.matchedSubmissionId}
                      </p>
                    )}


                    {/* ---------------------------------
                        NO PREVIOUS SUBMISSION
                    --------------------------------- */}

                    {assignment.plagiarismStatus ===
                      "No Previous Submission" && (
                      <p
                        style={{
                          color: "blue",
                        }}
                      >
                        No previous comparable
                        submission was found.
                      </p>
                    )}
                  </>
                ) : (

                  /* -------------------------------------
                     NOT ANALYZED
                  ------------------------------------- */

                  <p
                    style={{
                      color: "gray",
                    }}
                  >
                    Plagiarism analysis was
                    not performed for this
                    submission.
                  </p>
                )}

              </div>


              {/* =================================================
                  FACULTY FEEDBACK
              ================================================= */}

              {assignment.feedback && (
                <p>
                  <b>Feedback:</b>{" "}
                  {assignment.feedback}
                </p>
              )}


              {/* =================================================
                  APPROVE / REJECT
              ================================================= */}

              {assignment.status ===
                "Pending" && (
                <>

                  <button
                    onClick={() =>
                      updateAssignmentStatus(
                        assignment.id,
                        "Approved"
                      )
                    }
                  >
                    Approve
                  </button>

                  <button
                    onClick={() =>
                      updateAssignmentStatus(
                        assignment.id,
                        "Rejected"
                      )
                    }
                    style={{
                      marginLeft: "10px",
                    }}
                  >
                    Reject
                  </button>

                </>
              )}

            </div>
          ))
      }


      {/* =================================================
          LOGOUT
      ================================================= */}

      <button onClick={logout}>
        Logout
      </button>

    </div>
  );
}

export default FacultyDashboard;