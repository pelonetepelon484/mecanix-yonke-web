// Pruebas de reglas: citas del taller (talleres/{id}/citas/{id}).
// Solo el dueño (y el admin) las ve. Bandera config/citas.habilitado. Con requierePremium, crear y
// editar piden Premium vigente; ver y borrar no. Borrado: expiraAt = fecha + 30 días.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const DIA = 86400000;
const enDias = (n) => new Date(Date.now() + n * DIA);
const mas30 = (f) => new Date(f.getTime() + 30 * DIA);
const como = (uid) => env.authenticatedContext(uid).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();
const ID = 'Ab3dEfGh1jKlMn0pQr5t';
const ID2 = 'Zz9yXw8vUt7sRq6pOn5m';

function taller(owner, extra = {}) {
  return {
    nombre: 'Taller', whatsapp: '6641234567', ciudad: 'Tijuana', logoUrl: '', ownerUid: owner, activo: true,
    creadoAt: new Date(), aceptacionVersion: 'v1',
    avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: new Date() },
    ...extra,
  };
}
// Cita como la arma la app al crear.
function cita(extra = {}) {
  const fecha = extra.fecha ?? enDias(4);
  return {
    fecha, nombre: 'Juan Pérez', telefono: '6641234567', vehiculo: 'Nissan Versa 2018', placas: 'ABC123',
    motivo: 'Afinación', estado: 'pendiente',
    creadoAt: serverTimestamp(), actualizadoAt: serverTimestamp(), expiraAt: fecha instanceof Date ? mas30(fecha) : enDias(34),
    ...extra,
  };
}
const ref = (db, id, t = 'T1') => doc(db, 'talleres', t, 'citas', id);
const PREMIUM = { plan: 'premium', premiumHasta: enDias(30) };
const VENCIDO = { plan: 'premium', premiumHasta: enDias(-1) };

async function sembrar({ tallerExtra = {}, configCitas = { habilitado: true }, existentes = [] } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'admin'), { rol: 'admin' });
    await setDoc(doc(db, 'config', 'cotizaciones'), { terminosVersion: 'v1' });
    if (configCitas) await setDoc(doc(db, 'config', 'citas'), configCitas);
    await setDoc(doc(db, 'talleres', 'T1'), taller('dueno', tallerExtra));
    await setDoc(doc(db, 'talleres', 'T2'), taller('otro'));
    for (const id of existentes) {
      const fecha = enDias(2);
      await setDoc(ref(db, id), { ...cita({ fecha }), creadoAt: new Date(Date.now() - DIA), actualizadoAt: new Date(Date.now() - DIA), expiraAt: mas30(fecha) });
    }
  });
}
// Editar como lo hace la app (cambiar estado: el resto del documento queda igual).
const cambiarEstado = (db, id, estado) => updateDoc(ref(db, id), { estado, actualizadoAt: serverTimestamp() });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-citas-taller', firestore: { rules: reglas } });
});
after(async () => { await env.cleanup(); });

describe('citas: quién las ve', () => {
  beforeEach(() => sembrar({ existentes: [ID] }));
  it('el dueño y el admin leen; otro taller y el público no', async () => {
    await assertSucceeds(getDoc(ref(como('dueno'), ID)));
    await assertSucceeds(getDocs(collection(como('dueno'), 'talleres', 'T1', 'citas')));
    await assertSucceeds(getDoc(ref(como('admin'), ID)));
    await assertFails(getDoc(ref(como('otro'), ID)));
    await assertFails(getDocs(collection(como('otro'), 'talleres', 'T1', 'citas')));
    await assertFails(getDoc(ref(anonimo(), ID)));
  });
  it('otro taller no puede crear, editar ni borrar mis citas', async () => {
    await assertFails(setDoc(ref(como('otro'), ID2), cita()));
    await assertFails(cambiarEstado(como('otro'), ID, 'cancelada'));
    await assertFails(deleteDoc(ref(como('otro'), ID)));
  });
});

describe('citas: crear y editar', () => {
  beforeEach(() => sembrar({ existentes: [ID] }));
  it('sin requierePremium: cualquier taller activo crea, cambia el estado y edita', async () => {
    await assertSucceeds(setDoc(ref(como('dueno'), ID2), cita()));
    await assertSucceeds(setDoc(ref(como('dueno'), 'Qq1wWe2rRt3yYu4iIo5p'), cita({ telefono: '', vehiculo: '', placas: '', motivo: '' })));
    await assertSucceeds(cambiarEstado(como('dueno'), ID, 'confirmada'));
    const fecha = enDias(10);
    await assertSucceeds(updateDoc(ref(como('dueno'), ID), { fecha, expiraAt: mas30(fecha), nombre: 'Juan P.', actualizadoAt: serverTimestamp() }));
  });
  it('acepta una cita de hace unos días (atendida) pero no de hace más de 30', async () => {
    await assertSucceeds(setDoc(ref(como('dueno'), ID2), cita({ fecha: enDias(-5), estado: 'atendida' })));
    await assertFails(setDoc(ref(como('dueno'), 'Qq1wWe2rRt3yYu4iIo5p'), cita({ fecha: enDias(-31) })));
    await assertFails(setDoc(ref(como('dueno'), 'Qq1wWe2rRt3yYu4iIo5p'), cita({ fecha: enDias(401) })));
  });
  it('solo IDs automáticos y no pisa una cita existente', async () => {
    await assertFails(setDoc(ref(como('dueno'), 'corto'), cita()));
    await assertFails(setDoc(ref(como('dueno'), ID), cita({ nombre: 'Otro' })));
  });
  it('rechaza datos mal formados', async () => {
    const f = enDias(4);
    const malos = [
      cita({ extra: 1 }),
      cita({ nombre: '' }),
      cita({ nombre: 'x'.repeat(101) }),
      cita({ telefono: '123' }),
      cita({ vehiculo: 'x'.repeat(101) }),
      cita({ placas: 'abc 1' }),
      cita({ motivo: 'x'.repeat(201) }),
      cita({ estado: 'perdida' }),
      cita({ fecha: '2026-11-10', expiraAt: mas30(f) }),
      cita({ fecha: f, expiraAt: enDias(548) }),
      cita({ fecha: f, expiraAt: new Date(f.getTime() + 29 * DIA) }),
      cita({ creadoAt: new Date(2020, 0, 1) }),
    ];
    for (const d of malos) await assertFails(setDoc(ref(como('dueno'), ID2), d));
  });
  it('al editar no cambia creadoAt y la fecha de borrado sigue a la fecha', async () => {
    await assertFails(updateDoc(ref(como('dueno'), ID), { creadoAt: new Date(), actualizadoAt: serverTimestamp() }));
    await assertFails(updateDoc(ref(como('dueno'), ID), { fecha: enDias(10), actualizadoAt: serverTimestamp() }));
    await assertFails(updateDoc(ref(como('dueno'), ID), { estado: 'confirmada' }));
  });
});

describe('citas: candado Premium (config/citas.requierePremium)', () => {
  it('con Premium vigente crea y edita', async () => {
    await sembrar({ tallerExtra: PREMIUM, configCitas: { habilitado: true, requierePremium: true }, existentes: [ID] });
    await assertSucceeds(setDoc(ref(como('dueno'), ID2), cita()));
    await assertSucceeds(cambiarEstado(como('dueno'), ID, 'atendida'));
  });
  it('Básico o Premium vencido: no crea ni edita, pero ve y borra', async () => {
    for (const tallerExtra of [{}, VENCIDO]) {
      await sembrar({ tallerExtra, configCitas: { habilitado: true, requierePremium: true }, existentes: [ID] });
      await assertFails(setDoc(ref(como('dueno'), ID2), cita()));
      await assertFails(cambiarEstado(como('dueno'), ID, 'cancelada'));
      await assertSucceeds(getDoc(ref(como('dueno'), ID)));
      await assertSucceeds(deleteDoc(ref(como('dueno'), ID)));
    }
  });
});

describe('citas: candados', () => {
  it('sin config/citas (o apagada) nadie escribe, pero sí lee y borra', async () => {
    for (const configCitas of [null, { habilitado: false }]) {
      await sembrar({ configCitas, existentes: [ID] });
      await assertFails(setDoc(ref(como('dueno'), ID2), cita()));
      await assertFails(cambiarEstado(como('dueno'), ID, 'cancelada'));
      await assertSucceeds(getDoc(ref(como('dueno'), ID)));
      await assertSucceeds(deleteDoc(ref(como('dueno'), ID)));
    }
  });
  it('taller desactivado o con términos viejos: solo ver y borrar', async () => {
    for (const tallerExtra of [{ activo: false }, { aceptacionVersion: 'v0' }]) {
      await sembrar({ tallerExtra, existentes: [ID] });
      await assertFails(setDoc(ref(como('dueno'), ID2), cita()));
      await assertFails(cambiarEstado(como('dueno'), ID, 'cancelada'));
      await assertSucceeds(getDoc(ref(como('dueno'), ID)));
      await assertSucceeds(deleteDoc(ref(como('dueno'), ID)));
    }
  });
  it('el admin puede borrar (borrado completo de un taller)', async () => {
    await sembrar({ existentes: [ID] });
    await assertSucceeds(deleteDoc(ref(como('admin'), ID)));
  });
});
