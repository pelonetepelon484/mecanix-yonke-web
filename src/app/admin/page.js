'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, orderBy, where, doc, updateDoc, setDoc, getDoc, getDocs, deleteDoc, Timestamp, deleteField } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { borrarLogoYonke } from '../lib/subirLogoYonke';
import { ESTADO_DEFAULT, estadoDeYonke, cargarEstados } from '../lib/estados';

const CIUDADES_BC = [
  { key: 'tijuana', label: 'Tijuana' },
  { key: 'mexicali', label: 'Mexicali' },
  { key: 'ensenada', label: 'Ensenada' },
  { key: 'tecate', label: 'Tecate' },
  { key: 'rosarito', label: 'Playas de Rosarito' },
  { key: 'sanquintin', label: 'San Quintín' },
];

function formatearFechaCorta(fecha) {
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function obtenerEstadoPremium(premiumHasta) {
  if (!premiumHasta) return null;
  const fecha = premiumHasta?.toDate ? premiumHasta.toDate() : new Date(premiumHasta);
  const ahora = new Date();
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const diffDias = Math.ceil((fecha - inicioHoy) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    const dias = Math.abs(diffDias);
    return { texto: `⚠️ VENCIDO hace ${dias} día${dias === 1 ? '' : 's'}`, bg: '#FDECEA', color: '#C62828' };
  }
  if (diffDias <= 7) {
    return { texto: `⏳ Vence: ${formatearFechaCorta(fecha)} (${diffDias} día${diffDias === 1 ? '' : 's'})`, bg: '#FEF3EC', color: '#E8720C' };
  }
  return { texto: `⏳ Vence: ${formatearFechaCorta(fecha)} (${diffDias} días)`, bg: '#E8F5E9', color: '#2E7D32' };
}

export default function AdminPage() {
  const router = useRouter();
  const [yonkes, setYonkes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [estadosDisponibles, setEstadosDisponibles] = useState([{ id: ESTADO_DEFAULT, nombre: 'Baja California' }]);
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [regenerandoCatalogo, setRegenerandoCatalogo] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const [migrandoBusquedas, setMigrandoBusquedas] = useState(false);
  const [modalPremiumVisible, setModalPremiumVisible] = useState(false);
  const [yonkeParaPremium, setYonkeParaPremium] = useState(null);
  const [fechaPremium, setFechaPremium] = useState('');

  // Borrado completo de yonke — pasoBorrado: null (cerrado) | 'resumen' | 'confirmar' | 'ejecutando' | 'resultado'
  const [yonkeParaBorrar, setYonkeParaBorrar] = useState(null);
  const [pasoBorrado, setPasoBorrado] = useState(null);
  const [resumenBorrado, setResumenBorrado] = useState(null);
  const [textoConfirmacionBorrado, setTextoConfirmacionBorrado] = useState('');
  const [resultadoBorrado, setResultadoBorrado] = useState(null);

  const regenerarCatalogo = async () => {
    setRegenerandoCatalogo(true);
    try {
      const catalogo = {};
      const yonkesSnap = await getDocs(collection(db, 'yonkes'));
      for (const yonkeDoc of yonkesSnap.docs) {
        const vehSnap = await getDocs(collection(db, 'yonkes', yonkeDoc.id, 'vehiculos'));
        vehSnap.forEach((v) => {
          const d = v.data();
          if (!d.marca || !d.modelo) return;
          if (!catalogo[d.marca]) catalogo[d.marca] = new Set();
          catalogo[d.marca].add(d.modelo);
        });
      }
      const catalogoFinal = {};
      Object.keys(catalogo).sort().forEach((m) => {
        catalogoFinal[m] = [...catalogo[m]].sort();
      });
      await setDoc(doc(db, 'config', 'catalogoVehiculos'), {
        catalogo: catalogoFinal,
        actualizado: new Date(),
      });
      const verificacion = await getDoc(doc(db, 'config', 'catalogoVehiculos'));
      if (verificacion.exists()) {
        alert(`✅ Catálogo actualizado: ${Object.keys(catalogoFinal).length} marcas`);
      } else {
        alert('❌ El catálogo no se pudo verificar. Revisa las reglas de Firestore.');
      }
    } catch (e) {
      console.error(e);
      alert(`❌ Error: ${e.code || ''} ${e.message}`);
    }
    setRegenerandoCatalogo(false);
  };

  const migrarInventario = async () => {
    if (!confirm('Esto corregirá marcas y modelos de TODOS los vehículos. ¿Continuar?')) return;
    setMigrando(true);
    try {
      const MARCAS = {
        'ford': 'Ford', 'chevrolet': 'Chevrolet', 'honda': 'Honda', 'toyota': 'Toyota',
        'jeep': 'Jeep', 'volkswagen': 'Volkswagen', 'volkaswagen': 'Volkswagen',
        'nissan': 'Nissan', 'mitsubishi': 'Mitsubishi', 'mitsubushi': 'Mitsubishi',
        'gmc': 'GMC', 'chrysler': 'Chrysler', 'dodge': 'Dodge', 'scion': 'Scion',
        'hyundai': 'Hyundai', 'mazda': 'Mazda', 'saturn': 'Saturn', 'cadillac': 'Cadillac',
        'kia': 'Kia', 'land rover': 'Land Rover', 'mini': 'Mini', 'buick': 'Buick',
        'ram': 'RAM', 'acura': 'Acura', 'geo': 'Geo', 'bmw': 'BMW', 'suzuki': 'Suzuki',
        'isuzu': 'Isuzu', 'mercury': 'Mercury', 'mercedes benz': 'Mercedes-Benz',
        'mercedes-benz': 'Mercedes-Benz', 'lincoln': 'Lincoln', 'audi': 'Audi',
        'lexus': 'Lexus', 'ponriac': 'Pontiac', 'pontiac': 'Pontiac', 'volvo': 'Volvo',
      };
      const MODELOS = {
        'Chevrolet|1500': 'Silverado 1500', 'Toyota|wagon': 'Corolla Wagon',
        'Lexus|cs300': 'GS300', 'RAM|aventure': '700',
        'Ford|f150': 'F-150', 'Ford|f350': 'F-350', 'Ford|fusión': 'Fusion',
        'Ford|explorer sportrac': 'Explorer', 'Ford|explorer sport trac': 'Explorer',
        'Ford|explorer sport': 'Explorer', 'Ford|explorer xlt': 'Explorer',
        'Ford|explorer eddie bauer': 'Explorer', 'Ford|crown victoria': 'Crown Victoria',
        'Chevrolet|s10': 'S10', 'Chevrolet|hhr': 'HHR', 'Chevrolet|equinox ltz': 'Equinox',
        'Chevrolet|malibu maxx': 'Malibu', 'Chevrolet|cobalt lt': 'Cobalt',
        'Chevrolet|pop': 'Chevy Pop', 'Chevrolet|chevy pop': 'Chevy Pop',
        'Chevrolet|chevy van': 'Chevy Van',
        'Toyota|rav 4': 'RAV4', 'Toyota|rav4': 'RAV4', 'Toyota|t100': 'T100',
        'Honda|crv': 'CR-V', 'Nissan|np300': 'NP300',
        'Kia|río': 'Rio', 'Kia|óptima': 'Optima',
        'Mazda|3': '3', 'Mazda|5': '5', 'Mazda|6': '6',
        'Mazda|cx9': 'CX-9', 'Mazda|cx7': 'CX-7', 'Mazda|protege 5': 'Protege',
        'Mazda|protegé': 'Protege',
        'Hyundai|santa fe': 'Santa Fe', 'Hyundai|h100': 'H100', 'Hyundai|i10': 'i10',
        'Chrysler|pt cruiser': 'PT Cruiser', 'Chrysler|town country': 'Town & Country',
        'Jeep|cherokee latitud': 'Cherokee', 'Volkswagen|gti': 'Golf',
        'Mercedes-Benz|ml350': 'ML350', 'Mercedes-Benz|ml320': 'ML320', 'Mercedes-Benz|c230': 'C230',
        'Lincoln|mkx': 'MKX',
        'GMC|acadia denali': 'Acadia', 'GMC|jimmy': 'Jimmy',
        'Acura|mdx': 'MDX', 'Acura|tl': 'TL',
        'Scion|xb': 'xB', 'Scion|tc': 'tC',
        'Mercury|mountainer': 'Mountaineer', 'Isuzu|ascend': 'Ascender',
        'Land Rover|lr3': 'LR3',
        'BMW|x5': 'X5', 'BMW|325i': '325i', 'BMW|328i': '328i', 'BMW|323i': '323i', 'BMW|750i': '750i',
      };
      const REUBICAR = {
        'Chevrolet|acadia': { marca: 'GMC', modelo: 'Acadia' },
        'Chevrolet|yukon': { marca: 'GMC', modelo: 'Yukon' },
      };
      const REVISAR = new Set(['Dodge|ram']);
      const titulo = (s) => s.trim().toLowerCase().split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      let cambios = 0;
      const yonkesSnap = await getDocs(collection(db, 'yonkes'));
      for (const yonkeDoc of yonkesSnap.docs) {
        const vehSnap = await getDocs(collection(db, 'yonkes', yonkeDoc.id, 'vehiculos'));
        for (const v of vehSnap.docs) {
          const d = v.data();
          const marcaOrig = (d.marca || '').trim();
          const modeloOrig = (d.modelo || '').trim();
          let marcaNueva = MARCAS[marcaOrig.toLowerCase()] || titulo(marcaOrig);
          const clave = `${marcaNueva}|${modeloOrig.toLowerCase()}`;
          if (REVISAR.has(clave)) continue;
          let modeloNuevo;
          if (REUBICAR[clave]) {
            marcaNueva = REUBICAR[clave].marca;
            modeloNuevo = REUBICAR[clave].modelo;
          } else {
            modeloNuevo = MODELOS[clave] || titulo(modeloOrig);
          }
          if (marcaNueva === marcaOrig && modeloNuevo === modeloOrig) continue;
          await updateDoc(doc(db, 'yonkes', yonkeDoc.id, 'vehiculos', v.id), {
            marca: marcaNueva, modelo: modeloNuevo,
          });
          cambios++;
        }
      }
      alert(`✅ Migración aplicada: ${cambios} vehículos corregidos. Ahora dale a "Actualizar catálogo".`);
    } catch (e) {
      console.error(e);
      alert(`❌ Error: ${e.code || ''} ${e.message}`);
    }
    setMigrando(false);
  };

  // Migración one-time de las colecciones viejas de solo-fallos (busquedas_no_interpretadas,
  // modelos_no_reconocidos) hacia la nueva colección unificada "busquedas". Debe correr desde
  // aquí (sesión admin autenticada), NUNCA desde la consola del navegador: Firestore cachea
  // escrituras offline y resuelve las promesas como exitosas aunque el servidor las rechace.
  const migrarBusquedas = async () => {
    try {
      const marcador = await getDoc(doc(db, 'config', 'migracionBusquedas'));
      if (marcador.exists() && marcador.data().ejecutada) {
        const fecha = marcador.data().fecha?.toDate ? marcador.data().fecha.toDate() : null;
        const aviso = `Esta migración ya se ejecutó${fecha ? ` el ${formatearFechaCorta(fecha)}` : ''} (${marcador.data().totalMigrados || 0} docs). ¿Ejecutar de nuevo de todas formas?`;
        if (!confirm(aviso)) return;
      } else if (!confirm('Esto migrará los documentos antiguos de busquedas_no_interpretadas y modelos_no_reconocidos hacia la colección "busquedas". ¿Continuar?')) {
        return;
      }
      setMigrandoBusquedas(true);

      let cambios = 0;

      // Nombres de campo EXACTOS exigidos por la regla de Firestore: textoOriginal
      // (string, 1-299 chars), estado (enum), numResultados (int >= 0, nunca null), origen.
      const noInterpretadasSnap = await getDocs(collection(db, 'busquedas_no_interpretadas'));
      for (const d of noInterpretadasSnap.docs) {
        const data = d.data();
        const textoOriginal = (data.textoOriginal || '').trim().slice(0, 299) || '(sin texto)';
        await setDoc(doc(db, 'busquedas', `migrado_busquedas_no_interpretadas_${d.id}`), {
          textoOriginal, estado: 'no_interpretada',
          pieza: null, marca: null, modelo: null, anio: null,
          tipoResultado: null, numResultados: 0, piezaNoEncontrada: null,
          subtipo: null, origen: 'web', tieneContacto: false,
          fecha: data.fecha || Timestamp.now(),
          migrado: true, migradoDesde: 'busquedas_no_interpretadas',
        });
        cambios++;
      }

      const modelosNoReconocidosSnap = await getDocs(collection(db, 'modelos_no_reconocidos'));
      for (const d of modelosNoReconocidosSnap.docs) {
        const data = d.data();
        const textoOriginal = (data.textoOriginal || '').trim().slice(0, 299) || '(sin texto)';
        await setDoc(doc(db, 'busquedas', `migrado_modelos_no_reconocidos_${d.id}`), {
          textoOriginal, estado: 'fuera_de_catalogo',
          pieza: data.piezaExtraida || null, marca: data.marcaExtraida || null,
          modelo: data.modeloExtraido || null, anio: data.anioExtraido || null,
          tipoResultado: null, numResultados: 0, piezaNoEncontrada: null,
          subtipo: null, origen: 'web', tieneContacto: false,
          fecha: data.fecha || Timestamp.now(),
          migrado: true, migradoDesde: 'modelos_no_reconocidos',
        });
        cambios++;
      }

      await setDoc(doc(db, 'config', 'migracionBusquedas'), {
        ejecutada: true, fecha: new Date(), totalMigrados: cambios,
      });

      alert(`✅ Migración completa: ${noInterpretadasSnap.size} docs de busquedas_no_interpretadas + ${modelosNoReconocidosSnap.size} docs de modelos_no_reconocidos → ${cambios} docs en "busquedas".`);
    } catch (e) {
      console.error(e);
      alert(`❌ Error: ${e.code || ''} ${e.message}`);
    }
    setMigrandoBusquedas(false);
  };

  // Borra todos los docs de una subcolección (piezas, motores, etc.). Devuelve cuántos borró.
  async function borrarSubcoleccionCompleta(refColeccion) {
    const snap = await getDocs(refColeccion);
    for (const d of snap.docs) await deleteDoc(d.ref);
    return snap.size;
  }

  // Borra todos los docs de una colección de nivel raíz (reservaciones, ventas, etc.) que
  // pertenezcan a este yonke. Devuelve los docs borrados (no solo el conteo), porque en
  // "usuarios" necesitamos rescatar los emails antes de borrar cada doc.
  async function borrarPorYonkeId(nombreColeccion, yonkeId) {
    const snap = await getDocs(query(collection(db, nombreColeccion), where('yonkeId', '==', yonkeId)));
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    for (const d of snap.docs) await deleteDoc(d.ref);
    return docs;
  }

  // Carga los conteos de todo lo que se va a borrar, SIN borrar nada — para mostrarlos en el
  // primer paso de confirmación. Se vuelve a consultar todo en la ejecución real: son pocos
  // documentos por yonke, no vale la pena complicar el código para compartir el resultado.
  async function cargarResumenBorrado(yonke) {
    const vehiculosSnap = await getDocs(collection(db, 'yonkes', yonke.id, 'vehiculos'));
    let piezas = 0;
    for (const vDoc of vehiculosSnap.docs) {
      const piezasSnap = await getDocs(collection(db, 'yonkes', yonke.id, 'vehiculos', vDoc.id, 'piezas'));
      piezas += piezasSnap.size;
    }
    const [motoresSnap, usuariosSnap, reservacionesSnap, ventasSnap, calificacionesSnap] = await Promise.all([
      getDocs(collection(db, 'yonkes', yonke.id, 'motores')),
      getDocs(query(collection(db, 'usuarios'), where('yonkeId', '==', yonke.id))),
      getDocs(query(collection(db, 'reservaciones'), where('yonkeId', '==', yonke.id))),
      getDocs(query(collection(db, 'ventas'), where('yonkeId', '==', yonke.id))),
      getDocs(query(collection(db, 'calificaciones'), where('yonkeId', '==', yonke.id))),
    ]);
    return {
      vehiculos: vehiculosSnap.size,
      piezas,
      motores: motoresSnap.size,
      usuarios: usuariosSnap.size,
      reservaciones: reservacionesSnap.size,
      ventas: ventasSnap.size,
      calificaciones: calificacionesSnap.size,
    };
  }

  function abrirBorrado(yonke) {
    setYonkeParaBorrar(yonke);
    setResumenBorrado(null);
    setTextoConfirmacionBorrado('');
    setResultadoBorrado(null);
    setPasoBorrado('resumen');
    cargarResumenBorrado(yonke).then(setResumenBorrado).catch((e) => {
      console.error(e);
      alert('No se pudo cargar el resumen del yonke. Intenta de nuevo.');
      setPasoBorrado(null);
    });
  }

  function cerrarBorrado() {
    setPasoBorrado(null);
    setYonkeParaBorrar(null);
    setResumenBorrado(null);
    setTextoConfirmacionBorrado('');
    setResultadoBorrado(null);
  }

  // Ejecuta el borrado en cascada en el ORDEN correcto: piezas antes que vehículos (que las
  // contienen), motores, usuarios/reservaciones/ventas/calificaciones (todo lo que referencia
  // al yonke por yonkeId), el logo en Storage, y al final el propio documento del yonke. Cada
  // paso tiene su propio try/catch — si uno falla, los demás igual se intentan, y al final se
  // reporta exactamente qué se borró y qué no (nunca deja al admin sin saber el estado).
  async function ejecutarBorradoCompleto(yonke) {
    const pasos = [];
    const emailsAuth = [];

    try {
      const vehiculosSnap = await getDocs(collection(db, 'yonkes', yonke.id, 'vehiculos'));
      let totalPiezas = 0;
      for (const vDoc of vehiculosSnap.docs) {
        totalPiezas += await borrarSubcoleccionCompleta(collection(db, 'yonkes', yonke.id, 'vehiculos', vDoc.id, 'piezas'));
        await deleteDoc(vDoc.ref);
      }
      pasos.push({ nombre: 'Vehículos y sus piezas', ok: true, detalle: `${vehiculosSnap.size} vehículo(s), ${totalPiezas} pieza(s)` });
    } catch (e) {
      console.error(e);
      pasos.push({ nombre: 'Vehículos y sus piezas', ok: false, detalle: e.message });
    }

    try {
      const n = await borrarSubcoleccionCompleta(collection(db, 'yonkes', yonke.id, 'motores'));
      pasos.push({ nombre: 'Motores/transmisiones', ok: true, detalle: `${n} registro(s)` });
    } catch (e) {
      console.error(e);
      pasos.push({ nombre: 'Motores/transmisiones', ok: false, detalle: e.message });
    }

    try {
      const docs = await borrarPorYonkeId('usuarios', yonke.id);
      docs.forEach((d) => emailsAuth.push(d.email || d.id));
      pasos.push({ nombre: 'Accesos de usuario (Firestore)', ok: true, detalle: `${docs.length} cuenta(s)` });
    } catch (e) {
      console.error(e);
      pasos.push({ nombre: 'Accesos de usuario (Firestore)', ok: false, detalle: e.message });
    }

    for (const [col, etiqueta] of [['reservaciones', 'Reservaciones'], ['ventas', 'Ventas'], ['calificaciones', 'Calificaciones']]) {
      try {
        const docs = await borrarPorYonkeId(col, yonke.id);
        pasos.push({ nombre: etiqueta, ok: true, detalle: `${docs.length} documento(s)` });
      } catch (e) {
        console.error(e);
        pasos.push({ nombre: etiqueta, ok: false, detalle: e.message });
      }
    }

    try {
      await borrarLogoYonke(yonke.id);
      pasos.push({ nombre: 'Logo (Storage)', ok: true, detalle: '' });
    } catch (e) {
      console.error(e);
      pasos.push({ nombre: 'Logo (Storage)', ok: false, detalle: e.message });
    }

    try {
      await deleteDoc(doc(db, 'yonkes', yonke.id));
      pasos.push({ nombre: 'Documento del yonke', ok: true, detalle: '' });
    } catch (e) {
      console.error(e);
      pasos.push({ nombre: 'Documento del yonke', ok: false, detalle: e.message });
    }

    return { pasos, emailsAuth };
  }

  const confirmacionBorradoValida = yonkeParaBorrar && (
    textoConfirmacionBorrado.trim() === yonkeParaBorrar.nombre
    || textoConfirmacionBorrado.trim() === 'ELIMINAR'
  );

  async function confirmarBorradoDefinitivo() {
    if (!confirmacionBorradoValida) return;
    setPasoBorrado('ejecutando');
    const resultado = await ejecutarBorradoCompleto(yonkeParaBorrar);
    setResultadoBorrado(resultado);
    setPasoBorrado('resultado');
  }

  useEffect(() => {
    const ref = collection(db, 'yonkes');
    const q = query(ref, orderBy('nombre'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setYonkes(lista);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    cargarEstados().then(setEstadosDisponibles);
  }, []);

  async function toggleActivo(yonke) {
    await updateDoc(doc(db, 'yonkes', yonke.id), { activo: !yonke.activo });
  }

  function formatearFechaInput(fecha) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function abrirModalPremium(yonke) {
    const sugerida = new Date();
    sugerida.setDate(sugerida.getDate() + 30);
    setFechaPremium(formatearFechaInput(sugerida));
    setYonkeParaPremium(yonke);
    setModalPremiumVisible(true);
  }

  async function confirmarPremium() {
    if (!fechaPremium) { alert('Selecciona una fecha de vencimiento'); return; }
    await updateDoc(doc(db, 'yonkes', yonkeParaPremium.id), {
      plan: 'premium',
      premiumHasta: Timestamp.fromDate(new Date(`${fechaPremium}T00:00:00`)),
    });
    setModalPremiumVisible(false);
    setYonkeParaPremium(null);
  }

  async function bajarABasico(yonke) {
    if (!confirm(`¿Cambiar a ${yonke.nombre} al plan básico?`)) return;
    await updateDoc(doc(db, 'yonkes', yonke.id), { plan: 'freemium', premiumHasta: deleteField() });
  }

  async function handleLogout() {
    await signOut(auth);
    router.push('/panel');
  }

  const yonkesFiltrados = yonkes.filter(y =>
    (y.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      y.ciudad?.toLowerCase().includes(busqueda.toLowerCase())) &&
    (estadoFiltro === 'todos' || estadoDeYonke(y) === estadoFiltro)
  );

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: '700' }}>Panel Admin</h1>
            <p style={{ color: '#cdd9e4', fontSize: '13px', margin: '4px 0 0' }}>
              {yonkes.length} yonkes · {yonkes.filter(y => y.activo).length} activos · {yonkes.filter(y => y.plan === 'premium').length} premium
            </p>
          </div>

          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
        {/* Herramientas de catálogo */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={regenerarCatalogo}
            disabled={regenerandoCatalogo}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              backgroundColor: '#1A3C5E', color: '#fff', fontWeight: '600',
              fontSize: '13px', cursor: regenerandoCatalogo ? 'wait' : 'pointer',
              opacity: regenerandoCatalogo ? 0.6 : 1,
            }}
          >
            {regenerandoCatalogo ? '⏳ Actualizando...' : '🔄 Actualizar catálogo'}
          </button>
          <button
            onClick={migrarInventario}
            disabled={migrando}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              backgroundColor: '#E8720C', color: '#fff', fontWeight: '600',
              fontSize: '13px', cursor: migrando ? 'wait' : 'pointer',
              opacity: migrando ? 0.6 : 1,
            }}
          >
            {migrando ? '⏳ Migrando...' : '🔧 Migrar inventario (1 vez)'}
          </button>
          <button
            onClick={migrarBusquedas}
            disabled={migrandoBusquedas}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              backgroundColor: '#E8720C', color: '#fff', fontWeight: '600',
              fontSize: '13px', cursor: migrandoBusquedas ? 'wait' : 'pointer',
              opacity: migrandoBusquedas ? 0.6 : 1,
            }}
          >
            {migrandoBusquedas ? '⏳ Migrando...' : '🗂️ Migrar logs de búsqueda (1 vez)'}
          </button>
          <button
            onClick={() => router.push('/admin/busquedas')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              backgroundColor: '#1A3C5E', color: '#fff', fontWeight: '600',
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            📊 Ver búsquedas
          </button>
          <button
            onClick={() => router.push('/admin/captura-domicilio')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              backgroundColor: '#1A3C5E', color: '#fff', fontWeight: '600',
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            🚗 Captura a domicilio
          </button>
          <button
            onClick={() => router.push('/admin/estados')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              backgroundColor: '#1A3C5E', color: '#fff', fontWeight: '600',
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            🗺️ Estados
          </button>
        </div>

        {/* Filtro por estado geográfico — ausente en el yonke cuenta como Baja California,
            ver estadoDeYonke() en lib/estados.js */}
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="todos">Todos los estados</option>
          {estadosDisponibles.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>

        {/* Búsqueda */}
        <input
          type="text"
          placeholder="Buscar yonke por nombre o ciudad..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={inputStyle}
        />

        {/* Botón nuevo yonke */}
        <button
          onClick={() => router.push('/admin/nuevo')}
          style={primaryButtonStyle}
        >
          + Registrar nuevo yonke
        </button>

        {/* Lista de yonkes */}
        {loading ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Cargando...</p>
        ) : yonkesFiltrados.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>No se encontraron yonkes</p>
        ) : (
          yonkesFiltrados.map((y) => (
            <div key={y.id} style={cardStyle}>
              {/* Header de la card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1A3C5E', margin: 0 }}>
                      {y.nombre || 'Sin nombre'}
                    </h2>
                    <span style={{
                      backgroundColor: y.plan === 'premium' ? '#FAEEDA' : '#EEF2F7',
                      color: y.plan === 'premium' ? '#854F0B' : '#1A3C5E',
                      fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px'
                    }}>
                      {y.plan === 'premium' ? '⭐ Premium' : '🆓 Básico'}
                    </span>
                    <span style={{
                      backgroundColor: y.activo ? '#E8F5E9' : '#FDECEA',
                      color: y.activo ? '#2E7D32' : '#C62828',
                      fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px'
                    }}>
                      {y.activo ? '✓ Activo' : '✗ Inactivo'}
                    </span>
                    {y.plan === 'premium' && (() => {
                      const estado = obtenerEstadoPremium(y.premiumHasta);
                      if (!estado) {
                        return (
                          <span style={{
                            backgroundColor: '#F0F0F0', color: '#999',
                            fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px'
                          }}>
                            ⏳ Sin fecha registrada
                          </span>
                        );
                      }
                      return (
                        <span style={{
                          backgroundColor: estado.bg, color: estado.color,
                          fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px'
                        }}>
                          {estado.texto}
                        </span>
                      );
                    })()}
                  </div>
                  <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0' }}>
                    📍 {y.direccion || 'Sin dirección'}
                  </p>
                  {y.ciudad && (
                    <p style={{ color: '#E8720C', fontSize: '12px', fontWeight: '600', margin: '2px 0 0' }}>
                      🏙️ {CIUDADES_BC.find(c => c.key === y.ciudad)?.label || y.ciudad}
                    </p>
                  )}
                  {y.telefono && <p style={{ color: '#666', fontSize: '13px', margin: '2px 0 0' }}>📞 {y.telefono}</p>}
                  {y.whatsapp && <p style={{ color: '#25D366', fontSize: '13px', margin: '2px 0 0', fontWeight: '600' }}>💬 {y.whatsapp}</p>}
                </div>
              </div>

              {/* Acciones */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button onClick={() => router.push(`/admin/yonke/${y.id}`)} style={actionButtonStyle('#1A3C5E')}>
                  ✏️ Editar datos
                </button>
                <button onClick={() => router.push(`/admin/yonke/${y.id}/inventario`)} style={actionButtonStyle('#E8720C')}>
                  🚗 Inventario
                </button>
                <button onClick={() => y.plan === 'premium' ? bajarABasico(y) : abrirModalPremium(y)} style={actionButtonStyle(y.plan === 'premium' ? '#666' : '#2E7D32')}>
                  {y.plan === 'premium' ? '⬇️ Bajar a Básico' : '⬆️ Subir a Premium'}
                </button>
                <button onClick={() => toggleActivo(y)} style={actionButtonStyle(y.activo ? '#C62828' : '#2E7D32')}>
                  {y.activo ? '🔴 Desactivar' : '🟢 Activar'}
                </button>
              </div>
              <button
                onClick={() => abrirBorrado(y)}
                style={{ ...actionButtonStyle('#8B0000'), width: '100%', marginTop: '8px' }}
              >
                🗑️ Eliminar yonke completo
              </button>
            </div>
          ))
        )}
      </div>

      {modalPremiumVisible && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '4px', fontWeight: '700' }}>
              Activar Plan Premium
            </h2>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
              {yonkeParaPremium?.nombre}
            </p>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>Premium vence el</p>
            <input
              type="date"
              value={fechaPremium}
              onChange={(e) => setFechaPremium(e.target.value)}
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => setModalPremiumVisible(false)} style={modalCancelarStyle}>Cancelar</button>
              <button onClick={confirmarPremium} style={modalConfirmarStyle}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {pasoBorrado && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxHeight: '85vh', overflowY: 'auto' }}>

            {pasoBorrado === 'resumen' && (
              <>
                <h2 style={{ color: '#8B0000', fontSize: '18px', marginBottom: '4px', fontWeight: '700' }}>
                  ⚠️ Eliminar "{yonkeParaBorrar?.nombre}"
                </h2>
                <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>
                  Esto borra TODO lo relacionado a este yonke de forma permanente. No se puede deshacer.
                </p>
                {!resumenBorrado ? (
                  <p style={{ textAlign: 'center', color: '#888', padding: '20px 0' }}>Calculando qué se va a borrar...</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', fontSize: '14px', color: '#333' }}>
                    <li style={resumenFilaStyle}>🚗 Vehículos: <strong>{resumenBorrado.vehiculos}</strong></li>
                    <li style={resumenFilaStyle}>🔩 Piezas: <strong>{resumenBorrado.piezas}</strong></li>
                    <li style={resumenFilaStyle}>⚙️ Motores/transmisiones: <strong>{resumenBorrado.motores}</strong></li>
                    <li style={resumenFilaStyle}>👤 Accesos de usuario: <strong>{resumenBorrado.usuarios}</strong></li>
                    <li style={resumenFilaStyle}>📋 Reservaciones: <strong>{resumenBorrado.reservaciones}</strong></li>
                    <li style={resumenFilaStyle}>💰 Ventas: <strong>{resumenBorrado.ventas}</strong></li>
                    <li style={resumenFilaStyle}>⭐ Calificaciones: <strong>{resumenBorrado.calificaciones}</strong></li>
                    <li style={resumenFilaStyle}>🖼️ Logo (si tiene)</li>
                  </ul>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={cerrarBorrado} style={modalCancelarStyle}>Cancelar</button>
                  <button
                    onClick={() => setPasoBorrado('confirmar')}
                    disabled={!resumenBorrado}
                    style={{ ...modalConfirmarStyle, backgroundColor: '#8B0000', opacity: resumenBorrado ? 1 : 0.5 }}
                  >
                    Continuar
                  </button>
                </div>
              </>
            )}

            {pasoBorrado === 'confirmar' && (
              <>
                <h2 style={{ color: '#8B0000', fontSize: '18px', marginBottom: '4px', fontWeight: '700' }}>
                  Confirma la eliminación
                </h2>
                <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>
                  Para evitar borrar el yonke equivocado, escribe el nombre exacto{' '}
                  <strong>"{yonkeParaBorrar?.nombre}"</strong> o la palabra <strong>ELIMINAR</strong>.
                </p>
                <input
                  type="text"
                  value={textoConfirmacionBorrado}
                  onChange={(e) => setTextoConfirmacionBorrado(e.target.value)}
                  placeholder={yonkeParaBorrar?.nombre}
                  style={inputStyle}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button onClick={cerrarBorrado} style={modalCancelarStyle}>Cancelar</button>
                  <button
                    onClick={confirmarBorradoDefinitivo}
                    disabled={!confirmacionBorradoValida}
                    style={{ ...modalConfirmarStyle, backgroundColor: '#8B0000', opacity: confirmacionBorradoValida ? 1 : 0.5, cursor: confirmacionBorradoValida ? 'pointer' : 'not-allowed' }}
                  >
                    Eliminar definitivamente
                  </button>
                </div>
              </>
            )}

            {pasoBorrado === 'ejecutando' && (
              <p style={{ textAlign: 'center', color: '#888', padding: '30px 0' }}>⏳ Eliminando, no cierres esta ventana...</p>
            )}

            {pasoBorrado === 'resultado' && resultadoBorrado && (
              <>
                <h2 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '12px', fontWeight: '700' }}>
                  {resultadoBorrado.pasos.every((p) => p.ok) ? '✅ Yonke eliminado' : '⚠️ Eliminación completada con errores'}
                </h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', fontSize: '13px' }}>
                  {resultadoBorrado.pasos.map((p, i) => (
                    <li key={i} style={{ ...resumenFilaStyle, color: p.ok ? '#2E7D32' : '#C62828' }}>
                      {p.ok ? '✅' : '❌'} {p.nombre}{p.detalle ? ` — ${p.detalle}` : ''}
                    </li>
                  ))}
                </ul>
                {resultadoBorrado.emailsAuth.length > 0 && (
                  <div style={{ backgroundColor: '#FEF3EC', border: '1.5px dashed #E8720C', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: '#7A3C0C', marginBottom: '16px' }}>
                    <strong>Recuerda:</strong> elimina manualmente en la consola de Firebase Authentication el/los usuario(s) de este yonke para evitar cuentas huérfanas:
                    <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                      {resultadoBorrado.emailsAuth.map((email) => <li key={email}>{email}</li>)}
                    </ul>
                  </div>
                )}
                <button onClick={cerrarBorrado} style={{ ...modalConfirmarStyle, width: '100%' }}>Cerrar</button>
              </>
            )}

          </div>
        </div>
      )}
    </main>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1.5px solid #ddd',
  fontSize: '15px', backgroundColor: '#fff', color: '#333', boxSizing: 'border-box',
  marginBottom: '12px', fontFamily: "'Inter', sans-serif",
};
const primaryButtonStyle = {
  width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
  backgroundColor: '#E8720C', color: '#fff', fontWeight: '700', fontSize: '15px',
  cursor: 'pointer', marginBottom: '20px', fontFamily: "'Inter', sans-serif",
};
const cardStyle = {
  backgroundColor: '#fff', borderRadius: '16px', padding: '16px', marginBottom: '14px',
  boxShadow: '0 4px 16px rgba(26,60,94,0.08)',
};
const actionButtonStyle = (color) => ({
  padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: color,
  color: '#fff', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
});
const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000,
};
const modalStyle = {
  backgroundColor: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '380px', width: '100%',
  fontFamily: "'Inter', sans-serif",
};
const modalCancelarStyle = {
  flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#F4F5F5',
  color: '#888', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
};
const modalConfirmarStyle = {
  flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#E8720C',
  color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
};
const resumenFilaStyle = {
  padding: '6px 0', borderBottom: '1px solid #F4F5F5',
};