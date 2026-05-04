import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyC_yamBQY5fI_ho5g-JvKTs4NMMnRGWivU",
  authDomain: "kykyemekapp-4d52e.firebaseapp.com",
  projectId: "kykyemekapp-4d52e",
  storageBucket: "kykyemekapp-4d52e.firebasestorage.app",
  messagingSenderId: "463918915224",
  appId: "1:463918915224:web:62eeb773181bf25d77faed",
  measurementId: "G-8BHSGVEZHS"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
