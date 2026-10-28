// Pruebas de storage.rules con los emuladores de Storage y Firestore juntos (las reglas de Storage
// leen usuarios/{uid} de Firestore). Proyecto demo-mecanix: el mismo con el que se levantan los
// emuladores (package.json), para que Storage encuentre los usuarios sembrados en Firestore.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';

const reglasStorage = readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8');
const reglasFirestore = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const KB = 1024;
let env;

const bytes = (n) => new Uint8Array(n);
const png = { contentType: 'image/png' };
const st = (uid) => (uid ? env.authenticatedContext(uid).storage() : env.unauthenticatedContext().storage());
const subir = (uid, ruta, n = 10 * KB, meta = png) => uploadBytes(ref(st(uid), ruta), bytes(n), meta);
const borrar = (uid, ruta) => deleteObject(ref(st(uid), ruta));

async function usuario(uid, datos) {
  await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'usuarios', uid), datos); });
}
async function sembrarArchivo(ruta) {
  await env.withSecurityRulesDisabled(async (c) => { await uploadBytes(ref(c.storage(), ruta), bytes(100), png); });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mecanix',
    firestore: { rules: reglasFirestore, host: '127.0.0.1', port: 8181 },
    storage: { rules: reglasStorage, host: '127.0.0.1', port: 9199 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearStorage();
  await env.clearFirestore();
  await usuario('adm', { rol: 'admin', email: 'a@x.mx' });
  await usuario('y1', { rol: 'yonke', yonkeId: 'Y1', email: 'y1@x.mx' });
  await usuario('y2', { rol: 'yonke', yonkeId: 'Y2', email: 'y2@x.mx' });
  await usuario('t1', { rol: 'taller', tallerId: 'T1', email: 't1@x.mx' });
});

describe('logos/{fileName}: admin todo; yonke solo {su yonkeId}.png', () => {
  it('el yonke sube y reemplaza SU logo', async () => {
    await assertSucceeds(subir('y1', 'logos/Y1.png'));
    await assertSucceeds(subir('y1', 'logos/Y1.png'));
  });
  it('el yonke NO sube el logo de otro ni con otro nombre', async () => {
    await assertFails(subir('y1', 'logos/Y2.png'));
    await assertFails(subir('y1', 'logos/Y1.webp'));
    await assertFails(subir('y1', 'logos/cualquier-cosa.png'));
  });
  it('el yonke borra el suyo, no el de otro', async () => {
    await sembrarArchivo('logos/Y1.png');
    await sembrarArchivo('logos/Y2.png');
    await assertFails(borrar('y1', 'logos/Y2.png'));
    await assertSucceeds(borrar('y1', 'logos/Y1.png'));
  });
  it('el admin sube y borra cualquiera (también con otro nombre)', async () => {
    await assertSucceeds(subir('adm', 'logos/Y2.png'));
    await assertSucceeds(subir('adm', 'logos/especial.webp', 10 * KB, { contentType: 'image/webp' }));
    await sembrarArchivo('logos/Y1.png');
    await assertSucceeds(borrar('adm', 'logos/Y1.png'));
    await assertSucceeds(borrar('adm', 'logos/Y2.png'));
  });
  it('tope: 700 KB pasa, 701 KB no (yonke y admin)', async () => {
    await assertSucceeds(subir('y1', 'logos/Y1.png', 700 * KB));
    await assertFails(subir('y1', 'logos/Y1.png', 701 * KB));
    await assertFails(subir('adm', 'logos/Y2.png', 701 * KB));
  });
  it('solo imágenes PNG, WebP o JPEG', async () => {
    await assertSucceeds(subir('y1', 'logos/Y1.png', 10 * KB, { contentType: 'image/jpeg' }));
    await assertSucceeds(subir('y1', 'logos/Y1.png', 10 * KB, { contentType: 'image/webp' }));
    for (const contentType of ['text/plain', 'application/pdf', 'image/svg+xml', 'image/gif', 'text/html']) {
      await assertFails(subir('y1', 'logos/Y1.png', 10 * KB, { contentType }));
      await assertFails(subir('adm', 'logos/Y1.png', 10 * KB, { contentType }));
    }
  });
  it('sin sesión, un taller o un usuario sin documento: no', async () => {
    await assertFails(subir(null, 'logos/Y1.png'));
    await assertFails(subir('t1', 'logos/T1.png'));
    await assertFails(subir('t1', 'logos/Y1.png'));
    await assertFails(subir('nadie', 'logos/Y1.png'));
  });
  it('registro de un yonke nuevo: con su usuario ya creado (como hace el registro), sube su logo', async () => {
    await assertFails(subir('y3', 'logos/Y3.png'));                       // antes de crear el usuario
    await usuario('y3', { rol: 'yonke', yonkeId: 'Y3', email: 'y3@x.mx' }); // paso 3 del registro
    await assertSucceeds(subir('y3', 'logos/Y3.png'));                    // paso 4: el logo
  });
  it('lectura pública, como siempre', async () => {
    await sembrarArchivo('logos/Y1.png');
    await assertSucceeds(getBytes(ref(st(null), 'logos/Y1.png')));
  });
});

describe('las demás rutas siguen igual', () => {
  const casos = [
    ['branding/{id}/promos/a.webp', 500],
    ['branding/{id}/sobre-nosotros/a.webp', 500],
    ['branding/{id}/fondo/a.webp', 1024],
    ['yonkes/{id}/vehiculos/V1/frontal-1.webp', 400],
    ['yonkes/{id}/vehiculos/V1/piezas/p-1.webp', 200],
    ['yonkes/{id}/motores/m-1.webp', 200],
    ['yonkes/{id}/piezasSueltas/s-1.webp', 200],
  ];
  const webp = { contentType: 'image/webp' };
  for (const [plantilla, topeKb] of casos) {
    it(`${plantilla}: dueño y admin hasta ${topeKb} KB; otro yonke no; borra el dueño`, async () => {
      const mia = plantilla.replace('{id}', 'Y1');
      await assertSucceeds(subir('y1', mia, topeKb * KB, webp));
      await assertFails(subir('y1', mia, topeKb * KB + 1, webp));
      await assertFails(subir('y1', mia, 10 * KB, { contentType: 'text/plain' }));
      await assertFails(subir('y2', mia, 10 * KB, webp));
      await assertSucceeds(subir('adm', mia, 10 * KB, webp));
      await assertSucceeds(getBytes(ref(st(null), mia)));
      await assertFails(borrar('y2', mia));
      await assertSucceeds(borrar('y1', mia));
    });
  }
  it('cualquier otra ruta: cerrada', async () => {
    await assertFails(subir('adm', 'otra/cosa.png'));
    await assertFails(subir('y1', 'talleres/T1/logo.webp'));
  });
});

describe('refaccionarias/{id}/logo/...: el dueño de la refaccionaria o el admin', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'refaccionarias', 'R1'), { nombre: 'El Pistón', ownerUid: 'r1' });
      await setDoc(doc(c.firestore(), 'refaccionarias', 'R2'), { nombre: 'Otra', ownerUid: 'r2' });
    });
    await usuario('r1', { rol: 'refaccionaria', refaccionariaId: 'R1', email: 'r1@x.mx' });
    await usuario('r2', { rol: 'refaccionaria', refaccionariaId: 'R2', email: 'r2@x.mx' });
  });
  const webp = { contentType: 'image/webp' };
  it('el dueño sube y borra su logo; otra refaccionaria, un yonke o sin sesión no', async () => {
    await assertSucceeds(subir('r1', 'refaccionarias/R1/logo/logo.webp', 10 * KB, webp));
    await assertFails(subir('r2', 'refaccionarias/R1/logo/logo.webp', 10 * KB, webp));
    await assertFails(subir('y1', 'refaccionarias/R1/logo/logo.webp', 10 * KB, webp));
    await assertFails(subir(null, 'refaccionarias/R1/logo/logo.webp', 10 * KB, webp));
    await assertSucceeds(borrar('r1', 'refaccionarias/R1/logo/logo.webp'));
  });
  it('tope de 300 KB y solo imágenes; el admin también sube', async () => {
    await assertSucceeds(subir('r1', 'refaccionarias/R1/logo/logo.webp', 300 * KB, webp));
    await assertFails(subir('r1', 'refaccionarias/R1/logo/logo.webp', 300 * KB + 1, webp));
    await assertFails(subir('r1', 'refaccionarias/R1/logo/logo.pdf', 10 * KB, { contentType: 'application/pdf' }));
    await assertSucceeds(subir('adm', 'refaccionarias/R1/logo/logo.png', 10 * KB));
  });
});
