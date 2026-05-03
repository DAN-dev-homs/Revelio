// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD__Y2gTq5QPlCZpxCWnhJUEUhUYjEKWM0",
  authDomain: "revelio-73fee.firebaseapp.com",
  projectId: "revelio-73fee",
  storageBucket: "revelio-73fee.firebasestorage.app",
  messagingSenderId: "305877890935",
  appId: "1:305877890935:web:922555cdc061da7525d372",
  measurementId: "G-WPDN1ZJ1DD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);