import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseConfig } from './firebaseConfig';

// createUserWithEmailAndPassword cambia la sesión activa del Auth al que se le llama — si
// usáramos el `auth` normal de la app, el admin quedaría deslogueado y logueado como el
// usuario recién creado. Por eso esta función abre una app de Firebase COMPLETAMENTE APARTE
// (con su propio Auth, aislado del `auth` principal que usa el admin), crea ahí la cuenta, y
// la desecha (signOut + deleteApp) antes de devolver el uid. La sesión del admin en el `auth`
// principal nunca se toca.
export async function crearUsuarioYonkeSinDeslogear(email, password) {
  const appSecundaria = initializeApp(firebaseConfig, `crear-usuario-${Date.now()}`);
  try {
    const authSecundaria = getAuth(appSecundaria);
    const credencial = await createUserWithEmailAndPassword(authSecundaria, email, password);
    const uid = credencial.user.uid;
    await signOut(authSecundaria);
    return uid;
  } finally {
    await deleteApp(appSecundaria);
  }
}
