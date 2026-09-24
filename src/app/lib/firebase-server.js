import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

const serverApp = getApps().find(a => a.name === 'server')
  ?? initializeApp(firebaseConfig, 'server');

export const dbServer = getFirestore(serverApp);
