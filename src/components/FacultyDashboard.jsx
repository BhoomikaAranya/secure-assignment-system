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
}) {
  return (
    <div style={{ padding: "30px" }}>
      <h1>Faculty Dashboard</h1>

      <h3>Welcome {currentUser}</h3>

      <h3>Create Assignment</h3>

<input
  type="text"
  placeholder="Assignment Title"
  value={assignmentTitle}
  onChange={(e) =>
    setAssignmentTitle(e.target.value)
  }
/>

<br /><br />

<input
  type="text"
  placeholder="Subject"
  value={assignmentSubject}
  onChange={(e) =>
    setAssignmentSubject(e.target.value)
  }
/>

<br /><br />

<input
  type="date"
  value={deadline}
  onChange={(e) =>
    setDeadline(e.target.value)
  }
/>

<br /><br />

<button onClick={createAssignment}>
  Create Assignment
</button>

<hr />
      <button onClick={loadAllAssignments}>
        View All Assignments
      </button>

      <br /><br />

      {allAssignments.map((assignment, index) => (
        <div
          key={index}
          style={{
            border: "1px solid black",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <h4>{assignment.title}</h4>

          <p>Student: {assignment.studentEmail}</p>

          <p>Subject: {assignment.subject}</p>

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

          <p>{assignment.description}</p>

          <p>Submitted: {assignment.submittedAt}</p>

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
            Status: {assignment.status}
          </p>

          {assignment.feedback && (
            <p>Feedback: {assignment.feedback}</p>
          )}

          {assignment.status === "Pending" && (
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
                style={{ marginLeft: "10px" }}
              >
                Reject
              </button>
            </>
          )}
        </div>
      ))}

      <button onClick={logout}>
        Logout
      </button>
    </div>
  );
}

export default FacultyDashboard;