
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyDwExfoRGMKA1Vw3lw1KGZ_dZ-fwtEoXi0",
    authDomain: "myportfolio-2d018.firebaseapp.com",
    projectId: "myportfolio-2d018",
    storageBucket: "myportfolio-2d018.appspot.com",
    messagingSenderId: "895759237447",
    appId: "1:895759237447:web:5ae7a8f0e0314c37d68c62",
    measurementId: "G-Q5BDH25N3X"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
