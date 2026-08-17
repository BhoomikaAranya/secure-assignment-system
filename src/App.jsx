import FacultyDashboard from "./components/FacultyDashboard";
import StudentDashboard from "./components/StudentDashboard";
import RoleSelection from "./components/RoleSelection";
import Auth from "./components/Auth";
import Login from "./components/Login";
import { useState } from "react";
import { auth, db } from "./firebase";
import axios from "axios";
import {
  ref,
  set,
  push,
  get,
  update,
} from "firebase/database";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [selectedRole, setSelectedRole] =
  useState("");
  const [availableAssignments, setAvailableAssignments] = useState([]);
  const [currentUser, setCurrentUser] = useState("");
  const [userRole, setUserRole] = useState("");
  const [allAssignments, setAllAssignments] = useState([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [description, setDescription] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentSubject, setAssignmentSubject] = useState("");
  const [deadline, setDeadline] = useState("");
  const [facultySubject, setFacultySubject] =
  useState("");
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [myAssignments, setMyAssignments] = useState([]);
  
   const register = async () => {
  try {
    const userCredential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    const user = userCredential.user;

    alert(user.uid);

    // ✅ STUDENT REGISTRATION
    if (selectedRole === "student") {
      await set(ref(db, "students/" + user.uid), {
        email: user.email,
        role: "student",
        createdAt: new Date().toISOString(),
      });

      alert("Student Registered Successfully!");
    }

    // ✅ FACULTY REGISTRATION (NEW)
    else if (selectedRole === "faculty") {
      await set(ref(db, "faculty/" + user.uid), {
        email: user.email,
        role: "faculty",
        subject: facultySubject,
        createdAt: new Date().toISOString(),
      });

      alert("Faculty Registered Successfully!");
    }

  } catch (error) {
    alert(error.message);
  }
};

 const login = async () => {
  try {
    const userCredential =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    const user = userCredential.user;

    let userData = null;

    // 🔍 STEP 1: check students
    const studentSnap = await get(
      ref(db, "students/" + user.uid)
    );

    if (studentSnap.exists()) {
      userData = studentSnap.val();
    }

    // 🔍 STEP 2: check faculty
    const facultySnap = await get(
      ref(db, "faculty/" + user.uid)
    );

    if (facultySnap.exists()) {
      userData = facultySnap.val();
    }

    // ❌ if not found anywhere
    if (!userData) {
      alert("No user record found");
      return;
    }

    // ❌ role mismatch check
    if (userData.role !== selectedRole) {
      alert("Please use correct login page");
      return;
    }

    // ✅ set state
    setUserRole(userData.role);
    setCurrentUser(user.email);
    setLoggedIn(true);

    // 🔥 IMPORTANT: store faculty subject
    if (userData.role === "faculty") {
      setFacultySubject(userData.subject);
    }

    alert("Welcome " + user.email);

  } catch (error) {
    alert(error.message);
  }
};

  const logout = () => {
    setLoggedIn(false);
    setCurrentUser("");
    setUserRole("");
    setMyAssignments([]);
  };

  const uploadFileToCloudinary = async () => {
  if (!selectedFile) {
    return null;
  }

  const formData = new FormData();

  formData.append(
    "file",
    selectedFile
  );

  formData.append(
    "upload_preset",
    "assignment_uploads"
  );


  try {
  const response = await axios.post(
    "https://api.cloudinary.com/v1_1/ksbtuok3/raw/upload",
    formData
  );

  console.log("Cloudinary Success:", response.data);

  return response.data.secure_url;

} catch (error) {
  console.log("Cloudinary Error:", error);
  alert("Cloudinary Upload Failed");

  return null;
}
};



 const submitAssignment = async () => {
  try {
    const fileUrl =
  await uploadFileToCloudinary();
    const submissionId = "SUB-" + Date.now();

    const selectedAssignment =
  availableAssignments.find(
    (a) =>
      a.title === title &&
      a.subject === subject
  );

if (
  selectedAssignment &&
  new Date() >
    new Date(selectedAssignment.deadline)
) {
  alert(
    "Submission deadline has passed."
  );
  return;
}

    await push(ref(db, "assignments"), {
      submissionId,
      studentEmail: currentUser,
      title,
      subject,
      description,
      submittedAt: new Date().toLocaleString(),
      status: "Pending",
      fileUrl,
    fileName: selectedFile
    ? selectedFile.name
    : "",
    });

    await push(ref(db, "auditLogs"), {
  action: `Student submitted assignment: ${title}`,
  user: currentUser,
  timestamp: new Date().toLocaleString(),
});




    setReceipt({
  submissionId,
  studentEmail: currentUser,
  title,
  subject,
  submittedAt: new Date().toLocaleString(),
  status: "Pending",
});
    alert(
      `Assignment Submitted Successfully!\n\nSubmission ID: ${submissionId}\n\nStatus: Pending`
    );

    setTitle("");
    setSubject("");
    setDescription("");
    setSelectedFile(null);
  } catch (error) {
    alert(error.message);
  }
};



const createAssignment = async () => {
  try {
    await push(ref(db, "assignmentsCreated"), {
      title: assignmentTitle,
      subject: assignmentSubject,
      deadline,
      createdBy: currentUser,
      createdAt: new Date().toLocaleString(),
    });


await push(ref(db, "auditLogs"), {
  action: `Faculty created assignment: ${assignmentTitle}`,
  user: currentUser,
  timestamp: new Date().toLocaleString(),
});



    alert("Assignment Created Successfully!");

    setAssignmentTitle("");
    setAssignmentSubject("");
    setDeadline("");

  } catch (error) {
    alert(error.message);
  }
};



const loadAuditLogs = async () => {
  try {
    const snapshot = await get(ref(db, "auditLogs"));

    if (snapshot.exists()) {
      const data = snapshot.val();

      const logs = [];

      for (let key in data) {
        logs.push({
          id: key,
          ...data[key],
        });
      }

      logs.reverse();

      setAuditLogs(logs);
    }
  } catch (error) {
    alert(error.message);
  }
};


  const loadAssignments = async () => {
    try {
      const snapshot = await get(
        ref(db, "assignments")
      );
      

      if (snapshot.exists()) {
        const data = snapshot.val();

        const assignmentList = [];

        for (let key in data) {
          if (
            data[key].studentEmail ===
            currentUser
          ) {
            assignmentList.push(data[key]);
          }
        }

        setMyAssignments(
          assignmentList
        );
      }
    } catch (error) {
      alert(error.message);
    }
  };
  const loadAllAssignments = async () => {
  try {
    const snapshot = await get(ref(db, "assignments"));

    if (snapshot.exists()) {
      const data = snapshot.val();

      const assignmentList = [];

      for (let key in data) {
        assignmentList.push({
          id: key,
          ...data[key],
        });
      }

      // ✅ FILTER ONLY IF FACULTY
      let filteredList = assignmentList;

      if (userRole === "faculty") {
        filteredList = assignmentList.filter(
          (assignment) =>
            assignment.subject === facultySubject
        );
      }

      setAllAssignments(filteredList);
    }
  } catch (error) {
    alert(error.message);
  }
};


const loadAvailableAssignments = async () => {
  try {
    const snapshot = await get(
      ref(db, "assignmentsCreated")
    );

    if (snapshot.exists()) {
      const data = snapshot.val();

      const assignmentList = [];

      for (let key in data) {
        assignmentList.push({
          id: key,
          ...data[key],
        });
      }

      setAvailableAssignments(
        assignmentList
      );
    }
  } catch (error) {
    alert(error.message);
  }
};

const updateAssignmentStatus = async (id, status) => {
  try {
    console.log("Updating:", id, status);

    let feedback = "";

    if (status === "Rejected") {
      feedback = prompt("Enter feedback for student:");
      if (!feedback) feedback = "No feedback given";
    }

    if (status === "Approved") {
      feedback = prompt("Optional feedback (press cancel to skip):") || "";
    }

    console.log("Feedback:", feedback);

    await update(ref(db, `assignments/${id}`), {
      status: status,
      feedback: feedback,
    });

await push(ref(db, "auditLogs"), {
  action: `Faculty ${status} an assignment`,
  user: currentUser,
  timestamp: new Date().toLocaleString(),
});


await push(ref(db, "auditLogs"), {
  action: `Assignment ${status}`,
  user: currentUser,
  timestamp: new Date().toLocaleString(),
});

    alert("Updated successfully!");

    loadAllAssignments();

  } catch (error) {
    console.log(error);
    alert(error.message);
  }
};

  if (loggedIn && userRole === "faculty") {
  return (
    <FacultyDashboard
      currentUser={currentUser}
      allAssignments={allAssignments}
      loadAllAssignments={loadAllAssignments}
      updateAssignmentStatus={updateAssignmentStatus}
      logout={logout}
      assignmentTitle={assignmentTitle}
setAssignmentTitle={setAssignmentTitle}

assignmentSubject={assignmentSubject}
setAssignmentSubject={setAssignmentSubject}

deadline={deadline}
setDeadline={setDeadline}

createAssignment={createAssignment}

auditLogs={auditLogs}
loadAuditLogs={loadAuditLogs}
    />
  );
}



if (!selectedRole) {
  return (
    <RoleSelection
      setSelectedRole={
        setSelectedRole
      }
    />
  );
}


 
if (loggedIn) {
  return (
    <StudentDashboard
      currentUser={currentUser}
      userRole={userRole}
      title={title}
      setTitle={setTitle}
      subject={subject}
      setSubject={setSubject}
      description={description}
      setDescription={setDescription}
      submitAssignment={submitAssignment}
      loadAssignments={loadAssignments}
      myAssignments={myAssignments}
      logout={logout}
      receipt={receipt}
      availableAssignments={availableAssignments}
      loadAvailableAssignments={loadAvailableAssignments}
      selectedFile={selectedFile}
      setSelectedFile={setSelectedFile}


   />
  );
}


return (
  <Auth
    selectedRole={selectedRole}
    email={email}
    setEmail={setEmail}
    password={password}
    setPassword={setPassword}
    facultySubject={facultySubject}
    setFacultySubject={setFacultySubject}
    register={register}
    login={login}
  />
);
}
export default App;