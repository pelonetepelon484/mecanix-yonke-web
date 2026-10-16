// Pruebas de reglas de Firestore para el alta, dueño y revocación de yonkes.
// Corren contra el emulador con el archivo real ../../firestore.rules.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, deleteField, serverTimestamp, Timestamp } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;

// Datos de prueba: un yonke con dueño (registrado solo), un yonke viejo sin ownerUid,
// y un dueño con yonke ya registrado.
async function sembrar() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'admin@prueba.mx' });
    await setDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Yonke uno', activo: true, ownerUid: 'o1' });
    await setDoc(doc(db, 'usuarios', 'o1'), { rol: 'yonke', yonkeId: 'Y1', email: 'o1@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'yonkes', 'Y0'), { nombre: 'Yonke viejo sin dueño', activo: true });
    await setDoc(doc(db, 'usuarios', 'l0'), { rol: 'yonke', yonkeId: 'Y0', email: 'l0@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'yonkes', 'Y2'), { nombre: 'Yonke dos', activo: true, ownerUid: 'o2' });
    await setDoc(doc(db, 'usuarios', 'o2'), { rol: 'yonke', yonkeId: 'Y2', email: 'o2@prueba.mx', fechaRegistro: new Date() });
  });
}

const como = (uid) => env.authenticatedContext(uid).firestore();
const reclamo = (uid, yonkeId) => setDoc(doc(como(uid), 'usuarios', uid), {
  rol: 'yonke', yonkeId, email: `${uid}@prueba.mx`, fechaRegistro: serverTimestamp(),
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-yonkes',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });

describe('cuenta nueva que intenta reclamar un yonke ajeno', () => {
  it('no puede declararse dueña de un yonke con dueño', async () => {
    await sembrar();
    await assertFails(reclamo('x9', 'Y1'));
  });
  it('no puede declararse dueña de un yonke viejo sin ownerUid', async () => {
    await sembrar();
    await assertFails(reclamo('x9', 'Y0'));
  });
  it('no puede crear un yonke sin ownerUid', async () => {
    await sembrar();
    await assertFails(setDoc(doc(como('x8'), 'yonkes', 'Y8'), { nombre: 'Sin dueño' }));
  });
  it('no puede crear un yonke con ownerUid de otra persona', async () => {
    await sembrar();
    await assertFails(setDoc(doc(como('x7'), 'yonkes', 'Y7'), { nombre: 'Ajeno', ownerUid: 'o1' }));
  });
  it('una cuenta que ya tiene usuario (yonke) no puede crear otro yonke', async () => {
    await sembrar();
    await assertFails(setDoc(doc(como('o1'), 'yonkes', 'Y10'), { nombre: 'Otro yonke', ownerUid: 'o1' }));
  });
  it('no puede poner ownerUid en un yonke viejo que ya existe', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('l0'), 'yonkes', 'Y0'), { ownerUid: 'l0' }));
  });
});

describe('registro normal de yonke (mismo orden que el código)', () => {
  it('crea el yonke con ownerUid propio y luego su usuario de yonke', async () => {
    await sembrar();
    const db = como('o5');
    // Lo que escribe src/app/panel/registro/page.js: datosYonke (+ aceptacionLegal en la 1ª versión)
    await assertSucceeds(setDoc(doc(db, 'yonkes', 'Y5'), {
      nombre: 'Nuevo', direccion: 'Calle 1', estado: 'baja-california', ciudad: 'tijuana',
      telefono: '6641234567', whatsapp: '6641234567', metodosPago: [], plan: 'freemium', activo: true,
      fechaRegistro: new Date(), ownerUid: 'o5',
      aceptacionLegal: { version: 'x', fecha: new Date() },
    }));
    await assertSucceeds(setDoc(doc(db, 'usuarios', 'o5'), {
      rol: 'yonke', yonkeId: 'Y5', email: 'o5@prueba.mx', fechaRegistro: new Date(),
    }));
  });
  it('la versión de respaldo del yonke (sin aceptacionLegal) también pasa', async () => {
    await sembrar();
    await assertSucceeds(setDoc(doc(como('o6'), 'yonkes', 'Y6'), {
      nombre: 'Nuevo', direccion: 'Calle 2', telefono: '6640000000', metodosPago: [], plan: 'freemium', activo: true,
      fechaRegistro: new Date(), ownerUid: 'o6',
    }));
    await assertSucceeds(setDoc(doc(como('o6'), 'usuarios', 'o6'), {
      rol: 'yonke', yonkeId: 'Y6', email: 'o6@prueba.mx', fechaRegistro: new Date(),
    }));
  });
  it('un usuario de yonke no puede agregar campos extra al usuario', async () => {
    await sembrar();
    await assertSucceeds(setDoc(doc(como('o7'), 'yonkes', 'Y7'), { nombre: 'Nuevo', ownerUid: 'o7' }));
    await assertFails(setDoc(doc(como('o7'), 'usuarios', 'o7'), {
      rol: 'yonke', yonkeId: 'Y7', email: 'o7@prueba.mx', fechaRegistro: new Date(), admin: true,
    }));
  });
  it('si el yonke no existe, el usuario de yonke se rechaza', async () => {
    await sembrar();
    await assertFails(reclamo('o8', 'NO_EXISTE'));
  });
});

describe('dueño de un yonke', () => {
  it('edita campos normales de su yonke', async () => {
    await sembrar();
    await assertSucceeds(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { nombre: 'Yonke uno editado' }));
  });
  it('guarda su perfil con setDoc merge (sin tocar ownerUid)', async () => {
    await sembrar();
    await assertSucceeds(setDoc(doc(como('o1'), 'yonkes', 'Y1'), {
      nombre: 'Perfil', direccion: 'Calle', metodosPago: ['efectivo'],
    }, { merge: true }));
  });
  it('no puede desactivarse ni reactivarse solo: activo lo cambia únicamente el admin', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { activo: false }));
    await assertFails(setDoc(doc(como('o1'), 'yonkes', 'Y1'), { nombre: 'Perfil', activo: false }, { merge: true }));
    // El admin lo desactiva; el dueño no puede volver a prenderse, ni junto con otros cambios.
    await assertSucceeds(updateDoc(doc(como('adm'), 'yonkes', 'Y1'), { activo: false }));
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { activo: true }));
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { activo: true, nombre: 'Otra vez' }));
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { activo: deleteField() }));
    // Apagado sigue editando lo demás de su ficha.
    await assertSucceeds(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { nombre: 'Yonke uno pausado' }));
    await assertSucceeds(updateDoc(doc(como('adm'), 'yonkes', 'Y1'), { activo: true }));
  });
  it('no puede cambiar su ownerUid', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { ownerUid: 'x9' }));
  });
  it('no puede borrar su yonke si ya tiene usuario', async () => {
    await sembrar();
    await assertFails(deleteDoc(doc(como('o2'), 'yonkes', 'Y2')));
  });
  it('puede borrar su yonke mientras aún no tenga usuario (rollback)', async () => {
    await sembrar();
    await assertSucceeds(setDoc(doc(como('o3'), 'yonkes', 'Y3'), { nombre: 'Rollback', ownerUid: 'o3' }));
    await assertSucceeds(deleteDoc(doc(como('o3'), 'yonkes', 'Y3')));
  });
});

describe('yonke viejo (sin ownerUid) entrando normal', () => {
  it('lee su propio usuario', async () => {
    await sembrar();
    await assertSucceeds(getDoc(doc(como('l0'), 'usuarios', 'l0')));
  });
  it('edita su yonke', async () => {
    await sembrar();
    await assertSucceeds(updateDoc(doc(como('l0'), 'yonkes', 'Y0'), { nombre: 'Viejo editado' }));
  });
});

describe('admin: crear y revocar accesos', () => {
  it('crea un yonke sin ownerUid', async () => {
    await sembrar();
    await assertSucceeds(setDoc(doc(como('adm'), 'yonkes', 'Y9'), { nombre: 'Creado por admin' }));
  });
  it('crea un acceso extra de yonke', async () => {
    await sembrar();
    await assertSucceeds(setDoc(doc(como('adm'), 'usuarios', 'a1'), {
      rol: 'yonke', yonkeId: 'Y1', email: 'a1@prueba.mx', fechaRegistro: new Date(),
    }));
  });

  // Misma secuencia que revocarAcceso en src/app/admin/yonke/[id]/page.js
  async function revocar(yonkeId, usuarioId) {
    const admin = como('adm');
    const snap = await getDoc(doc(admin, 'yonkes', yonkeId));
    if (snap.exists() && snap.data().ownerUid === usuarioId) {
      await updateDoc(doc(admin, 'yonkes', yonkeId), { ownerUid: deleteField() });
    }
    await deleteDoc(doc(admin, 'usuarios', usuarioId));
  }

  it('revoca al dueño y limpia ownerUid', async () => {
    await sembrar();
    await assertSucceeds(revocar('Y1', 'o1'));
  });
  it('el dueño revocado ya no puede volver a reclamar el yonke', async () => {
    await sembrar();
    await revocar('Y1', 'o1');
    await assertFails(reclamo('o1', 'Y1'));
  });
  it('después de revocar, el admin puede volver a dar acceso', async () => {
    await sembrar();
    await revocar('Y1', 'o1');
    await assertSucceeds(setDoc(doc(como('adm'), 'usuarios', 'a2'), {
      rol: 'yonke', yonkeId: 'Y1', email: 'a2@prueba.mx', fechaRegistro: new Date(),
    }));
  });
  it('revocar a un yonke viejo (sin ownerUid) funciona', async () => {
    await sembrar();
    await assertSucceeds(revocar('Y0', 'l0'));
  });
  it('un reintento tras un fallo a medias es seguro (ownerUid ya limpio)', async () => {
    await sembrar();
    // Paso 1 hecho, paso 2 falló: el usuario sigue existiendo y ya no hay ownerUid
    await assertSucceeds(updateDoc(doc(como('adm'), 'yonkes', 'Y1'), { ownerUid: deleteField() }));
    await assertSucceeds(revocar('Y1', 'o1'));
  });
});

describe('plan y vencimiento de Premium: solo el admin', () => {
  const fecha = (iso = '2030-01-01') => Timestamp.fromDate(new Date(`${iso}T00:00:00`));
  const registro = (uid, yonkeId, extra) => setDoc(doc(como(uid), 'yonkes', yonkeId), {
    nombre: 'Nuevo', activo: true, fechaRegistro: new Date(), ownerUid: uid, ...extra,
  });
  const ponerPremiumSinReglas = (hasta) => env.withSecurityRulesDisabled((ctx) =>
    updateDoc(doc(ctx.firestore(), 'yonkes', 'Y1'), { plan: 'premium', premiumHasta: hasta }));

  it('al registrarse no puede crearse como premium', async () => {
    await sembrar();
    await assertFails(registro('p1', 'P1', { plan: 'premium' }));
  });
  it('al registrarse no puede ponerse fecha de vencimiento de Premium', async () => {
    await sembrar();
    await assertFails(registro('p2', 'P2', { plan: 'freemium', premiumHasta: fecha() }));
  });
  it('al registrarse como freemium y sin fecha sí pasa', async () => {
    await sembrar();
    await assertSucceeds(registro('p3', 'P3', { plan: 'freemium' }));
  });
  it('el dueño no puede subirse a premium', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { plan: 'premium' }));
  });
  it('el dueño no puede subirse a premium con setDoc merge (como al guardar perfil)', async () => {
    await sembrar();
    await assertFails(setDoc(doc(como('o1'), 'yonkes', 'Y1'), { nombre: 'Perfil', plan: 'premium' }, { merge: true }));
  });
  it('el dueño no puede ponerse una fecha de Premium', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { premiumHasta: fecha() }));
  });
  it('el dueño premium no puede alargar ni borrar su fecha de vencimiento', async () => {
    await sembrar();
    await ponerPremiumSinReglas(fecha('2026-01-01'));
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { premiumHasta: fecha() }));
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { premiumHasta: deleteField() }));
  });
  it('un yonke premium sigue editando su ficha normal', async () => {
    await sembrar();
    await ponerPremiumSinReglas(fecha());
    await assertSucceeds(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { nombre: 'Sigue editando' }));
  });
  // Mismas escrituras que subir/bajar plan en src/app/admin/page.js
  it('el admin sube a premium con fecha y luego baja a básico', async () => {
    await sembrar();
    const admin = como('adm');
    await assertSucceeds(updateDoc(doc(admin, 'yonkes', 'Y1'), { plan: 'premium', premiumHasta: fecha() }));
    await assertSucceeds(updateDoc(doc(admin, 'yonkes', 'Y1'), { plan: 'freemium', premiumHasta: deleteField() }));
  });
  it('el admin puede crear un yonke ya premium', async () => {
    await sembrar();
    await assertSucceeds(setDoc(doc(como('adm'), 'yonkes', 'Y11'), { nombre: 'Admin', plan: 'premium', premiumHasta: fecha() }));
  });
});
