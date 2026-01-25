// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBVauNz56LpCrtnl3FoTdzjEwLAQAIR2vM",
    authDomain: "test-todo-list-3faa0.firebaseapp.com",
    projectId: "test-todo-list-3faa0",
    storageBucket: "test-todo-list-3faa0.firebasestorage.app",
    messagingSenderId: "907061141282",
    appId: "1:907061141282:web:f27a47cf4a75a49c354f7b"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

export default db;