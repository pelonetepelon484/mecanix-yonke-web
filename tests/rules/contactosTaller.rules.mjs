// Pruebas de reglas: libreta de contactos del taller (talleres/{id}/contactosClientes/{id}).
// Solo el dueño (y el admin) la ve. Bandera config/contactos.habilitado. Plan Básico: 25 lugares
// con ID fijo (c01 ... c25); otros IDs solo con Premium vigente. Borrado: expiraAt = ahora + 548 días.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const DIA = 86400000;
const enDias = (n) => new Date(Date.now() + n * DIA);
const como = (uid) => env.authenticatedContext(uid).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();
const AUTO = 'Ab3dEfGh1jKlMn0pQr5t'; // ID automático de 20 letras y números

function taller(owner, extra = {}) {
  return {
    nombre: 'Taller', whatsapp: '6641234567', ciudad: 'Tijuana', logoUrl: '', ownerUid: owner, activo: true,
    creadoAt: new Date(), aceptacionVersion: 'v1',
    avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: new Date() },
    ...extra,
  };
}
// Contacto como lo arma la app al crear.
function contacto(extra = {}) {
  return {
    nombre: 'Juan Pérez', nombreBusqueda: 'juan perez', telefono: '6641234567', nota: 'Cliente de flotilla',
    vehiculos: [{ marca: 'Nissan', modelo: 'Versa', anio: 2018, placas: 'ABC123' }], placasLista: ['ABC123'],
    creadoAt: serverTimestamp(), actualizadoAt: serverTimestamp(), expiraAt: enDias(548),
    ...extra,
  };
}
const ref = (db, id, t = 'T1') => doc(db, 'talleres', t, 'contactosClientes', id);

async function sembrar({ tallerExtra = {}, configContactos = { habilitado: true }, existentes = [] } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'admin'), { rol: 'admin' });
    await setDoc(doc(db, 'config', 'cotizaciones'), { terminosVersion: 'v1' });
    if (configContactos) await setDoc(doc(db, 'config', 'contactos'), configContactos);
    await setDoc(doc(db, 'talleres', 'T1'), taller('dueno', tallerExtra));
    await setDoc(doc(db, 'talleres', 'T2'), taller('otro'));
    for (const id of existentes) {
      await setDoc(ref(db, id), { ...contacto(), creadoAt: new Date(Date.now() - DIA), actualizadoAt: new Date(Date.now() - DIA), expiraAt: enDias(547) });
    }
  });
}

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-contactos-taller', firestore: { rules: reglas } });
});
after(async () => { await env.cleanup(); });

describe('contactos: quién los ve', () => {
  beforeEach(() => sembrar({ existentes: ['c01'] }));
  it('el dueño y el admin leen; otro taller y el público no', async () => {
    await assertSucceeds(getDoc(ref(como('dueno'), 'c01')));
    await assertSucceeds(getDocs(collection(como('dueno'), 'talleres', 'T1', 'contactosClientes')));
    await assertSucceeds(getDoc(ref(como('admin'), 'c01')));
    await assertFails(getDoc(ref(como('otro'), 'c01')));
    await assertFails(getDocs(collection(como('otro'), 'talleres', 'T1', 'contactosClientes')));
    await assertFails(getDoc(ref(anonimo(), 'c01')));
  });
  it('otro taller no puede crear ni borrar en mi libreta', async () => {
    await assertFails(setDoc(ref(como('otro'), 'c02'), contacto()));
    await assertFails(deleteDoc(ref(como('otro'), 'c01')));
  });
});

describe('contactos: plan Básico (25 lugares)', () => {
  beforeEach(() => sembrar());
  it('crea en los lugares c01 a c25', async () => {
    await assertSucceeds(setDoc(ref(como('dueno'), 'c01'), contacto()));
    await assertSucceeds(setDoc(ref(como('dueno'), 'c25'), contacto({ vehiculos: [], placasLista: [], telefono: '' })));
  });
  it('no puede usar un lugar 26 ni un ID automático', async () => {
    await assertFails(setDoc(ref(como('dueno'), 'c26'), contacto()));
    await assertFails(setDoc(ref(como('dueno'), 'c00'), contacto()));
    await assertFails(setDoc(ref(como('dueno'), AUTO), contacto()));
  });
  it('no puede pisar un contacto que ya ocupa ese lugar', async () => {
    await sembrar({ existentes: ['c03'] });
    await assertFails(setDoc(ref(como('dueno'), 'c03'), contacto({ nombre: 'Otro' })));
  });
  it('Premium vencido cuenta como Básico', async () => {
    await sembrar({ tallerExtra: { plan: 'premium', premiumHasta: enDias(-1) } });
    await assertFails(setDoc(ref(como('dueno'), AUTO), contacto()));
    await assertSucceeds(setDoc(ref(como('dueno'), 'c05'), contacto()));
  });
});

describe('contactos: plan Premium (sin límite)', () => {
  it('con Premium vigente también puede usar IDs automáticos', async () => {
    await sembrar({ tallerExtra: { plan: 'premium', premiumHasta: enDias(30) } });
    await assertSucceeds(setDoc(ref(como('dueno'), AUTO), contacto()));
    await assertFails(setDoc(ref(como('dueno'), 'corto'), contacto()));
  });
  it('si baja de Premium conserva todo: edita y borra los contactos con ID automático', async () => {
    await sembrar({ existentes: [AUTO] });
    await assertSucceeds(updateDoc(ref(como('dueno'), AUTO), { nota: 'Sigue aquí', actualizadoAt: serverTimestamp(), expiraAt: enDias(548) }));
    await assertSucceeds(deleteDoc(ref(como('dueno'), AUTO)));
  });
});

describe('contactos: forma de los datos', () => {
  beforeEach(() => sembrar({ existentes: ['c01'] }));
  it('rechaza datos mal formados', async () => {
    const malos = [
      contacto({ extra: 1 }),
      contacto({ nombre: '' }),
      contacto({ nombre: 'x'.repeat(101) }),
      contacto({ telefono: '123' }),
      contacto({ nota: 'x'.repeat(201) }),
      contacto({ vehiculos: Array.from({ length: 4 }, () => ({ marca: 'A', modelo: 'B' })) }),
      contacto({ vehiculos: [{ marca: 'A' }] }),
      contacto({ vehiculos: [{ marca: 'A', modelo: 'B', vin: '123' }] }),
      contacto({ vehiculos: [{ marca: 'A', modelo: 'B', anio: 1900 }] }),
      contacto({ vehiculos: [{ marca: 'A', modelo: 'B', placas: 'abc 1' }] }),
      contacto({ placasLista: ['a b'] }),
      contacto({ expiraAt: enDias(2000) }),
      contacto({ expiraAt: enDias(30) }),
      contacto({ creadoAt: new Date(2020, 0, 1) }),
    ];
    for (const d of malos) await assertFails(setDoc(ref(como('dueno'), 'c02'), d));
  });
  it('al editar no cambia creadoAt y renueva el borrado', async () => {
    await assertFails(updateDoc(ref(como('dueno'), 'c01'), { creadoAt: new Date(), actualizadoAt: serverTimestamp(), expiraAt: enDias(548) }));
    await assertFails(updateDoc(ref(como('dueno'), 'c01'), { nota: 'x', actualizadoAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref(como('dueno'), 'c01'), { nota: 'x', actualizadoAt: serverTimestamp(), expiraAt: enDias(548) }));
  });
});

describe('contactos: candados', () => {
  it('sin config/contactos (o apagada) nadie escribe, pero sí lee y borra', async () => {
    for (const configContactos of [null, { habilitado: false }]) {
      await sembrar({ configContactos, existentes: ['c01'] });
      await assertFails(setDoc(ref(como('dueno'), 'c02'), contacto()));
      await assertFails(updateDoc(ref(como('dueno'), 'c01'), { nota: 'x', actualizadoAt: serverTimestamp(), expiraAt: enDias(548) }));
      await assertSucceeds(getDoc(ref(como('dueno'), 'c01')));
      await assertSucceeds(deleteDoc(ref(como('dueno'), 'c01')));
    }
  });
  it('taller desactivado o con términos viejos: solo ver y borrar', async () => {
    for (const tallerExtra of [{ activo: false }, { aceptacionVersion: 'v0' }]) {
      await sembrar({ tallerExtra, existentes: ['c01'] });
      await assertFails(setDoc(ref(como('dueno'), 'c02'), contacto()));
      await assertFails(updateDoc(ref(como('dueno'), 'c01'), { nota: 'x', actualizadoAt: serverTimestamp(), expiraAt: enDias(548) }));
      await assertSucceeds(getDoc(ref(como('dueno'), 'c01')));
      await assertSucceeds(deleteDoc(ref(como('dueno'), 'c01')));
    }
  });
  it('el admin puede borrar (borrado completo de un taller)', async () => {
    await sembrar({ existentes: ['c01'] });
    await assertSucceeds(deleteDoc(ref(como('admin'), 'c01')));
  });
});
