// Pruebas de reglas de Firestore para el pedido de piezas de talleres a yonkes.
// Estructura: solicitudesPiezas/{id} (datos sin cliente final del taller)
//             solicitudesPiezas/{id}/respuestas/{yonkeId} (una por yonke, sin editar ni borrar)
//             solicitudesPiezas/{id}/privado/contacto (WhatsApp del taller; solo dueño/admin/elegido)
// Bandera: config/solicitudesPiezas.habilitado.
// Corren contra el emulador con el archivo real ../../firestore.rules.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, collection, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, orderBy, writeBatch, serverTimestamp,
} from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const DIA = 86400000;
const ahora = () => Date.now();
const expiraNueva = () => new Date(ahora() + 5 * DIA);
const expiraVencida = () => new Date(ahora() - DIA);
const S1 = 'S1'; // abierta, taller T1, estado baja-california

async function sembrar({ config = true } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    if (config) await setDoc(doc(db, 'config', 'solicitudesPiezas'), { habilitado: true });
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'a@x.mx' });

    await setDoc(doc(db, 'talleres', 'T1'), taller('t1', true));
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@x.mx' });
    await setDoc(doc(db, 'talleres', 'T2'), taller('t2', true));
    await setDoc(doc(db, 'usuarios', 't2'), { rol: 'taller', tallerId: 'T2', email: 't2@x.mx' });
    await setDoc(doc(db, 'talleres', 'T3'), taller('t3', false)); // desactivado
    await setDoc(doc(db, 'usuarios', 't3'), { rol: 'taller', tallerId: 'T3', email: 't3@x.mx' });

    await setDoc(doc(db, 'yonkes', 'Y1'), yonke('y1', 'baja-california', true));
    await setDoc(doc(db, 'usuarios', 'y1'), { rol: 'yonke', yonkeId: 'Y1', email: 'y1@x.mx' });
    await setDoc(doc(db, 'yonkes', 'Y2'), yonke('y2', 'baja-california', true));
    await setDoc(doc(db, 'usuarios', 'y2'), { rol: 'yonke', yonkeId: 'Y2', email: 'y2@x.mx' });
    await setDoc(doc(db, 'yonkes', 'Y3'), yonke('y3', 'jalisco', true)); // otro estado
    await setDoc(doc(db, 'usuarios', 'y3'), { rol: 'yonke', yonkeId: 'Y3', email: 'y3@x.mx' });
    await setDoc(doc(db, 'yonkes', 'Y4'), yonke('y4', 'baja-california', false)); // inactivo
    await setDoc(doc(db, 'usuarios', 'y4'), { rol: 'yonke', yonkeId: 'Y4', email: 'y4@x.mx' });

    await setDoc(doc(db, 'solicitudesPiezas', S1), solicitud('T1', 'baja-california'));
  });
}

function taller(owner, activo) {
  return {
    nombre: 'Taller Uno', whatsapp: '6641110000', ciudad: 'Tijuana', logoUrl: '', ownerUid: owner, activo,
    creadoAt: new Date(), aceptacionVersion: 'v1',
    avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: new Date() },
  };
}
function yonke(owner, estado, activo) {
  return { nombre: `Yonke ${owner}`, estado, activo, ownerUid: owner, whatsapp: `664222${owner === 'y1' ? '0001' : owner === 'y2' ? '0002' : owner === 'y3' ? '0003' : '0004'}` };
}
function solicitud(tallerId, estado, extra = {}) {
  return {
    tallerId, tallerNombre: 'Taller Uno',
    vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 },
    pieza: 'Defensa delantera', nota: '',
    estado, estadoSolicitud: 'abierta', yonkeElegido: null,
    creadoAt: serverTimestamp(), expiraAt: expiraNueva(),
    ...extra,
  };
}
function respuesta(yonkeId, { tieneLaPieza = true, precio = 500, nota = '', whatsapp = '6642220001', yonkeNombre = `Yonke ${yonkeId.toLowerCase()}` } = {}, expiraAt = expiraNueva()) {
  const base = { yonkeId, yonkeNombre, tieneLaPieza, nota, whatsapp, creadoAt: serverTimestamp(), expiraAt };
  return tieneLaPieza ? { ...base, precio } : base;
}

const como = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const sref = (uid, id = S1) => doc(como(uid), 'solicitudesPiezas', id);
const rref = (uid, yonkeId, id = S1) => doc(como(uid), 'solicitudesPiezas', id, 'respuestas', yonkeId);
const privadoRef = (uid, id = S1) => doc(como(uid), 'solicitudesPiezas', id, 'privado', 'contacto');

async function conConfig(valor) {
  await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'config', 'solicitudesPiezas'), { habilitado: valor }); });
}
async function conEstadoSolicitud(estadoSolicitud, yonkeElegido = null, id = S1) {
  await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), 'solicitudesPiezas', id), { estadoSolicitud, yonkeElegido }); });
}
async function sembrarRespuesta(yonkeId, datos, id = S1) {
  await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'solicitudesPiezas', id, 'respuestas', yonkeId), respuesta(yonkeId, datos)); });
}

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitudes', firestore: { rules: reglas, host: '127.0.0.1', port: 8181 } });
});
after(async () => { await env.cleanup(); });

describe('falla cerrada: falta config/solicitudesPiezas', () => {
  it('crear una solicitud NO', async () => {
    await sembrar({ config: false });
    await assertFails(setDoc(sref('t1', 'SNEW'), solicitud('T1', 'baja-california')));
  });
  it('responder a una solicitud existente NO (aunque la solicitud ya exista)', async () => {
    await sembrar();
    await conConfig(false);
    await assertFails(setDoc(rref('y1', 'Y1'), respuesta('Y1')));
  });
});

describe('crear una solicitud', () => {
  it('el taller activo dueño crea una solicitud válida', async () => {
    await sembrar();
    await assertSucceeds(setDoc(sref('t1', 'SNEW'), solicitud('T1', 'baja-california')));
  });
  it('taller desactivado NO puede crear', async () => {
    await sembrar();
    await assertFails(setDoc(sref('t3', 'SNEW'), solicitud('T3', 'baja-california')));
  });
  it('un taller NO puede crear a nombre de otro taller', async () => {
    await sembrar();
    await assertFails(setDoc(sref('t1', 'SNEW'), solicitud('T2', 'baja-california')));
  });
  it('rechaza un tallerNombre que no coincide con el del taller', async () => {
    await sembrar();
    await assertFails(setDoc(sref('t1', 'SNEW'), solicitud('T1', 'baja-california', { tallerNombre: 'Otro nombre' })));
  });
  it('rechaza nacer ya elegida o cerrada', async () => {
    await sembrar();
    await assertFails(setDoc(sref('t1', 'SNEW'), solicitud('T1', 'baja-california', { yonkeElegido: 'Y1' })));
    await assertFails(setDoc(sref('t1', 'SNEW'), solicitud('T1', 'baja-california', { estadoSolicitud: 'cerrada' })));
  });
  it('rechaza año fuera de rango, pieza vacía o campos extra', async () => {
    await sembrar();
    await assertFails(setDoc(sref('t1', 'SNEW'), solicitud('T1', 'baja-california', { vehiculo: { marca: 'N', modelo: 'S', anio: 1800 } })));
    await assertFails(setDoc(sref('t1', 'SNEW'), solicitud('T1', 'baja-california', { pieza: '' })));
    await assertFails(setDoc(sref('t1', 'SNEW'), solicitud('T1', 'baja-california', { extra: 'x' })));
  });
  it('acepta vencer a los 5 días (tolerancia ±5 min) y rechaza otra vigencia', async () => {
    await sembrar();
    await assertSucceeds(setDoc(sref('t1', 'S5D'), solicitud('T1', 'baja-california', { expiraAt: new Date(ahora() + 5 * DIA + 60000) })));
    await assertFails(setDoc(sref('t1', 'S1D'), solicitud('T1', 'baja-california', { expiraAt: new Date(ahora() + 1 * DIA) })));
  });
  it('un visitante o un yonke no pueden crear solicitudes', async () => {
    await sembrar();
    await assertFails(setDoc(sref(null, 'SNEW'), solicitud('T1', 'baja-california')));
    await assertFails(setDoc(sref('y1', 'SNEW'), solicitud('T1', 'baja-california')));
  });
});

describe('leer una solicitud', () => {
  it('admin y el taller dueño leen', async () => {
    await sembrar();
    await assertSucceeds(getDoc(sref('adm')));
    await assertSucceeds(getDoc(sref('t1')));
  });
  it('un taller ajeno NO lee', async () => {
    await sembrar();
    await assertFails(getDoc(sref('t2')));
  });
  it('un yonke activo del mismo estado lee mientras está abierta', async () => {
    await sembrar();
    await assertSucceeds(getDoc(sref('y1')));
  });
  it('un yonke de otro estado NO lee', async () => {
    await sembrar();
    await assertFails(getDoc(sref('y3')));
  });
  it('un yonke inactivo del mismo estado NO lee', async () => {
    await sembrar();
    await assertFails(getDoc(sref('y4')));
  });
  it('cerrada: el yonke NO elegido ya no la ve, pero el yonke elegido SÍ', async () => {
    await sembrar();
    await conEstadoSolicitud('cerrada', 'Y1');
    await assertFails(getDoc(sref('y2')));
    await assertSucceeds(getDoc(sref('y1')));
  });
  it('la consulta real del yonke (mismo estado + abierta, ordenada) se puede hacer', async () => {
    await sembrar();
    const q = query(collection(como('y1'), 'solicitudesPiezas'), where('estado', '==', 'baja-california'), where('estadoSolicitud', '==', 'abierta'), orderBy('creadoAt', 'desc'));
    await assertSucceeds(getDocs(q));
  });
  it('la consulta real del taller (sus solicitudes, ordenadas) se puede hacer', async () => {
    await sembrar();
    const q = query(collection(como('t1'), 'solicitudesPiezas'), where('tallerId', '==', 'T1'), orderBy('creadoAt', 'desc'));
    await assertSucceeds(getDocs(q));
  });
});

describe('respuestas de los yonkes', () => {
  it('un yonke activo del mismo estado responde "la tengo" con precio', async () => {
    await sembrar();
    await assertSucceeds(setDoc(rref('y1', 'Y1'), respuesta('Y1', { tieneLaPieza: true, precio: 850 })));
  });
  it('un yonke responde "no la tengo" sin precio', async () => {
    await sembrar();
    await assertSucceeds(setDoc(rref('y1', 'Y1'), respuesta('Y1', { tieneLaPieza: false })));
  });
  it('"la tengo" sin precio, con precio 0 o por encima del tope NO', async () => {
    await sembrar();
    await assertFails(setDoc(rref('y1', 'Y1'), { yonkeId: 'Y1', yonkeNombre: 'Yonke y1', tieneLaPieza: true, nota: '', whatsapp: '6642220001', creadoAt: new Date(), expiraAt: expiraNueva() }));
    await assertFails(setDoc(rref('y1', 'Y1'), respuesta('Y1', { tieneLaPieza: true, precio: 0 })));
    await assertFails(setDoc(rref('y1', 'Y1'), respuesta('Y1', { tieneLaPieza: true, precio: 1000001 })));
  });
  it('"no la tengo" con precio puesto NO', async () => {
    await sembrar();
    await assertFails(setDoc(rref('y1', 'Y1'), { yonkeId: 'Y1', yonkeNombre: 'Yonke y1', tieneLaPieza: false, precio: 100, nota: '', whatsapp: '6642220001', creadoAt: new Date(), expiraAt: expiraNueva() }));
  });
  it('un yonke NO puede responder a nombre de otro yonke', async () => {
    await sembrar();
    await assertFails(setDoc(rref('y1', 'Y2'), respuesta('Y2')));
  });
  it('un yonke de otro estado o inactivo NO puede responder', async () => {
    await sembrar();
    await assertFails(setDoc(rref('y3', 'Y3'), respuesta('Y3', { whatsapp: '6642220003', yonkeNombre: 'Yonke y3' })));
    await assertFails(setDoc(rref('y4', 'Y4'), respuesta('Y4', { whatsapp: '6642220004', yonkeNombre: 'Yonke y4' })));
  });
  it('rechaza un whatsapp o nombre distinto al del propio yonke', async () => {
    await sembrar();
    await assertFails(setDoc(rref('y1', 'Y1'), respuesta('Y1', { whatsapp: '0000000000' })));
    await assertFails(setDoc(rref('y1', 'Y1'), respuesta('Y1', { yonkeNombre: 'Otro nombre' })));
  });
  it('rechaza expiraAt distinto al de la solicitud', async () => {
    await sembrar();
    await assertFails(setDoc(rref('y1', 'Y1'), respuesta('Y1', {}, new Date(ahora() + 2 * DIA))));
  });
  it('no se puede responder dos veces (la segunda escritura es "update", prohibido)', async () => {
    await sembrar();
    await assertSucceeds(setDoc(rref('y1', 'Y1'), respuesta('Y1')));
    await assertFails(setDoc(rref('y1', 'Y1'), respuesta('Y1', { tieneLaPieza: false })));
  });
  it('no se puede responder a una solicitud ya cerrada o cancelada', async () => {
    await sembrar();
    await conEstadoSolicitud('cancelada');
    await assertFails(setDoc(rref('y2', 'Y2'), respuesta('Y2', { whatsapp: '6642220002', yonkeNombre: 'Yonke y2' })));
  });
  it('nadie (ni el yonke) puede editar su respuesta; solo el admin puede borrarla', async () => {
    await sembrar();
    await sembrarRespuesta('Y1', {});
    await assertFails(updateDoc(rref('y1', 'Y1'), { precio: 1 }));
    await assertFails(deleteDoc(rref('y1', 'Y1')));
    await assertSucceeds(deleteDoc(rref('adm', 'Y1')));
  });
  it('lectura: el taller dueño y el admin leen todas; cada yonke lee la suya; otro yonke NO', async () => {
    await sembrar();
    await sembrarRespuesta('Y1', {});
    await sembrarRespuesta('Y2', { tieneLaPieza: false, whatsapp: '6642220002', yonkeNombre: 'Yonke y2' });
    await assertSucceeds(getDoc(rref('t1', 'Y1')));
    await assertSucceeds(getDoc(rref('t1', 'Y2')));
    await assertSucceeds(getDoc(rref('adm', 'Y1')));
    await assertSucceeds(getDoc(rref('y1', 'Y1')));
    await assertFails(getDoc(rref('y2', 'Y1')));
    await assertFails(getDoc(rref('t2', 'Y1')));
  });
});

describe('el taller elige un yonke', () => {
  it('elige a un yonke que respondió que SÍ la tiene: pasa a cerrada', async () => {
    await sembrar();
    await sembrarRespuesta('Y1', {});
    await assertSucceeds(updateDoc(sref('t1'), { estadoSolicitud: 'cerrada', yonkeElegido: 'Y1' }));
    const d = (await getDoc(sref('t1'))).data();
    assert.equal(d.estadoSolicitud, 'cerrada');
    assert.equal(d.yonkeElegido, 'Y1');
  });
  it('NO puede elegir a un yonke que respondió que no la tiene', async () => {
    await sembrar();
    await sembrarRespuesta('Y2', { tieneLaPieza: false, whatsapp: '6642220002', yonkeNombre: 'Yonke y2' });
    await assertFails(updateDoc(sref('t1'), { estadoSolicitud: 'cerrada', yonkeElegido: 'Y2' }));
  });
  it('NO puede elegir a un yonke que nunca respondió', async () => {
    await sembrar();
    await assertFails(updateDoc(sref('t1'), { estadoSolicitud: 'cerrada', yonkeElegido: 'Y1' }));
  });
  it('NO puede volver a elegir una solicitud ya cerrada', async () => {
    await sembrar();
    await sembrarRespuesta('Y1', {});
    await sembrarRespuesta('Y2', { tieneLaPieza: false, whatsapp: '6642220002', yonkeNombre: 'Yonke y2' });
    await conEstadoSolicitud('cerrada', 'Y1');
    await assertFails(updateDoc(sref('t1'), { yonkeElegido: 'Y2' }));
  });
  it('NO puede cambiar otro campo junto con elegir', async () => {
    await sembrar();
    await sembrarRespuesta('Y1', {});
    await assertFails(updateDoc(sref('t1'), { estadoSolicitud: 'cerrada', yonkeElegido: 'Y1', pieza: 'Otra' }));
  });
  it('un taller ajeno NO puede elegir', async () => {
    await sembrar();
    await sembrarRespuesta('Y1', {});
    await assertFails(updateDoc(sref('t2'), { estadoSolicitud: 'cerrada', yonkeElegido: 'Y1' }));
  });
});

describe('el taller cancela', () => {
  it('cancela una solicitud abierta', async () => {
    await sembrar();
    await assertSucceeds(updateDoc(sref('t1'), { estadoSolicitud: 'cancelada' }));
  });
  it('NO puede cancelar una ya cerrada', async () => {
    await sembrar();
    await conEstadoSolicitud('cerrada', 'Y1');
    await assertFails(updateDoc(sref('t1'), { estadoSolicitud: 'cancelada' }));
  });
  it('un taller ajeno NO puede cancelar', async () => {
    await sembrar();
    await assertFails(updateDoc(sref('t2'), { estadoSolicitud: 'cancelada' }));
  });
});

describe('borrar una solicitud', () => {
  it('el admin y el taller dueño borran', async () => {
    await sembrar();
    await assertSucceeds(deleteDoc(sref('adm')));
  });
  it('el taller dueño borra la suya', async () => {
    await sembrar();
    await assertSucceeds(deleteDoc(sref('t1')));
  });
  it('un taller ajeno NO borra', async () => {
    await sembrar();
    await assertFails(deleteDoc(sref('t2')));
  });
});

describe('subcolección privada (WhatsApp del taller)', () => {
  async function conPrivado() {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'solicitudesPiezas', S1, 'privado', 'contacto'), { tallerWhatsapp: '6641110000', expiraAt: expiraNueva() });
    });
  }
  it('se crea en el mismo lote que la solicitud', async () => {
    await sembrar();
    const db = como('t1');
    const nuevo = doc(db, 'solicitudesPiezas', 'SBATCH');
    const b = writeBatch(db);
    const exp = expiraNueva();
    b.set(nuevo, solicitud('T1', 'baja-california', { expiraAt: exp }));
    b.set(doc(db, 'solicitudesPiezas', 'SBATCH', 'privado', 'contacto'), { tallerWhatsapp: '6641110000', expiraAt: exp });
    await assertSucceeds(b.commit());
  });
  it('rechaza un WhatsApp distinto al real del taller, en el mismo lote', async () => {
    await sembrar();
    const db = como('t1');
    const nuevo = doc(db, 'solicitudesPiezas', 'SBAD');
    const b = writeBatch(db);
    const exp = expiraNueva();
    b.set(nuevo, solicitud('T1', 'baja-california', { expiraAt: exp }));
    b.set(doc(db, 'solicitudesPiezas', 'SBAD', 'privado', 'contacto'), { tallerWhatsapp: '0000000000', expiraAt: exp });
    await assertFails(b.commit());
  });
  it('el taller dueño y el admin leen el contacto; otro yonke NO mientras está abierta', async () => {
    await sembrar();
    await conPrivado();
    await assertSucceeds(getDoc(privadoRef('t1')));
    await assertSucceeds(getDoc(privadoRef('adm')));
    await assertFails(getDoc(privadoRef('y1')));
  });
  it('tras elegir, el yonke elegido SÍ lee el contacto; el no elegido sigue sin poder', async () => {
    await sembrar();
    await conPrivado();
    await sembrarRespuesta('Y1', {});
    await sembrarRespuesta('Y2', { tieneLaPieza: false, whatsapp: '6642220002', yonkeNombre: 'Yonke y2' });
    await conEstadoSolicitud('cerrada', 'Y1');
    await assertSucceeds(getDoc(privadoRef('y1')));
    await assertFails(getDoc(privadoRef('y2')));
  });
  it('nadie puede editar el contacto; el taller dueño y el admin pueden borrarlo', async () => {
    await sembrar();
    await conPrivado();
    await assertFails(updateDoc(privadoRef('t1'), { tallerWhatsapp: '0000000000' }));
    await assertSucceeds(deleteDoc(privadoRef('t1')));
  });
});
