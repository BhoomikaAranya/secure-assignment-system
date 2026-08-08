function StudentDashboard({
  currentUser,
  userRole,
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
  selectedFile,
  setSelectedFile,
}) {


  return (
    <div style={{ padding: "30px" }}>
      <h1>Student Dashboard</h1>

      <h3>Welcome {currentUser}</h3>

      <h4>Role: {userRole}</h4>

      <input
        type="text"
        placeholder="Assignment Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <br /><br />

      <input
        type="text"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />

      <br /><br />

      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <br /><br />

      <button onClick={submitAssignment}>
        Submit Assignment
      </button>

      <button
        onClick={loadAssignments}
        style={{ marginLeft: "10px" }}
      >
        My Assignments
      </button>


    <button
  onClick={loadAvailableAssignments}
  style={{ marginLeft: "10px" }}
>
  View Available Assignments
</button>


      <br /><br />
    {receipt && (
  <div
    style={{
      border: "2px solid green",
      padding: "15px",
      marginBottom: "20px",
      backgroundColor: "#f0fff0",
    }}
  >
    <h3>Digital Submission Receipt</h3>

    <p><b>Submission ID:</b> {receipt.submissionId}</p>

    <p><b>Student:</b> {receipt.studentEmail}</p>

    <p><b>Assignment:</b> {receipt.title}</p>

    <p><b>Subject:</b> {receipt.subject}</p>

    <p><b>Status:</b> {receipt.status}</p>

    <p><b>Submitted At:</b> {receipt.submittedAt}</p>
  </div>
)}

<input
  type="file"
  accept=".pdf,.doc,.docx"
  onChange={(e) =>
    setSelectedFile(e.target.files[0])
  }
/>

<br /><br />

<p>
  Selected File:
  {selectedFile?.name}
</p>




<h3>Available Assignments</h3>

{availableAssignments.map((assignment) => (
  <div
    key={assignment.id}
    style={{
      border: "1px solid blue",
      padding: "10px",
      marginBottom: "10px",
    }}
  >
    <h4>{assignment.title}</h4>

    <p>
      Subject: {assignment.subject}
    </p>

    <p>
      Deadline: {assignment.deadline}
    </p>
    
<button
  disabled={
    new Date() >
    new Date(assignment.deadline)
  }
  onClick={() => {
    setTitle(assignment.title);
    setSubject(assignment.subject);
  }}
>
  {new Date() >
  new Date(assignment.deadline)
    ? "Deadline Passed"
    : "Select Assignment"}
</button>


  </div>
))}



      {myAssignments.map((assignment, index) => (
        <div
          key={index}
          style={{
            border: "1px solid black",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <h4>{assignment.title}</h4>
          <p>
  <b>Submission ID:</b> {assignment.submissionId}
</p>
          <p>Subject: {assignment.subject}</p>

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
            <p style={{ color: "blue" }}>
              Faculty Feedback: {assignment.feedback}
            </p>
          )}

          <p>{assignment.description}</p>

          <p>
            Submitted: {assignment.submittedAt}
          </p>
        </div>
      ))}

      <button onClick={logout}>
        Logout
      </button>
    </div>
  );
}

export default StudentDashboard;