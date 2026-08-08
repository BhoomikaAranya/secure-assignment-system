import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";



const firebaseConfig = {
  apiKey: "AIzaSyBOEY_vDkAn2uM1qtthdQ1CS8MH_UPshgA",
  authDomain: "assignment-system-84f90.firebaseapp.com",
  projectId: "assignment-system-84f90",
  databaseURL: "https://assignment-system-84f90-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "assignment-system-84f90.firebasestorage.app",
  messagingSenderId: "66275510271",
  appId: "1:66275510271:web:22bc92b6a7040bae5b89ca",
  measurementId: "G-EBCVECKE1W"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);

export default app;