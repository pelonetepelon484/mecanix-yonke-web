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
          <button
            onClick={() => router.push('/admin/resenas')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              backgroundColor: '#1A3C5E', color: '#fff', fontWeight: '600',
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            ⭐ Reseñas de Mecanix
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
                  ⚠️ Eliminar &quot;{yonkeParaBorrar?.nombre}&quot;
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
                  <strong>&quot;{yonkeParaBorrar?.nombre}&quot;</strong> o la palabra <strong>ELIMINAR</strong>.
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