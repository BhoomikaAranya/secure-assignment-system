import { useState } from "react";

function Login({
  role,
  auth,
  db,
  signInWithEmailAndPassword,
  ref,
  get,
  onLoginSuccess,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    try {
      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      const user = userCredential.user;

      const snapshot = await get(
        ref(db, "students/" + user.uid)
      );

      const facultySnapshot = await get(
        ref(db, "faculty/" + user.uid)
      );

      if (
        role === "student" &&
        snapshot.exists()
      ) {
        onLoginSuccess(user);
      } else if (
        role === "faculty" &&
        facultySnapshot.exists()
      ) {
        onLoginSuccess(user);
      } else {
        alert(
          `This account is not registered as ${role}`
        );
      }
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div>
      <h2>{role} Login</h2>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) =>
          setEmail(e.target.value)
        }
      />

      <br />
      <br />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) =>
          setPassword(e.target.value)
        }
      />

      <br />
      <br />

      <button onClick={login}>
        Login
      </button>
    </div>
  );
}

export default Login;