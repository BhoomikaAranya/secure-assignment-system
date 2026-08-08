function RoleSelection({ setSelectedRole }) {
  return (
    <div style={{ padding: "30px" }}>
      <h1>Secure Assignment Submission System</h1>

      <h2>Who are you?</h2>

      <button
        onClick={() =>
          setSelectedRole("student")
        }
      >
        Student
      </button>

      <button
        onClick={() =>
          setSelectedRole("faculty")
        }
        style={{ marginLeft: "10px" }}
      >
        Faculty
      </button>
    </div>
  );
}

export default RoleSelection;