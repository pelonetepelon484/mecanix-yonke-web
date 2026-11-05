'use client';

// Asistencia vial (etapa 1): alta, edición, activar/desactivar y borrado de proveedores (grúas,
// llanteras, ayuda en carretera). Solo el admin da de alta; no hay registro abierto. "Documentos en
// regla" con su fecha de revisión: con más de 12 meses sale "Por renovar" y el sello público deja de
// verse solo (ver src/lib/asistenciaVial.js). Lo privado (notas, documentos revisados, contacto del
// dueño) va en asistenciaVial/{id}/privado/datos, que el público no puede leer.
// Logo: mismo subidor que los yonkes (subirLogoYonke), en logos/asistencia-{id}.png.
// Costo: 1 lectura por proveedor al abrir; los toques y lo privado se leen solo al pedirlos.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { borrarLogoYonke, subirLogoYonke } from '../../lib/subirLogoYonke';
import { fechaParaCampo } from '../talleres/planTaller';
import {
  CIUDADES_ASISTENCIA, COLECCION_ASISTENCIA, TIPOS_GRUA, TIPOS_SERVICIO, estadoDocumentos, etiquetaCiudad, etiquetaServicio,
  mesAnio, proveedorParaPagina, validarProveedor, venceRevisionMs,
} from '../../../lib/asistenciaVial';

const idLogo = (id) => `asistencia-${id}`;
const VACIO = {
  nombre: '', servicios: [], tiposGrua: [], ciudades: [], atiende24h: false, horario: '', telefono: '', whatsapp: '',
  descripcion: '', logoUrl: '', activo: true, documentosEnRegla: false, fechaRevision: '',
  notasInternas: '', documentosRevisados: '', contactoDueno: '',
};
const ETIQUETA_DOCUMENTOS = {
  en_regla: { texto: 'Documentos en regla', fondo: '#E3EAF2', color: '#1A3C5E' },
  por_renovar: { texto: '⚠️ Por renovar (más de 12 meses)', fondo: '#FDECEA', color: '#B3261E' },
  sin_revisar: { texto: 'Documentos sin revisar', fondo: '#F4F5F5', color: '#555' },
};

function alternar(lista, key) {
  return lista.includes(key) ? lista.filter((k) => k !== key) : [...lista, key];
}

function Casillas({ opciones, elegidas, onCambiar, nombre }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
      {opciones.map((o) => (
        <label key={o.key} style={casillaChica}>
          <input type="checkbox" name={nombre} checked={elegidas.includes(o.key)} onChange={() => onCambiar(alternar(elegidas, o.key))} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function FormProveedor({ inicial, id, onListo, onCancelar }) {
  const [f, setF] = useState(inicial);
  const [archivoLogo, setArchivoLogo] = useState(null);
  const [quitarLogo, setQuitarLogo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const cambiar = (campo) => (valor) => setF((x) => ({ ...x, [campo]: valor }));
  const tieneGrua = f.servicios.includes('grua');

  async function guardar() {
    setError('');
    const datosValidar = { ...f, nombre: f.nombre.trim(), telefono: f.telefono.replace(/\D/g, ''), whatsapp: f.whatsapp.replace(/\D/g, '') };
    const problema = validarProveedor(datosValidar);
    if (problema) { setError(problema); return; }
    setGuardando(true);
    try {
      const ref = id ? doc(db, COLECCION_ASISTENCIA, id) : doc(collection(db, COLECCION_ASISTENCIA));
      let logoUrl = f.logoUrl;
      if (quitarLogo && logoUrl) { await borrarLogoYonke(idLogo(ref.id)); logoUrl = ''; }
      if (archivoLogo) logoUrl = await subirLogoYonke(idLogo(ref.id), archivoLogo);
      const publicos = {
        nombre: datosValidar.nombre,
        servicios: f.servicios,
        tiposGrua: tieneGrua ? f.tiposGrua : [],
        ciudades: f.ciudades,
        atiende24h: f.atiende24h,
        horario: f.atiende24h ? '' : f.horario.trim(),
        telefono: datosValidar.telefono,
        whatsapp: datosValidar.whatsapp,
        descripcion: f.descripcion.trim(),
        logoUrl,
        activo: f.activo,
        documentosEnRegla: f.documentosEnRegla,
        fechaRevisionDocumentos: f.documentosEnRegla && f.fechaRevision ? Timestamp.fromDate(new Date(`${f.fechaRevision}T12:00:00`)) : null,
        actualizadoAt: serverTimestamp(),
      };
      if (id) await setDoc(ref, publicos, { merge: true });
      else await setDoc(ref, { ...publicos, creadoAt: serverTimestamp() });
      await setDoc(doc(db, COLECCION_ASISTENCIA, ref.id, 'privado', 'datos'), {
        notasInternas: f.notasInternas.trim(), documentosRevisados: f.documentosRevisados.trim(), contactoDueno: f.contactoDueno.trim(),
      });
      onListo();
    } catch (err) {
      console.error('[admin/asistencia-vial] No se pudo guardar', err);
      setError(err?.message?.includes('Formato') || err?.message?.includes('2MB') ? err.message : 'No se pudo guardar. Revisa tu conexión y tus permisos de admin.');
      setGuardando(false);
    }
  }

  return (
    <div style={tarjeta}>
      <h2 style={{ fontSize: '17px', color: '#1A3C5E', margin: '0 0 8px' }}>{id ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
      <label style={etiqueta} htmlFor="av-nombre">Nombre del negocio</label>
      <input id="av-nombre" value={f.nombre} maxLength={100} onChange={(e) => cambiar('nombre')(e.target.value)} style={campo} />

      <p style={etiqueta}>Tipos de servicio</p>
      <Casillas nombre="servicios" opciones={TIPOS_SERVICIO} elegidas={f.servicios} onCambiar={cambiar('servicios')} />
      {tieneGrua && (
        <>
          <p style={etiqueta}>Tipo de grúa (opcional)</p>
          <Casillas nombre="tiposGrua" opciones={TIPOS_GRUA} elegidas={f.tiposGrua} onCambiar={cambiar('tiposGrua')} />
        </>
      )}

      <p style={etiqueta}>Ciudades que atiende</p>
      <Casillas nombre="ciudades" opciones={CIUDADES_ASISTENCIA} elegidas={f.ciudades} onCambiar={cambiar('ciudades')} />

      <label style={casilla}>
        <input type="checkbox" checked={f.atiende24h} onChange={(e) => cambiar('atiende24h')(e.target.checked)} />
        Atiende 24 horas
      </label>
      {!f.atiende24h && (
        <>
          <label style={etiqueta} htmlFor="av-horario">Horario</label>
          <input id="av-horario" value={f.horario} maxLength={150} placeholder="Ej. Lunes a sábado de 8 a 20 h" onChange={(e) => cambiar('horario')(e.target.value)} style={campo} />
        </>
      )}

      <label style={etiqueta} htmlFor="av-telefono">Teléfono (10 dígitos)</label>
      <input id="av-telefono" type="tel" inputMode="tel" value={f.telefono} onChange={(e) => cambiar('telefono')(e.target.value)} style={campo} />
      <label style={etiqueta} htmlFor="av-whatsapp">WhatsApp (10 dígitos, opcional)</label>
      <input id="av-whatsapp" type="tel" inputMode="tel" value={f.whatsapp} onChange={(e) => cambiar('whatsapp')(e.target.value)} style={campo} />
      <label style={etiqueta} htmlFor="av-descripcion">Descripción corta (máx. 300)</label>
      <textarea id="av-descripcion" value={f.descripcion} maxLength={300} rows={3} onChange={(e) => cambiar('descripcion')(e.target.value)} style={campo} />

      <label style={etiqueta} htmlFor="av-logo">Logo (opcional)</label>
      {f.logoUrl && !quitarLogo && <img src={f.logoUrl} alt="" style={{ width: '64px', height: '64px', objectFit: 'contain', display: 'block', marginBottom: '6px' }} />}
      <input id="av-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setArchivoLogo(e.target.files?.[0] || null)} style={{ marginBottom: '6px' }} />
      {f.logoUrl && (
        <label style={casillaChica}>
          <input type="checkbox" checked={quitarLogo} onChange={(e) => setQuitarLogo(e.target.checked)} /> Quitar el logo actual
        </label>
      )}

      <label style={casilla}>
        <input type="checkbox" checked={f.activo} onChange={(e) => cambiar('activo')(e.target.checked)} />
        Activo (se ve en la página pública)
      </label>

      <div style={{ ...tarjeta, backgroundColor: '#F5F8FB', boxShadow: 'none', marginTop: '12px' }}>
        <label style={{ ...casilla, marginTop: 0 }}>
          <input type="checkbox" checked={f.documentosEnRegla} onChange={(e) => cambiar('documentosEnRegla')(e.target.checked)} />
          Documentos en regla (yo los revisé)
        </label>
        {f.documentosEnRegla && (
          <>
            <label style={etiqueta} htmlFor="av-fecha">Fecha de revisión</label>
            <input id="av-fecha" type="date" value={f.fechaRevision} onChange={(e) => cambiar('fechaRevision')(e.target.value)} style={campo} />
          </>
        )}
        <p style={{ fontSize: '12px', color: '#666', margin: '6px 0 0' }}>Solo privado (el público nunca lo ve):</p>
        <label style={etiqueta} htmlFor="av-docs">Qué documentos revisé</label>
        <textarea id="av-docs" value={f.documentosRevisados} maxLength={2000} rows={2} onChange={(e) => cambiar('documentosRevisados')(e.target.value)} style={campo} />
        <label style={etiqueta} htmlFor="av-contacto">Contacto del dueño</label>
        <input id="av-contacto" value={f.contactoDueno} maxLength={300} onChange={(e) => cambiar('contactoDueno')(e.target.value)} style={campo} />
        <label style={etiqueta} htmlFor="av-notas">Notas internas</label>
        <textarea id="av-notas" value={f.notasInternas} maxLength={2000} rows={3} onChange={(e) => cambiar('notasInternas')(e.target.value)} style={campo} />
      </div>

      {error && <p role="alert" style={{ color: '#B3261E', fontSize: '13px' }}>{error}</p>}
      <button type="button" onClick={guardar} disabled={guardando} style={botonGuardar}>{guardando ? 'Guardando...' : 'Guardar'}</button>
      <button type="button" onClick={onCancelar} disabled={guardando} style={{ ...volver, display: 'block', margin: '10px auto 0' }}>Cancelar</button>
    </div>
  );
}

function FilaProveedor({ p, onEditar, onCambio }) {
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [toques, setToques] = useState(null);
  const estado = estadoDocumentos(p);
  const etiquetaDocs = ETIQUETA_DOCUMENTOS[estado];

  async function cambiarActivo() {
    setTrabajando(true);
    try {
      await updateDoc(doc(db, COLECCION_ASISTENCIA, p.id), { activo: !p.activo, actualizadoAt: serverTimestamp() });
      onCambio();
    } catch (err) {
      console.error('[admin/asistencia-vial] activar/desactivar', err);
      setMensaje('No se pudo cambiar. Revisa tu conexión.');
      setTrabajando(false);
    }
  }

  async function borrar() {
    if (!window.confirm(`¿Borrar "${p.nombre}" para siempre? También se borran sus notas privadas y su contador.`)) return;
    setTrabajando(true);
    try {
      const contactos = await getDocs(collection(db, COLECCION_ASISTENCIA, p.id, 'contactos'));
      await Promise.all(contactos.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, COLECCION_ASISTENCIA, p.id, 'privado', 'datos'));
      if (p.logoUrl) await borrarLogoYonke(idLogo(p.id));
      await deleteDoc(doc(db, COLECCION_ASISTENCIA, p.id));
      onCambio();
    } catch (err) {
      console.error('[admin/asistencia-vial] borrar', err);
      setMensaje('No se pudo borrar. Revisa tu conexión.');
      setTrabajando(false);
    }
  }

  async function verToques() {
    try {
      const snap = await getDocs(collection(db, COLECCION_ASISTENCIA, p.id, 'contactos'));
      setToques(snap.docs.map((d) => ({ mes: d.id, llamadas: d.data().llamadas || 0, whatsapp: d.data().whatsapp || 0 })).sort((a, b) => b.mes.localeCompare(a.mes)));
    } catch (err) {
      console.error('[admin/asistencia-vial] toques', err);
      setMensaje('No se pudieron leer los toques.');
    }
  }

  return (
    <div style={{ ...tarjeta, opacity: p.activo ? 1 : 0.7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
        <p style={{ margin: 0, fontWeight: '700', color: '#1A3C5E', fontSize: '15px' }}>{p.nombre}</p>
        <span style={{ ...pastilla, backgroundColor: p.activo ? '#E8F5E9' : '#F4F5F5', color: p.activo ? '#2E7D32' : '#555' }}>{p.activo ? 'Activo' : 'Inactivo'}</span>
      </div>
      <p style={linea}>{p.servicios.map(etiquetaServicio).join(' · ')}</p>
      <p style={linea}>📍 {p.ciudades.map(etiquetaCiudad).join(', ')} · {p.atiende24h ? '24 horas' : p.horario}</p>
      <p style={linea}>📞 {p.telefono}{p.whatsapp ? ` · WhatsApp ${p.whatsapp}` : ''}</p>
      <span style={{ ...pastilla, display: 'inline-block', marginTop: '6px', backgroundColor: etiquetaDocs.fondo, color: etiquetaDocs.color }}>
        {etiquetaDocs.texto}
        {p.fechaRevisionMs ? ` · revisado en ${mesAnio(p.fechaRevisionMs)}` : ''}
        {estado === 'en_regla' ? ` · vence en ${mesAnio(venceRevisionMs(p.fechaRevisionMs))}` : ''}
      </span>
      {toques && (
        <div style={{ marginTop: '8px', fontSize: '13px', color: '#1A3C5E' }}>
          {toques.length === 0 ? 'Todavía sin toques.' : toques.map((t) => <p key={t.mes} style={{ margin: '2px 0' }}>{t.mes}: 📞 {t.llamadas} llamadas · 💬 {t.whatsapp} WhatsApp</p>)}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
        <button type="button" disabled={trabajando} onClick={onEditar} style={botonSecundario}>Editar</button>
        <button type="button" disabled={trabajando} onClick={cambiarActivo} style={botonSecundario}>{p.activo ? 'Desactivar' : 'Activar'}</button>
        <button type="button" disabled={trabajando} onClick={verToques} style={botonSecundario}>Ver toques</button>
        <button type="button" disabled={trabajando} onClick={borrar} style={{ ...botonSecundario, borderColor: '#B3261E', color: '#B3261E' }}>Borrar</button>
      </div>
      {mensaje && <p role="status" style={{ margin: '8px 0 0', fontSize: '13px', color: '#B3261E' }}>{mensaje}</p>}
    </div>
  );
}

export default function AdminAsistenciaVialPage() {
  const router = useRouter();
  const [proveedores, setProveedores] = useState(null);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  // null: lista; { id: null }: nuevo; { id, inicial }: edición.
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    let cancelado = false;
    getDocs(collection(db, COLECCION_ASISTENCIA))
      .then((snap) => {
        if (cancelado) return;
        const lista = snap.docs.map((d) => ({ ...proveedorParaPagina(d.id, d.data()), fechaRevisionDocumentos: d.data().fechaRevisionDocumentos }));
        lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        setProveedores(lista);
      })
      .catch((err) => {
        console.error('[admin/asistencia-vial] No se pudieron cargar', err);
        if (!cancelado) setError('No se pudieron cargar los proveedores.');
      });
    return () => { cancelado = true; };
  }, [recarga]);

  async function editar(p) {
    let privado = {};
    try {
      const snap = await getDoc(doc(db, COLECCION_ASISTENCIA, p.id, 'privado', 'datos'));
      privado = snap.exists() ? snap.data() : {};
    } catch (err) {
      console.error('[admin/asistencia-vial] privado', err);
    }
    setEditando({
      id: p.id,
      inicial: {
        ...VACIO, ...p, fechaRevision: fechaParaCampo(p.fechaRevisionDocumentos),
        notasInternas: privado.notasInternas || '', documentosRevisados: privado.documentosRevisados || '', contactoDueno: privado.contactoDueno || '',
      },
    });
  }

  const listo = () => { setEditando(null); setRecarga((n) => n + 1); };
  const porRenovar = (proveedores || []).filter((p) => estadoDocumentos(p) === 'por_renovar');

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', padding: '24px 16px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <button type="button" onClick={() => router.push('/admin')} style={volver}>← Volver al admin</button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '8px 0 4px' }}>Asistencia vial</h1>
        <p style={{ fontSize: '13px', color: '#666', margin: '0 0 16px' }}>
          Grúas, llanteras y ayuda en carretera. Solo tú das de alta. La página pública /asistencia-vial se ve con config/portada.asistenciaVialActiva encendida.
        </p>
        {editando ? (
          <FormProveedor key={editando.id || 'nuevo'} id={editando.id} inicial={editando.inicial || VACIO} onListo={listo} onCancelar={() => setEditando(null)} />
        ) : (
          <>
            <button type="button" onClick={() => setEditando({ id: null })} style={{ ...botonGuardar, marginBottom: '12px' }}>＋ Agregar proveedor</button>
            {porRenovar.length > 0 && (
              <p role="status" style={{ ...tarjeta, backgroundColor: '#FDECEA', color: '#B3261E', fontSize: '14px', fontWeight: '700' }}>
                ⚠️ {porRenovar.length === 1 ? '1 proveedor tiene' : `${porRenovar.length} proveedores tienen`} los documentos por renovar (más de 12 meses). Su sello ya no se muestra.
              </p>
            )}
            {error && <p role="alert" style={{ color: '#C62828' }}>{error}</p>}
            {!error && proveedores === null && <p style={{ color: '#666' }}>Cargando...</p>}
            {proveedores && proveedores.length === 0 && <p style={{ color: '#666' }}>Todavía no hay proveedores.</p>}
            {proveedores && proveedores.map((p) => (
              <FilaProveedor key={`${p.id}-${p.activo}`} p={p} onEditar={() => editar(p)} onCambio={() => setRecarga((n) => n + 1)} />
            ))}
          </>
        )}
      </div>
    </main>
  );
}

// Mismos estilos que admin/refaccionarias.
const tarjeta = { backgroundColor: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(26,60,94,0.06)' };
const casilla = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#1A3C5E', fontWeight: '600', marginTop: '10px', cursor: 'pointer' };
const casillaChica = { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1A3C5E', cursor: 'pointer' };
const etiqueta = { display: 'block', fontSize: '13px', color: '#555', margin: '12px 0 4px' };
const campo = { display: 'block', width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '15px', fontFamily: 'inherit' };
const botonSecundario = { background: 'none', border: '1px solid #1A3C5E', borderRadius: '10px', color: '#1A3C5E', fontWeight: '600', fontSize: '13px', padding: '8px 12px', cursor: 'pointer' };
const botonGuardar = { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontWeight: '700', fontSize: '15px', cursor: 'pointer', marginTop: '12px' };
const volver = { background: 'none', border: 'none', color: '#1A3C5E', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '14px' };
const pastilla = { fontSize: '12px', fontWeight: '700', padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap' };
const linea = { margin: '4px 0 0', fontSize: '13px', color: '#555' };
