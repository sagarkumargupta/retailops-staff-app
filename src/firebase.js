import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
const firebaseConfig = {
  apiKey: "AIzaSyBOe0c22Tug8CoWenydHGxgkP6iPM_VLfI",
  authDomain: "retailopsapp.firebaseapp.com",
  projectId: "retailopsapp",
  storageBucket: "retailopsapp.appspot.com",
  messagingSenderId: "381257088873",
  appId: "1:381257088873:web:6a2c28a70dc16b65b547f8",
  measurementId: "G-JZ01F2DMP4"
}
const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)