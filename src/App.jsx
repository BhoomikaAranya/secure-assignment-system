import FacultyDashboard from "./components/FacultyDashboard";
import SecurityDashboard from "./components/SecurityDashboard";
import StudentDashboard from "./components/StudentDashboard";
import RoleSelection from "./components/RoleSelection";
import Auth from "./components/Auth";
import OTPVerification from "./components/OTPVerification";


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
  // 2FA OTP STATES
  // =====================================================

  const [isVerifyingOtp, setIsVerifyingOtp] =
    useState(false);

  const [pendingAuth, setPendingAuth] =
    useState(null);

  const [otpExpiresAt, setOtpExpiresAt] =
    useState(0);

  const [simulatedOtpCode, setSimulatedOtpCode] =
    useState(null);

  const [isSubmittingOtp, setIsSubmittingOtp] =
    useState(false);


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

  const [selectedAssignmentId, setSelectedAssignmentId] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

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
      // TRIGGER 2FA EMAIL OTP VERIFICATION
      // =================================================

      const otp = generateNumericOTP(6);

      const { expiresAt } = await storeOTPRecord(
        db,
        user.uid,
        user.email,
        otp,
        5
      );

      const sendResult = await sendEmailOTP({
        email: user.email,
        otp,
        userName: user.email,
      });

      setPendingAuth({
        user,
        userData,
      });

      setOtpExpiresAt(expiresAt);
      setSimulatedOtpCode(sendResult.deliveredVia === "simulated" ? otp : null);
      setIsVerifyingOtp(true);

      alert(
        sendResult.deliveredVia === "simulated"
          ? `🔐 Two-Factor Authentication Triggered!\n\nA 6-digit code has been sent to ${user.email} (In development: ${otp}).`
          : `🔐 Two-Factor Authentication Triggered!\n\nA 6-digit code has been sent to your email (${user.email}).`
      );

    } catch (error) {

      alert(error.message);

    }
  };


  // =====================================================
  // 2FA OTP VERIFICATION HANDLERS
  // =====================================================

  const handleVerifyOtp = async (enteredOtp) => {
    if (!pendingAuth) return;

    try {
      setIsSubmittingOtp(true);

      await verifyOTPRecord(
        db,
        pendingAuth.user.uid,
        enteredOtp
      );

      // OTP verified successfully -> Complete sign-in
      setUserRole(pendingAuth.userData.role);
      setCurrentUser(pendingAuth.user.email);

      if (pendingAuth.userData.role === "faculty") {
        setFacultySubject(pendingAuth.userData.subject);
      }

      setLoggedIn(true);
      setIsVerifyingOtp(false);

      // Audit log
      await push(ref(db, "auditLogs"), {
        action: `User completed 2FA OTP verification: ${pendingAuth.user.email}`,
        user: pendingAuth.user.email,
        userUid: pendingAuth.user.uid,
        timestamp: new Date().toISOString(),
      });

      alert(`✅ Two-Factor Authentication Successful!\n\nWelcome, ${pendingAuth.user.email}`);
      setPendingAuth(null);
      setSimulatedOtpCode(null);
    } catch (error) {
      console.error("OTP verification error:", error);
      throw error;
    } finally {
      setIsSubmittingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingAuth) return;

    try {
      const otp = generateNumericOTP(6);

      const { expiresAt } = await storeOTPRecord(
        db,
        pendingAuth.user.uid,
        pendingAuth.user.email,
        otp,
        5
      );

      const sendResult = await sendEmailOTP({
        email: pendingAuth.user.email,
        otp,
        userName: pendingAuth.user.email,
      });

      setOtpExpiresAt(expiresAt);
      setSimulatedOtpCode(sendResult.deliveredVia === "simulated" ? otp : null);

      alert(
        sendResult.deliveredVia === "simulated"
          ? `✉️ New code sent! (In development: ${otp})`
          : `✉️ A fresh 6-digit code has been sent to ${pendingAuth.user.email}.`
      );
    } catch (error) {
      console.error("Resend OTP error:", error);
      alert("Failed to resend code: " + error.message);
      throw error;
    }
  };

  const handleCancelOtp = () => {
    auth.signOut();
    setIsVerifyingOtp(false);
    setPendingAuth(null);
    setSimulatedOtpCode(null);
    setEmail("");
    setPassword("");
  };


  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = () => {

    auth.signOut();

    setLoggedIn(false);

    setCurrentUser("");

    setUserRole("");

    setMyAssignments([]);

    setAllAssignments([]);

    setReceipt(null);

    setSelectedFile(null);

    setIsVerifyingOtp(false);

    setPendingAuth(null);

    setSimulatedOtpCode(null);
  };


  // =====================================================
  // CLOUDINARY FILE UPLOAD (CIPHERTEXT ONLY)
  // =====================================================

  const uploadBlobToCloudinary = async (
    blob,
    filename = "submission_ciphertext.pdf"
  ) => {
    if (!blob) {
      throw new Error("No data provided for upload.");
    }

    const formData = new FormData();
    formData.append("file", blob, filename);
    formData.append("upload_preset", "assignment_uploads");

    try {
      const response = await axios.post(
        "https://api.cloudinary.com/v1_1/ksbtuok3/raw/upload",
        formData,
        { timeout: 60000 }
      );

      if (!response.data?.secure_url) {
        throw new Error("Cloudinary did not return a file URL.");
      }

      console.log("Cloudinary ciphertext upload successful:", {
        publicId: response.data.public_id,
        resourceType: response.data.resource_type,
        format: response.data.format,
      });

      return response.data.secure_url;
    } catch (error) {
      const cloudinaryMessage =
        error.response?.data?.error?.message ||
        error.response?.headers?.["x-cld-error"] ||
        error.message ||
        "Unknown upload error";

      console.error("Cloudinary upload failed:", {
        status: error.response?.status,
        message: cloudinaryMessage,
        response: error.response?.data,
      });

      throw new Error(`Cloudinary upload failed: ${cloudinaryMessage}`, {
        cause: error,
      });
    }
  };

  // =====================================================
  // SUBMIT ASSIGNMENT
  // =====================================================

  const submitAssignment =
    async () => {

      try {
        // Ensure a Firebase-authenticated student is submitting.
        const user = auth.currentUser;
        if (!user) {
          throw new Error("Please log in again before submitting an assignment.");
        }
        if (userRole !== "student") {
          throw new Error("Only students can submit assignments.");
        }

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
            (assignment) => assignment.id === selectedAssignmentId
          );

        if (!selectedAssignment) {
          throw new Error(
            "Please select an assignment from Available Assignments before submitting."
          );
        }


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
        // RETRIEVE AND VALIDATE FACULTY RECIPIENT PUBLIC KEY
        // =================================================
        if (!selectedAssignment.createdByUid) {
          throw new Error(
            "The selected assignment has no recorded faculty owner UID. Submissions cannot be securely delivered without a faculty recipient."
          );
        }

        const facultyKeySnap = await get(
          ref(db, `facultyKeys/${selectedAssignment.createdByUid}/publicKey`)
        );

        if (!facultyKeySnap.exists()) {
          throw new Error(
            `The faculty member for this assignment has not yet registered an ECC encryption key pair. Please notify your faculty (${selectedAssignment.createdBy || "faculty"}) to log in and register their key.`
          );
        }

        const facultyPublicKey = await importECCPublicKey(facultyKeySnap.val());

        setIsSubmitting(true);

        // =================================================
        // AES-256-GCM ENCRYPTION & KEY WRAPPING
        // =================================================
        // 1. Encrypt original file bytes using fresh AES-256-GCM key and random 96-bit IV
        const { encryptedBlob, ivBase64, key: aesKey } =
          await encryptFile(selectedFile);

        // 2. Wrap AES key for the faculty owner using ECDH + HKDF + AES-GCM
        const wrappedAESKey = await wrapAESKeyForFaculty(
          aesKey,
          facultyPublicKey
        );

        // 3. Compute SHA-256 of the exact ciphertext bytes
        const ciphertextHash = await calculateSHA256(encryptedBlob);

        console.log("Ciphertext SHA-256 Hash:", ciphertextHash);

        // =================================================
        // UPLOAD CIPHERTEXT BLOB TO CLOUDINARY
        // =================================================
        // Only the encrypted Blob is uploaded, never the original plaintext file.
        // We preserve the allowed file extension (.pdf / .docx / .doc) to satisfy Cloudinary preset whitelist.
        const originalExtension = selectedFile.name.includes(".")
          ? selectedFile.name.split(".").pop().toLowerCase()
          : "pdf";
        const uploadFilename = `${submissionId}_enc.${originalExtension}`;

        const fileUrl = await uploadBlobToCloudinary(
          encryptedBlob,
          uploadFilename
        );

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

            assignmentId: selectedAssignment.id,

            facultyUid: selectedAssignment.createdByUid,

            studentEmail:
              currentUser,
            
            studentUid: user.uid,

            title: selectedAssignment.title,

            subject: selectedAssignment.subject,

            description,

            submittedAt:
              new Date().toISOString(),

            status:
              "Pending",

            fileUrl, // Ciphertext Cloudinary URL

            fileName: selectedFile.name,

            fileMimeType: selectedFile.type || "application/octet-stream",

           // ===========================================
          // SHA-256 FILE HASH
          // ===========================================

          fileHash,
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
              `Student submitted encrypted assignment: ${selectedAssignment.title}`,

            user:
              currentUser,

            userUid: user.uid,

            timestamp:
              new Date().toISOString(),
          }
        );


        // =================================================
        // DIGITAL RECEIPT
        // =================================================

        setReceipt({

          submissionId,

          studentEmail:
            currentUser,

          title: selectedAssignment.title,

          subject: selectedAssignment.subject,

          submittedAt:
            new Date().toLocaleString(),

          status:
            "Pending",

          ciphertextHash,
        });


        // =================================================
        // SUCCESS MESSAGE & RESET
        // =================================================

        alert(
          `🔒 Assignment Encrypted & Submitted Successfully!\n\n` +
          `Submission ID: ${submissionId}\n\n` +
          `Ciphertext SHA-256:\n${ciphertextHash}\n\n` +
          `Plagiarism Status: ${plagiarismResult.status}\n` +
          `Similarity: ${plagiarismResult.similarity}%`
        );

        setTitle("");
        setSubject("");
        setDescription("");
        setSelectedAssignmentId("");
        setSelectedFile(null);

      } catch (error) {

        console.error(
          "Submission error:",
          error
        );

        alert(
          error.message
        );
      } finally {
        setIsSubmitting(false);
      }
    };


  // =====================================================
  // CREATE ASSIGNMENT
  // =====================================================

 
const createAssignment = async () => {
  try {
    // Verify that a Firebase user is signed in
    const user = auth.currentUser;

    if (!user) {
      throw new Error(
        "You must be logged in to create an assignment."
      );
    }

    // Ensure the current app role is faculty
    if (userRole !== "faculty") {
      throw new Error(
        "Only faculty members can create assignments."
      );
    }

    // Create the assignment
    await push(
      ref(db, "assignmentsCreated"),
      {
        title: assignmentTitle,
        subject: assignmentSubject,
        deadline,

        // Preserve the existing email field
        createdBy: user.email || currentUser,

        // New field for faculty ownership
        createdByUid: user.uid,

        createdAt: new Date().toISOString(),
      }
    );

    // Create the audit log
    await push(
      ref(db, "auditLogs"),
      {
        action: `Faculty created assignment: ${assignmentTitle}`,


        user: user.email || currentUser,
        userUid: user.uid,
        timestamp: new Date().toISOString(),
      }
    );

    alert("Assignment Created Successfully!");

    setAssignmentTitle("");
    setAssignmentSubject("");
    setDeadline("");
  } catch (error) {
    console.error("Create assignment error:", error);
    alert(error.message);
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
            const currentUid = auth.currentUser?.uid;
            filteredList =
              assignmentList.filter(
                (assignment) =>
                  (currentUid && assignment.facultyUid === currentUid) ||
                  assignment.subject === facultySubject
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


        selectedAssignmentId={
          selectedAssignmentId
        }


        setSelectedAssignmentId={
          setSelectedAssignmentId
        }


        selectedFile={
          selectedFile
        }

        setSelectedFile={
          setSelectedFile
        }

        isSubmitting={
          isSubmitting
        }

      />

    );
  }


  // =====================================================
  // 2FA OTP VERIFICATION SCREEN
  // =====================================================

  if (isVerifyingOtp && pendingAuth) {
    return (
      <OTPVerification
        email={pendingAuth.user.email}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        onCancel={handleCancelOtp}
        expiresAt={otpExpiresAt}
        simulatedCode={simulatedOtpCode}
        isVerifying={isSubmittingOtp}
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