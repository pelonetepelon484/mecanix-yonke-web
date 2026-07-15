import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAuWJajKo8NuJT_SGD4tvvc6jZa6DMDBCQ",
  authDomain: "mecanix-yonke-virtual.firebaseapp.com",
  projectId: "mecanix-yonke-virtual",
  storageBucket: "mecanix-yonke-virtual.firebasestorage.app",
  messagingSenderId: "650815226147",
  appId: "1:650815226147:web:1629984619db0659b00c96"
};

const serverApp = getApps().find(a => a.name === 'server')
  ?? initializeApp(firebaseConfig, 'server');

export const dbServer = getFirestore(serverApp);
