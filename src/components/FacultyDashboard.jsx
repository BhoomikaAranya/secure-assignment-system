import { useState } from "react";

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