import FacultyDashboard from "./components/FacultyDashboard";
import SecurityDashboard from "./components/SecurityDashboard";
import StudentDashboard from "./components/StudentDashboard";
import RoleSelection from "./components/RoleSelection";
import Auth from "./components/Auth";


import { useState } from "react";

import { auth, db } from "./firebase";

import axios from "axios";

import {
  extractTextFromFile,
} from "./services/textExtractionService";

import {
  findMostSimilarSubmission,
  getSimilarityStatus,
} from "./services/plagiarismService";

import { calculateSHA256 } from "./services/hashService";
import { signFileHash } from "./services/digitalSignatureService";

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

  // =====================================================
  // AUTHENTICATION STATES
  // =====================================================

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loggedIn, setLoggedIn] = useState(false);
  const [showSecurityDashboard, setShowSecurityDashboard] = useState(false);

  const [selectedRole, setSelectedRole] =
    useState("");

  const [currentUser, setCurrentUser] =
    useState("");

  const [userRole, setUserRole] =
    useState("");


  // =====================================================
  // STUDENT STATES
  // =====================================================

  const [title, setTitle] =
    useState("");

  const [subject, setSubject] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [myAssignments, setMyAssignments] =
    useState([]);

  const [availableAssignments, setAvailableAssignments] =
    useState([]);

  const [receipt, setReceipt] =
    useState(null);


  // =====================================================
  // FACULTY STATES
  // =====================================================

  const [assignmentTitle, setAssignmentTitle] =
    useState("");

  const [assignmentSubject, setAssignmentSubject] =
    useState("");

  const [deadline, setDeadline] =
    useState("");

  const [facultySubject, setFacultySubject] =
    useState("");

  const [allAssignments, setAllAssignments] =
    useState([]);

  const [auditLogs, setAuditLogs] =
    useState([]);


  // =====================================================
  // REGISTER
  // =====================================================

  const register = async () => {

    try {

      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

      const user =
        userCredential.user;


      // =================================================
      // STUDENT REGISTRATION
      // =================================================

      if (selectedRole === "student") {

        await set(
          ref(
            db,
            "students/" + user.uid
          ),
          {
            email: user.email,
            role: "student",
            createdAt:
              new Date().toISOString(),
          }
        );

        alert(
          "Student Registered Successfully!"
        );
      }


      // =================================================
      // FACULTY REGISTRATION
      // =================================================

      else if (
        selectedRole === "faculty"
      ) {

        await set(
          ref(
            db,
            "faculty/" + user.uid
          ),
          {
            email: user.email,
            role: "faculty",
            subject: facultySubject,
            createdAt:
              new Date().toISOString(),
          }
        );

        alert(
          "Faculty Registered Successfully!"
        );
      }

    } catch (error) {

      alert(error.message);

    }
  };


  // =====================================================
  // LOGIN
  // =====================================================

  const login = async () => {

    try {

      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      const user =
        userCredential.user;

      let userData = null;


      // =================================================
      // CHECK STUDENT
      // =================================================

      const studentSnap =
        await get(
          ref(
            db,
            "students/" + user.uid
          )
        );


      if (studentSnap.exists()) {

        userData =
          studentSnap.val();

      }


      // =================================================
      // CHECK FACULTY
      // =================================================

      const facultySnap =
        await get(
          ref(
            db,
            "faculty/" + user.uid
          )
        );


      if (facultySnap.exists()) {

        userData =
          facultySnap.val();

      }


      // =================================================
      // USER RECORD NOT FOUND
      // =================================================

      if (!userData) {

        alert(
          "No user record found"
        );

        return;
      }


      // =================================================
      // ROLE VALIDATION
      // =================================================

      if (
        userData.role !==
        selectedRole
      ) {

        alert(
          "Please use correct login page"
        );

        return;
      }


      // =================================================
      // SET LOGIN STATE
      // =================================================

      setUserRole(
        userData.role
      );

      setCurrentUser(
        user.email
      );

      setLoggedIn(true);


      // =================================================
      // STORE FACULTY SUBJECT
      // =================================================

      if (
        userData.role === "faculty"
      ) {

        setFacultySubject(
          userData.subject
        );
      }


      alert(
        "Welcome " + user.email
      );

    } catch (error) {

      alert(error.message);

    }
  };


  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = () => {

    setLoggedIn(false);

    setCurrentUser("");

    setUserRole("");

    setMyAssignments([]);

    setAllAssignments([]);

    setReceipt(null);

    setSelectedFile(null);
  };


  // =====================================================
  // CLOUDINARY FILE UPLOAD
  // =====================================================

  const uploadFileToCloudinary =
    async () => {

      if (!selectedFile) {

        return null;
      }


      const formData =
        new FormData();


      formData.append(
        "file",
        selectedFile
      );


      formData.append(
        "upload_preset",
        "assignment_uploads"
      );


      try {

        const response =
          await axios.post(
            "https://api.cloudinary.com/v1_1/ksbtuok3/raw/upload",
            formData
          );


        console.log(
          "Cloudinary Success:",
          response.data
        );


        return response.data.secure_url;

      } catch (error) {

        console.log(
          "Cloudinary Error:",
          error
        );

        alert(
          "Cloudinary Upload Failed"
        );

        return null;
      }
    };


  // =====================================================
  // SUBMIT ASSIGNMENT
  // =====================================================

  const submitAssignment =
    async () => {

      try {

        // =================================================
        // BASIC FILE CHECK
        // =================================================

        if (!selectedFile) {

          alert(
            "Please select an assignment file."
          );

          return;
        }


        // =================================================
        // CHECK DEADLINE BEFORE UPLOAD
        // =================================================

        const selectedAssignment =
          availableAssignments.find(
            (assignment) =>
              assignment.title === title &&
              assignment.subject === subject
          );


        if (
          selectedAssignment &&
          new Date() >
            new Date(
              selectedAssignment.deadline
            )
        ) {

          alert(
            "Submission deadline has passed."
          );

          return;
        }


        // =================================================
        // CREATE SUBMISSION ID
        // =================================================

        const submissionId =
          "SUB-" + Date.now();

         
        // =================================================
        // SHA-256 FILE INTEGRITY HASH
        // =================================================

       

        // SHA-256 FILE HASH
        const fileHash = await calculateSHA256(selectedFile);

        console.log("SHA-256 File Hash:", fileHash);

        // CHECK FOR EXACT DUPLICATE FILES
        const existingSnapshot = await get(ref(db, "assignments"));

        if (existingSnapshot.exists()) {
          const existingData = existingSnapshot.val();

          const duplicate = Object.entries(existingData).find(
            ([, submission]) =>
              submission.fileHash === fileHash
          );

          if (duplicate) {
            const [existingKey, existingSubmission] = duplicate;

            const sameStudent =
              existingSubmission.studentEmail === currentUser;

            const message = sameStudent
              ? `You have already submitted this exact file.\n` +
                `Previous Submission ID: ${
                  existingSubmission.submissionId || existingKey
                }\n\nDo you want to submit it again?`
              : `Duplicate file detected!\n` +
                `This exact file matches an existing submission.\n` +
                `Assignment: ${existingSubmission.title || "Untitled"}\n\n` +
                `Do you want to continue anyway?`;

            const confirmed = window.confirm(message);

            if (!confirmed) {
              return;
            }
          }
        }

        // DIGITAL SIGNATURE
        const digitalSignature = await signFileHash(
          fileHash,
          currentUser
        );


console.log(
  "Digital signature generated successfully."
);

        // =================================================
        // DEFAULT PLAGIARISM RESULT
        // =================================================

        let plagiarismResult = {

          analyzed: false,

          similarity: 0,

          status: "Not Analyzed",

          matchedSubmissionId: null,

          extractedText: "",
        };


        // =================================================
        // FILE TYPE CHECK
        // =================================================

        const fileName =
          selectedFile.name.toLowerCase();


        const isPdf =
          fileName.endsWith(".pdf");


        const isDocx =
          fileName.endsWith(".docx");


        // =================================================
        // PLAGIARISM ANALYSIS
        // =================================================

        if (
          isPdf ||
          isDocx
        ) {

          try {

            // ---------------------------------------------
            // EXTRACT TEXT
            // ---------------------------------------------

            const extractedText =
              await extractTextFromFile(
                selectedFile
              );


            console.log(
              "Extracted characters:",
              extractedText.length
            );


            // ---------------------------------------------
            // LOAD EXISTING SUBMISSIONS
            // ---------------------------------------------

            const snapshot =
              await get(
                ref(
                  db,
                  "assignments"
                )
              );


            const previousSubmissions =
              [];


            if (snapshot.exists()) {

              const data =
                snapshot.val();


              for (
                const key in data
              ) {

                const submission =
                  data[key];


                // ---------------------------------------
                // ONLY COMPARE:
                //
                // SAME TITLE
                // SAME SUBJECT
                // HAS EXTRACTED TEXT
                // DIFFERENT STUDENT
                // ---------------------------------------

                if (

                  submission.title ===
                    title &&

                  submission.subject ===
                    subject &&

                  submission.extractedText &&

                  submission.studentEmail !==
                    currentUser

                ) {

                  previousSubmissions.push({

                    id: key,

                    submissionId:
                      submission.submissionId,

                    studentEmail:
                      submission.studentEmail,

                    text:
                      submission.extractedText,

                  });
                }
              }
            }


            console.log(
              "Previous comparable submissions:",
              previousSubmissions.length
            );


            // ---------------------------------------------
            // COMPARE AGAINST PREVIOUS SUBMISSIONS
            // ---------------------------------------------

            if (
              previousSubmissions.length > 0
            ) {

              const result =
                findMostSimilarSubmission(
                  extractedText,
                  previousSubmissions
                );


              plagiarismResult = {

                analyzed: true,

                similarity:
                  result.similarity,

                status:
                  getSimilarityStatus(
                    result.similarity
                  ),

                matchedSubmissionId:
                  result.matchedSubmission
                    ? result
                        .matchedSubmission
                        .submissionId
                    : null,

                extractedText:
                  extractedText,
              };


              console.log(
                "Plagiarism Result:",
                plagiarismResult
              );

            }


            // ---------------------------------------------
            // NO PREVIOUS SUBMISSION
            // ---------------------------------------------

            else {

              plagiarismResult = {

                analyzed: true,

                similarity: 0,

                status:
                  "No Previous Submission",

                matchedSubmissionId:
                  null,

                extractedText:
                  extractedText,
              };


              console.log(
                "No previous comparable submission found."
              );
            }


          } catch (
            plagiarismError
          ) {

            console.error(
              "Plagiarism analysis failed:",
              plagiarismError
            );


            plagiarismResult = {

              analyzed: false,

              similarity: 0,

              status:
                "Analysis Failed",

              matchedSubmissionId:
                null,

              extractedText:
                "",
            };
          }
        }


        // =================================================
        // DOC FILE
        // =================================================

        else if (
          fileName.endsWith(".doc")
        ) {

          plagiarismResult = {

            analyzed: false,

            similarity: 0,

            status:
              "Not Analyzed",

            matchedSubmissionId:
              null,

            extractedText:
              "",
          };
        }


        // =================================================
        // UPLOAD TO CLOUDINARY
        // =================================================

        const fileUrl =
          await uploadFileToCloudinary();


        if (!fileUrl) {

          alert(
            "Assignment submission stopped because file upload failed."
          );

          return;
        }


        // =================================================
        // STORE SUBMISSION IN FIREBASE
        // =================================================

        await push(
          ref(
            db,
            "assignments"
          ),
          {

            submissionId,

            studentEmail:
              currentUser,

            title,

            subject,

            description,

            submittedAt:
              new Date().toLocaleString(),

            status:
              "Pending",

            fileUrl,

            fileName:
              selectedFile
                ? selectedFile.name
                : "",

           // ===========================================
          // SHA-256 FILE HASH
          // ===========================================

          fileHash,
          digitalSignature: digitalSignature.signature,

signingPublicKey: digitalSignature.publicKey,

signatureAlgorithm: digitalSignature.algorithm,
            // -------------------------------------------
            // PLAGIARISM DATA
            // -------------------------------------------

            plagiarismAnalyzed:
              plagiarismResult.analyzed,

            plagiarismSimilarity:
              plagiarismResult.similarity,

            plagiarismStatus:
              plagiarismResult.status,

            matchedSubmissionId:
              plagiarismResult.matchedSubmissionId,

            extractedText:
              plagiarismResult.extractedText,
          }
        );


        // =================================================
        // AUDIT LOG
        // =================================================

        await push(
          ref(
            db,
            "auditLogs"
          ),
          {

            action:
              `Student submitted assignment: ${title}`,

            user:
              currentUser,

            timestamp:
              new Date().toLocaleString(),
          }
        );


        // =================================================
        // DIGITAL RECEIPT
        // =================================================

        setReceipt({

          submissionId,

          studentEmail:
            currentUser,

          title,

          subject,

          submittedAt:
            new Date().toLocaleString(),

          status:
            "Pending",
        });


        // =================================================
        // SUCCESS MESSAGE
        // =================================================

        alert(

          `Assignment Submitted Successfully!\n\n` +

          `Submission ID: ${submissionId}\n\n` +

          `Plagiarism Status: ` +
          `${plagiarismResult.status}\n` +

          `Similarity: ` +
          `${plagiarismResult.similarity}%`

        );


        // =================================================
        // CLEAR FORM
        // =================================================

        setTitle("");

        setSubject("");

        setDescription("");

        setSelectedFile(null);


      } catch (error) {

        console.error(
          "Submission error:",
          error
        );

        alert(
          error.message
        );
      }
    };


  // =====================================================
  // CREATE ASSIGNMENT
  // =====================================================

  const createAssignment =
    async () => {

      try {

        await push(
          ref(
            db,
            "assignmentsCreated"
          ),
          {

            title:
              assignmentTitle,

            subject:
              assignmentSubject,

            deadline,

            createdBy:
              currentUser,

            createdAt:
              new Date().toLocaleString(),
          }
        );


        await push(
          ref(
            db,
            "auditLogs"
          ),
          {

            action:
              `Faculty created assignment: ${assignmentTitle}`,

            user:
              currentUser,

            timestamp:
              new Date().toLocaleString(),
          }
        );


        alert(
          "Assignment Created Successfully!"
        );


        setAssignmentTitle("");

        setAssignmentSubject("");

        setDeadline("");


      } catch (error) {

        alert(
          error.message
        );
      }
    };


  // =====================================================
  // LOAD AUDIT LOGS
  // =====================================================

  const loadAuditLogs =
    async () => {

      try {

        const snapshot =
          await get(
            ref(
              db,
              "auditLogs"
            )
          );


        if (snapshot.exists()) {

          const data =
            snapshot.val();


          const logs = [];


          for (
            let key in data
          ) {

            logs.push({

              id: key,

              ...data[key],

            });
          }


          logs.reverse();


          setAuditLogs(
            logs
          );
        }

      } catch (error) {

        alert(
          error.message
        );
      }
    };


  // =====================================================
  // LOAD STUDENT ASSIGNMENTS
  // =====================================================

  const loadAssignments =
    async () => {

      try {

        const snapshot =
          await get(
            ref(
              db,
              "assignments"
            )
          );


        if (snapshot.exists()) {

          const data =
            snapshot.val();


          const assignmentList =
            [];


          for (
            let key in data
          ) {

            if (
              data[key]
                .studentEmail ===
              currentUser
            ) {

              assignmentList.push(
                data[key]
              );
            }
          }


          setMyAssignments(
            assignmentList
          );
        }

      } catch (error) {

        alert(
          error.message
        );
      }
    };


  // =====================================================
  // LOAD ALL FACULTY ASSIGNMENTS
  // =====================================================

  const loadAllAssignments =
    async () => {

      try {

        const snapshot =
          await get(
            ref(
              db,
              "assignments"
            )
          );


        if (snapshot.exists()) {

          const data =
            snapshot.val();


          const assignmentList =
            [];


          for (
            let key in data
          ) {

            assignmentList.push({

              id: key,

              ...data[key],

            });
          }


          // ---------------------------------------------
          // FACULTY SUBJECT FILTER
          // ---------------------------------------------

          let filteredList =
            assignmentList;


          if (
            userRole ===
            "faculty"
          ) {

            filteredList =
              assignmentList.filter(
                (assignment) =>
                  assignment.subject ===
                  facultySubject
              );
          }


          setAllAssignments(
            filteredList
          );
        }

      } catch (error) {

        alert(
          error.message
        );
      }
    };


  // =====================================================
  // LOAD AVAILABLE ASSIGNMENTS
  // =====================================================

  const loadAvailableAssignments =
    async () => {

      try {

        const snapshot =
          await get(
            ref(
              db,
              "assignmentsCreated"
            )
          );


        if (snapshot.exists()) {

          const data =
            snapshot.val();


          const assignmentList =
            [];


          for (
            let key in data
          ) {

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

        alert(
          error.message
        );
      }
    };


  // =====================================================
  // UPDATE ASSIGNMENT STATUS
  // =====================================================

  const updateAssignmentStatus =
    async (
      id,
      status
    ) => {

      try {

        console.log(
          "Updating:",
          id,
          status
        );


        let feedback = "";


        // ---------------------------------------------
        // REJECTED
        // ---------------------------------------------

        if (
          status ===
          "Rejected"
        ) {

          feedback =
            prompt(
              "Enter feedback for student:"
            );


          if (!feedback) {

            feedback =
              "No feedback given";
          }
        }


        // ---------------------------------------------
        // APPROVED
        // ---------------------------------------------

        if (
          status ===
          "Approved"
        ) {

          feedback =
            prompt(
              "Optional feedback (press cancel to skip):"
            ) || "";
        }


        console.log(
          "Feedback:",
          feedback
        );


        await update(
          ref(
            db,
            `assignments/${id}`
          ),
          {

            status:
              status,

            feedback:
              feedback,
          }
        );


        // ---------------------------------------------
        // AUDIT LOG
        // ---------------------------------------------

        await push(
          ref(
            db,
            "auditLogs"
          ),
          {

            action:
              `Faculty ${status} an assignment`,

            user:
              currentUser,

            timestamp:
              new Date().toLocaleString(),
          }
        );


        await push(
          ref(
            db,
            "auditLogs"
          ),
          {

            action:
              `Assignment ${status}`,

            user:
              currentUser,

            timestamp:
              new Date().toLocaleString(),
          }
        );


        alert(
          "Updated successfully!"
        );


        loadAllAssignments();


      } catch (error) {

        console.log(
          error
        );

        alert(
          error.message
        );
      }
    };


  // =====================================================
  // SECURITY DASHBOARD
  // =====================================================

  if (loggedIn && showSecurityDashboard) {
    return (
      <SecurityDashboard
        currentUser={currentUser}
        auditLogs={auditLogs}
        myAssignments={
          userRole === "faculty"
            ? allAssignments
            : myAssignments
        }
        onBack={() => setShowSecurityDashboard(false)}
      />
    );
  }

  // =====================================================
  // FACULTY DASHBOARD
  // =====================================================

  if (
    loggedIn &&
    userRole === "faculty"
  ) {

    return (

      <FacultyDashboard

        currentUser={
          currentUser
        }

        allAssignments={
          allAssignments
        }

        loadAllAssignments={
          loadAllAssignments
        }

        updateAssignmentStatus={
          updateAssignmentStatus
        }

        logout={
          logout
        }


        assignmentTitle={
          assignmentTitle
        }

        setAssignmentTitle={
          setAssignmentTitle
        }


        assignmentSubject={
          assignmentSubject
        }

        setAssignmentSubject={
          setAssignmentSubject
        }


        deadline={
          deadline
        }

        setDeadline={
          setDeadline
        }


        createAssignment={
          createAssignment
        }


        auditLogs={
          auditLogs
        }

        loadAuditLogs={
          loadAuditLogs
        }

      />

    );
  }


  // =====================================================
  // ROLE SELECTION
  // =====================================================

  if (!selectedRole) {

    return (

      <RoleSelection

        setSelectedRole={
          setSelectedRole
        }

      />

    );
  }


  // =====================================================
  // STUDENT DASHBOARD
  // =====================================================

  if (loggedIn) {

    return (

      <StudentDashboard

        currentUser={
          currentUser
        }

        userRole={
          userRole
        }
        
        openSecurityDashboard={() => {
          setShowSecurityDashboard(true);
          loadAssignments();
          loadAuditLogs();
        }}



        title={
          title
        }

        setTitle={
          setTitle
        }


        subject={
          subject
        }

        setSubject={
          setSubject
        }


        description={
          description
        }

        setDescription={
          setDescription
        }


        submitAssignment={
          submitAssignment
        }


        loadAssignments={
          loadAssignments
        }


        myAssignments={
          myAssignments
        }


        logout={
          logout
        }


        receipt={
          receipt
        }


        availableAssignments={
          availableAssignments
        }


        loadAvailableAssignments={
          loadAvailableAssignments
        }


        selectedFile={
          selectedFile
        }


        setSelectedFile={
          setSelectedFile
        }

      />

    );
  }


  // =====================================================
  // AUTHENTICATION SCREEN
  // =====================================================

  return (

    <Auth

      selectedRole={
        selectedRole
      }

      email={
        email
      }

      setEmail={
        setEmail
      }

      password={
        password
      }

      setPassword={
        setPassword
      }

      facultySubject={
        facultySubject
      }

      setFacultySubject={
        setFacultySubject
      }

      register={
        register
      }

      login={
        login
      }

    />

  );
}


export default App;