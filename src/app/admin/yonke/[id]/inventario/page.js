'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  collection, addDoc, query, onSnapshot, deleteDoc, doc,
  orderBy, writeBatch, updateDoc, getDoc
} from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import SelectorMarcaModelo, { registrarEnCatalogo } from '../../lib/SelectorMarcaModelo';

const PIEZAS_COMUNES = [
  'Faro delantero izquierdo', 'Faro delantero derecho', 'Calavera trasera izquierda', 'Calavera trasera derecha',
  'Cofre', 'Cajuela', 'Parachoques delantero', 'Parachoques trasero', 'Espejo izquierdo', 'Espejo derecho',
  'Puerta delantera izquierda', 'Puerta delantera derecha', 'Puerta trasera izquierda', 'Puerta trasera derecha',
  'Parabrisas', 'Rines', 'Tablero', 'Asientos', 'Orquilla derecha', 'Orquilla izquierda',
  'Disco de freno delantero', 'Disco de freno trasero', 'Prensa de freno', 'Amortiguador delantero izquierdo',
  'Amortiguador delantero derecho', 'Resortes delanteros', 'Resortes traseros', 'Amortiguador trasero derecho',
  'Amortiguador trasero izquierdo', 'Compresor A/C', 'Alternador', 'Computadora de motor',
  'Computadora de transmisión', 'Caja de fusibles', 'Cremallera', 'Bomba de dirección', 'Barra estabilizadora',
  'Múltiple de admisión', 'Múltiple de escape', 'Garganta', 'Filtro de aire', 'Manguera de aire', 'Sensor MAF',
  'Flecha delantera izquierda', 'Flecha delantera derecha', 'Motor', 'Transmisión',
];

async function crearPiezasComunes(vehiculoRef) {
  const batch = writeBatch(db);
  const piezasRef = collection(vehiculoRef, 'piezas');
  PIEZAS_COMUNES.forEach((nombre) => {
    const piezaDocRef = doc(piezasRef);
    batch.set(piezaDocRef, { nombre, disponible: true });
  });
  await batch.commit();
}

export default function InventarioAdminPage() {
  const router = useRouter();
  const { id } = useParams();

  const [nombreYonke, setNombreYonke] = useState('');
  const [vehiculos, setVehiculos] = useState([]);
  const [motores, setMotores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal vehículo
  const [modalVisible, setModalVisible] = useState(false);
  const [vehiculoEditando, setVehiculoEditando] = useState(null);
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');
  const [transmision, setTransmision] = useState('Manual');
  const [traccion, setTraccion] = useState('Sencillo');
  const [cilindrada, setCilindrada] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Modal motor
  const [motorModalVisible, setMotorModalVisible] = useState(false);
  const [motorEditando, setMotorEditando] = useState(null);
  const [motorTipo, setMotorTipo] = useState('Motor');
  const [motorMarca, setMotorMarca] = useState('');
  const [motorModelo, setMotorModelo] = useState('');
  const [motorAno, setMotorAno] = useState('');
  const [motorCilindrada, setMotorCilindrada] = useState('');
  const [guardandoMotor, setGuardandoMotor] = useState(false);

  // Modal piezas
  const [piezasModalVisible, setPiezasModalVisible] = useState(false);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
  const [piezas, setPiezas] = useState([]);
  const [loadingPiezas, setLoadingPiezas] = useState(false);

  useEffect(() => {
    async function cargarNombre() {
      const snap = await getDoc(doc(db, 'yonkes', id));
      if (snap.exists()) setNombreYonke(snap.data().nombre || '');
    }
    cargarNombre();

    const vehiculosRef = collection(db, 'yonkes', id, 'vehiculos');
    const qv = query(vehiculosRef, orderBy('fechaIngreso', 'desc'));
    const unsubV = onSnapshot(qv, (snapshot) => {
      setVehiculos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const motoresRef = collection(db, 'yonkes', id, 'motores');
    const qm = query(motoresRef, orderBy('fechaIngreso', 'desc'));
    const unsubM = onSnapshot(qm, (snapshot) => {
      setMotores(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubV(); unsubM(); };
  }, [id]);

  function abrirModalAgregar() {
    setVehiculoEditando(null);
    setMarca(''); setModelo(''); setAno('');
    setTransmision('Manual'); setTraccion('Sencillo'); setCilindrada('');
    setModalVisible(true);
  }

  function abrirModalEditar(v) {
    setVehiculoEditando(v);
    setMarca(v.marca || ''); setModelo(v.modelo || '');
    setAno(String(v.ano || '')); setTransmision(v.transmision || 'Manual');
    setTraccion(v.traccion || 'Sencillo'); setCilindrada(v.cilindrada || '');
    setModalVisible(true);
  }

  function abrirModalMotor() {
    setMotorEditando(null);
    setMotorTipo('Motor'); setMotorMarca(''); setMotorModelo('');
    setMotorAno(''); setMotorCilindrada('');
    setMotorModalVisible(true);
  }

  async function guardarVehiculo() {
    if (!marca || !modelo || !ano) { alert('Llena marca, modelo y año'); return; }
    setGuardando(true);
    try {
      if (vehiculoEditando) {
        await updateDoc(doc(db, 'yonkes', id, 'vehiculos', vehiculoEditando.id), {
          marca: marca.trim(), modelo: modelo.trim(), ano: parseInt(ano),
          transmision, traccion, cilindrada: cilindrada.trim() || null,
        });
      } else {
        const vehiculoRef = await addDoc(collection(db, 'yonkes', id, 'vehiculos'), {
          marca: marca.trim(), modelo: modelo.trim(), ano: parseInt(ano),
          transmision, traccion, cilindrada: cilindrada.trim() || null,
          disponible: true, fechaIngreso: new Date(),
        });
        await crearPiezasComunes(vehiculoRef);
      }
      setModalVisible(false);
    } catch (error) {
      console.error(error); alert('No se pudo guardar');
    } finally { setGuardando(false); }
  }

  async function guardarMotor() {
    if (!motorMarca || !motorModelo || !motorAno) { alert('Llena marca, modelo y año'); return; }
    setGuardandoMotor(true);
    try {
      if (motorEditando) {
        await updateDoc(doc(db, 'yonkes', id, 'motores', motorEditando.id), {
          tipo: motorTipo, marca: motorMarca.trim(), modelo: motorModelo.trim(),
          ano: parseInt(motorAno), cilindrada: motorCilindrada.trim() || null,
        });
      } else {
        await addDoc(collection(db, 'yonkes', id, 'motores'), {
          tipo: motorTipo, marca: motorMarca.trim(), modelo: motorModelo.trim(),
          ano: parseInt(motorAno), cilindrada: motorCilindrada.trim() || null,
          disponible: true, fechaIngreso: new Date(),
        });
      }
      setMotorModalVisible(false);
    } catch (error) {
      console.error(error); alert('No se pudo guardar');
    } finally { setGuardandoMotor(false); }
  }

  async function eliminarVehiculo(vehiculoId) {
    if (!confirm('¿Eliminar este vehículo?')) return;
    await deleteDoc(doc(db, 'yonkes', id, 'vehiculos', vehiculoId));
  }

  async function eliminarMotor(motorId) {
    if (!confirm('¿Eliminar este motor/transmisión?')) return;
    await deleteDoc(doc(db, 'yonkes', id, 'motores', motorId));
  }

  function abrirPiezas(vehiculo) {
    setVehiculoSeleccionado(vehiculo);
    setPiezasModalVisible(true);
    setLoadingPiezas(true);
    const piezasRef = collection(db, 'yonkes', id, 'vehiculos', vehiculo.id, 'piezas');
    const unsubscribe = onSnapshot(piezasRef, (snapshot) => {
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.nombre.localeCompare(b.nombre));
      setPiezas(lista); setLoadingPiezas(false);
    });
    setVehiculoSeleccionado({ ...vehiculo, _unsubscribe: unsubscribe });
  }

  function cerrarPiezas() {
    if (vehiculoSeleccionado?._unsubscribe) vehiculoSeleccionado._unsubscribe();
    setPiezasModalVisible(false); setVehiculoSeleccionado(null); setPiezas([]);
  }

  async function togglePieza(piezaId, disponibleActual) {
    const piezaRef = doc(db, 'yonkes', id, 'vehiculos', vehiculoSeleccionado.id, 'piezas', piezaId);
    await updateDoc(piezaRef, { disponible: !disponibleActual });
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', fontFamily: "'Inter', sans-serif", paddingBottom: '40px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>
              ← Volver
            </button>
            <h1 style={{ color: '#fff', fontSize: '18px', margin: '4px 0 0', fontWeight: '700' }}>{nombreYonke}</h1>
            <p style={{ color: '#cdd9e4', fontSize: '13px', margin: '2px 0 0' }}>
              {vehiculos.length} vehículos · {motores.filter(m => m.tipo === 'Motor').length} motores · {motores.filter(m => m.tipo === 'Transmisión').length} transmisiones
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <button onClick={abrirModalAgregar} style={{ ...primaryButtonStyle, flex: 1 }}>
            🚗 Agregar vehículo
          </button>
          <button onClick={abrirModalMotor} style={{ ...primaryButtonStyle, flex: 1, backgroundColor: '#1A3C5E' }}>
            🔧 Motor / Transmisión
          </button>
        </div>

        {/* Vehículos */}
        {vehiculos.length > 0 && (
          <>
            <p style={seccionTituloStyle}>🚗 Vehículos ({vehiculos.length})</p>
            {vehiculos.map((v, index) => (
              <div key={v.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div onClick={() => abrirPiezas(v)} style={{ flex: 1, cursor: 'pointer' }}>
                    <p style={{ fontWeight: '700', color: '#1A3C5E', fontSize: '15px', margin: 0 }}>
                      {index + 1}. {v.marca} {v.modelo} {v.ano}
                    </p>
                    <p style={{ color: '#888', fontSize: '13px', margin: '2px 0 0' }}>
                      {v.transmision} · {v.traccion}{v.cilindrada ? ` · ${v.cilindrada}` : ''}
                    </p>
                    <p style={{ color: '#E8720C', fontSize: '12px', fontWeight: '600', marginTop: '4px' }}>
                      Ver / editar piezas →
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => abrirModalEditar(v)} style={smallButtonStyle('#1A3C5E')}>Editar</button>
                    <button onClick={() => eliminarVehiculo(v.id)} style={smallButtonStyle('#D85A30')}>Eliminar</button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Motores */}
        {motores.length > 0 && (
          <>
            <p style={{ ...seccionTituloStyle, marginTop: '20px' }}>🔧 Motores y transmisiones ({motores.length})</p>
            {motores.map((m) => (
              <div key={m.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ backgroundColor: m.tipo === 'Motor' ? '#E8720C' : '#1A3C5E', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '12px' }}>
                      {m.tipo === 'Motor' ? '🔧 Motor' : '⚙️ Transmisión'}
                    </span>
                    <p style={{ fontWeight: '700', color: '#1A3C5E', fontSize: '15px', margin: '6px 0 0' }}>
                      {m.marca} {m.modelo} {m.ano}
                    </p>
                    {m.cilindrada && <p style={{ color: '#888', fontSize: '13px', margin: '2px 0 0' }}>{m.cilindrada}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => eliminarMotor(m.id)} style={smallButtonStyle('#D85A30')}>Eliminar</button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {!loading && vehiculos.length === 0 && motores.length === 0 && (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Este yonke no tiene inventario todavía</p>
        )}
      </div>

      {/* Modal vehículo */}
      {modalVisible && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '16px' }}>
              {vehiculoEditando ? 'Editar vehículo' : 'Agregar vehículo'}
            </h2>
            <input type="text" placeholder="Marca" value={marca} onChange={(e) => setMarca(e.target.value)} style={inputStyle} />
            <input type="text" placeholder="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Año" value={ano} onChange={(e) => setAno(e.target.value)} style={inputStyle} />
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#1A3C5E', marginBottom: '6px' }}>Transmisión</p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              {['Manual', 'Automática'].map(opt => (
                <button key={opt} onClick={() => setTransmision(opt)} style={transmision === opt ? selectorActiveStyle : selectorStyle}>{opt}</button>
              ))}
            </div>
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#1A3C5E', marginBottom: '6px' }}>Tracción</p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              {['Sencillo', '4x4'].map(opt => (
                <button key={opt} onClick={() => setTraccion(opt)} style={traccion === opt ? selectorActiveStyle : selectorStyle}>{opt}</button>
              ))}
            </div>
            <input type="text" placeholder="Cilindrada (ej. 2.0L)" value={cilindrada} onChange={(e) => setCilindrada(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setModalVisible(false)} style={cancelButtonStyle}>Cancelar</button>
              <button onClick={guardarVehiculo} disabled={guardando} style={confirmButtonStyle}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal motor */}
      {motorModalVisible && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '16px' }}>
              {motorEditando ? 'Editar' : 'Agregar motor o transmisión'}
            </h2>
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#1A3C5E', marginBottom: '6px' }}>Tipo</p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              {['Motor', 'Transmisión'].map(opt => (
                <button key={opt} onClick={() => setMotorTipo(opt)} style={motorTipo === opt ? selectorActiveStyle : selectorStyle}>
                  {opt === 'Motor' ? '🔧 Motor' : '⚙️ Transmisión'}
                </button>
              ))}
            </div>
            <input type="text" placeholder="Marca" value={motorMarca} onChange={(e) => setMotorMarca(e.target.value)} style={inputStyle} />
            <input type="text" placeholder="Modelo" value={motorModelo} onChange={(e) => setMotorModelo(e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Año" value={motorAno} onChange={(e) => setMotorAno(e.target.value)} style={inputStyle} />
            <input type="text" placeholder="Cilindrada (ej. 1.8L)" value={motorCilindrada} onChange={(e) => setMotorCilindrada(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setMotorModalVisible(false)} style={cancelButtonStyle}>Cancelar</button>
              <button onClick={guardarMotor} disabled={guardandoMotor} style={confirmButtonStyle}>
                {guardandoMotor ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal piezas */}
      {piezasModalVisible && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxHeight: '85vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '4px' }}>
              {vehiculoSeleccionado?.marca} {vehiculoSeleccionado?.modelo}
            </h2>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>Activa o desactiva piezas</p>
            {loadingPiezas ? (
              <p style={{ textAlign: 'center', color: '#888' }}>Cargando...</p>
            ) : (
              piezas.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F4F5F5' }}>
                  <span style={{ color: p.disponible ? '#333' : '#bbb', textDecoration: p.disponible ? 'none' : 'line-through', fontSize: '15px' }}>
                    {p.nombre}
                  </span>
                  <input type="checkbox" checked={!!p.disponible} onChange={() => togglePieza(p.id, p.disponible)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#E8720C' }} />
                </div>
              ))
            )}
            <button onClick={cerrarPiezas} style={{ ...confirmButtonStyle, marginTop: '16px', backgroundColor: '#1A3C5E' }}>
              Listo
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

const primaryButtonStyle = { padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: "'Inter', sans-serif" };
const cardStyle = { backgroundColor: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(26,60,94,0.06)' };
const seccionTituloStyle = { fontSize: '13px', fontWeight: '700', color: '#888', letterSpacing: '1px', marginBottom: '10px' };
const smallButtonStyle = (color) => ({ background: 'none', border: 'none', color, fontSize: '13px', fontWeight: '700', cursor: 'pointer', padding: '4px 8px' });
const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 };
const modalStyle = { backgroundColor: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px', fontSize: '15px', backgroundColor: '#F8F9FA', color: '#333', boxSizing: 'border-box' };
const selectorStyle = { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#F4F5F5', color: '#888', fontWeight: '600', cursor: 'pointer', fontSize: '14px' };
const selectorActiveStyle = { ...selectorStyle, backgroundColor: '#1A3C5E', borderColor: '#1A3C5E', color: '#fff' };
const cancelButtonStyle = { flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#F4F5F5', color: '#888', fontWeight: '700', fontSize: '15px', cursor: 'pointer' };
const confirmButtonStyle = { flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontWeight: '700', fontSize: '15px', cursor: 'pointer' };