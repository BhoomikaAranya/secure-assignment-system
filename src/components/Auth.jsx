function Auth({
  selectedRole,
  email,
  setEmail,
  password,
  setPassword,
  facultySubject,
  setFacultySubject,
  register,
  login,
}) {
  return (
    <div style={{ padding: "30px" }}>
      <h1>
        {selectedRole === "student"
          ? "Student Login"
          : selectedRole === "faculty"
          ? "Faculty Login"
          : "Secure Assignment Submission System"}
      </h1>

      <input
        type="email"
        placeholder="Enter Email"
        value={email}
        onChange={(e) =>
          setEmail(e.target.value)
        }
      />

      <br />
      <br />

      <input
        type="password"
        placeholder="Enter Password"
        value={password}
        onChange={(e) =>
          setPassword(e.target.value)
        }
      />

      <br />
      <br />

      {selectedRole === "faculty" && (
        <>
          <input
            type="text"
            placeholder="Faculty Subject"
            value={facultySubject}
            onChange={(e) =>
              setFacultySubject(
                e.target.value
              )
            }
          />

          <br />
          <br />
        </>
      )}

      <button onClick={register}>
        Register
      </button>

      <button
        onClick={login}
        style={{ marginLeft: "10px" }}
      >
        Login
      </button>
    </div>
  );
}

export default Auth;