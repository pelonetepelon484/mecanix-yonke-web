'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection, addDoc, query, onSnapshot, deleteDoc, doc, orderBy, writeBatch, updateDoc
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import BottomNav from '../BottomNav';
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

export default function InventarioPanel() {
  const router = useRouter();
  const { user, yonkeId, loading } = useAuth();

  const [vehiculos, setVehiculos] = useState([]);
  const [motores, setMotores] = useState([]);
  const [loadingVehiculos, setLoadingVehiculos] = useState(true);
  const [loadingMotores, setLoadingMotores] = useState(true);

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

  // Modal motor/transmisión
  const [motorModalVisible, setMotorModalVisible] = useState(false);
  const [motorEditando, setMotorEditando] = useState(null);
  const [motorTipo, setMotorTipo] = useState('Motor');
  const [motorMarca, setMotorMarca] = useState('');
  const [motorModelo, setMotorModelo] = useState('');
  const [motorAno, setMotorAno] = useState('');
  const [motorCilindrada, setMotorCilindrada] = useState('');
  const [motorDisponible, setMotorDisponible] = useState(true);
  const [guardandoMotor, setGuardandoMotor] = useState(false);

  // Modal piezas
  const [piezasModalVisible, setPiezasModalVisible] = useState(false);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
  const [piezas, setPiezas] = useState([]);
  const [loadingPiezas, setLoadingPiezas] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => router.push('/panel'), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  useEffect(() => {
    if (!yonkeId) return;
    const ref = collection(db, 'yonkes', yonkeId, 'vehiculos');
    const q = query(ref, orderBy('fechaIngreso', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setVehiculos(lista);
      setLoadingVehiculos(false);
    });
    return unsubscribe;
  }, [yonkeId]);

  useEffect(() => {
    if (!yonkeId) return;
    const ref = collection(db, 'yonkes', yonkeId, 'motores');
    const q = query(ref, orderBy('fechaIngreso', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMotores(lista);
      setLoadingMotores(false);
    });
    return unsubscribe;
  }, [yonkeId]);

  function abrirModalAgregar() {
    setVehiculoEditando(null);
    setMarca(''); setModelo(''); setAno('');
    setTransmision('Manual'); setTraccion('Sencillo'); setCilindrada('');
    setModalVisible(true);
  }

  function abrirModalEditar(vehiculo) {
    setVehiculoEditando(vehiculo);
    setMarca(vehiculo.marca || ''); setModelo(vehiculo.modelo || '');
    setAno(String(vehiculo.ano || '')); setTransmision(vehiculo.transmision || 'Manual');
    setTraccion(vehiculo.traccion || 'Sencillo'); setCilindrada(vehiculo.cilindrada || '');
    setModalVisible(true);
  }

  function abrirModalMotor() {
    setMotorEditando(null);
    setMotorTipo('Motor'); setMotorMarca(''); setMotorModelo('');
    setMotorAno(''); setMotorCilindrada(''); setMotorDisponible(true);
    setMotorModalVisible(true);
  }

  function abrirModalEditarMotor(motor) {
    setMotorEditando(motor);
    setMotorTipo(motor.tipo || 'Motor'); setMotorMarca(motor.marca || '');
    setMotorModelo(motor.modelo || ''); setMotorAno(String(motor.ano || ''));
    setMotorCilindrada(motor.cilindrada || ''); setMotorDisponible(motor.disponible !== false);
    setMotorModalVisible(true);
  }

  async function guardarVehiculo() {
    if (!marca || !modelo || !ano) { alert('Llena marca, modelo y año'); return; }
    setGuardando(true);
    try {
      if (vehiculoEditando) {
        const vehiculoRef = doc(db, 'yonkes', yonkeId, 'vehiculos', vehiculoEditando.id);
        await updateDoc(vehiculoRef, {
          marca: marca.trim(), modelo: modelo.trim(), ano: parseInt(ano),
          transmision, traccion, cilindrada: cilindrada.trim() || null,
        });
      } else {
        const ref = collection(db, 'yonkes', yonkeId, 'vehiculos');
        const vehiculoRef = await addDoc(ref, {
          marca: marca.trim(), modelo: modelo.trim(), ano: parseInt(ano),
          transmision, traccion, cilindrada: cilindrada.trim() || null,
          disponible: true, fechaIngreso: new Date(),
        });
        await crearPiezasComunes(vehiculoRef);
      }
      await registrarEnCatalogo(marca.trim(), modelo.trim());
      setModalVisible(false); setVehiculoEditando(null);
    } catch (error) {
      console.error(error); alert('No se pudo guardar el vehículo');
    } finally { setGuardando(false); }
  }

  async function guardarMotor() {
    if (!motorMarca || !motorModelo || !motorAno) {
      alert('Llena marca, modelo y año'); return;
    }
    setGuardandoMotor(true);
    try {
      if (motorEditando) {
        const motorRef = doc(db, 'yonkes', yonkeId, 'motores', motorEditando.id);
        await updateDoc(motorRef, {
          tipo: motorTipo, marca: motorMarca.trim(), modelo: motorModelo.trim(),
          ano: parseInt(motorAno), cilindrada: motorCilindrada.trim() || null,
          disponible: motorDisponible,
        });
      } else {
        await addDoc(collection(db, 'yonkes', yonkeId, 'motores'), {
          tipo: motorTipo, marca: motorMarca.trim(), modelo: motorModelo.trim(),
          ano: parseInt(motorAno), cilindrada: motorCilindrada.trim() || null,
          disponible: true, fechaIngreso: new Date(),
        });
      }
      setMotorModalVisible(false); setMotorEditando(null);
    } catch (error) {
      console.error(error); alert('No se pudo guardar');
    } finally { setGuardandoMotor(false); }
  }

  async function eliminarVehiculo(vehiculoId) {
    if (!confirm('¿Seguro que quieres quitarlo del inventario?')) return;
    await deleteDoc(doc(db, 'yonkes', yonkeId, 'vehiculos', vehiculoId));
  }

  async function eliminarMotor(motorId) {
    if (!confirm('¿Seguro que quieres eliminarlo?')) return;
    await deleteDoc(doc(db, 'yonkes', yonkeId, 'motores', motorId));
  }

  async function toggleDisponibilidadMotor(motor) {
    const motorRef = doc(db, 'yonkes', yonkeId, 'motores', motor.id);
    await updateDoc(motorRef, { disponible: !motor.disponible });
  }

  function abrirPiezas(vehiculo) {
    setVehiculoSeleccionado(vehiculo);
    setPiezasModalVisible(true);
    setLoadingPiezas(true);
    const piezasRef = collection(db, 'yonkes', yonkeId, 'vehiculos', vehiculo.id, 'piezas');
    const unsubscribe = onSnapshot(piezasRef, (snapshot) => {
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.nombre.localeCompare(b.nombre));
      setPiezas(lista); setLoadingPiezas(false);
    });
    setVehiculoSeleccionado(prev => ({ ...vehiculo, _unsubscribe: unsubscribe }));
  }

  function cerrarPiezas() {
    if (vehiculoSeleccionado?._unsubscribe) vehiculoSeleccionado._unsubscribe();
    setPiezasModalVisible(false); setVehiculoSeleccionado(null); setPiezas([]);
  }

  async function togglePieza(piezaId, disponibleActual) {
    try {
      const piezaRef = doc(db, 'yonkes', yonkeId, 'vehiculos', vehiculoSeleccionado.id, 'piezas', piezaId);
      await updateDoc(piezaRef, { disponible: !disponibleActual });
    } catch (error) { alert('No se pudo actualizar la pieza'); }
  }

  async function handleLogout() { await signOut(auth); router.push('/panel'); }

  if (loading || !user) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3C5E' }}>
        <p style={{ color: '#fff' }}>Cargando...</p>
      </main>
    );
  }

  const totalItems = vehiculos.length + motores.length;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Inventario</h1>
            {!loadingVehiculos && (
              <p style={{ color: '#cdd9e4', fontSize: '13px', margin: '4px 0 0' }}>
                {vehiculos.length} {vehiculos.length === 1 ? 'vehículo' : 'vehículos'} · {motores.filter(m => m.tipo === 'Motor').length} motores · {motores.filter(m => m.tipo === 'Transmisión').length} transmisiones
              </p>
            )}
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <button onClick={abrirModalAgregar} style={{ ...addButtonStyle, flex: 1 }}>
            🚗 Agregar vehículo
          </button>
          <button onClick={abrirModalMotor} style={{ ...addButtonStyle, flex: 1, backgroundColor: '#1A3C5E' }}>
            🔧 Motor / Transmisión
          </button>
        </div>

        {/* Vehículos */}
        {loadingVehiculos ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '16px' }}>Cargando...</p>
        ) : vehiculos.length > 0 && (
          <>
            <p style={seccionTituloStyle}>🚗 Vehículos ({vehiculos.length})</p>
            {vehiculos.map((v, index) => (
              <div key={v.id} style={vehiculoCardStyle}>
                <div onClick={() => abrirPiezas(v)} style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'flex-start' }}>
                  <div style={numeroBadgeStyle}>{index + 1}</div>
                  <div style={{ marginLeft: '10px' }}>
                    <p style={{ fontWeight: 'bold', color: '#1A3C5E', fontSize: '16px', margin: 0 }}>
                      {v.marca} {v.modelo}
                    </p>
                    <p style={{ color: '#888', fontSize: '13px', margin: '2px 0 0' }}>
                      {v.ano} · {v.transmision} · {v.traccion}{v.cilindrada ? ` · ${v.cilindrada}` : ''}
                    </p>
                    <p style={{ color: '#E8720C', fontSize: '12px', fontWeight: 'bold', marginTop: '6px' }}>
                      Ver / editar piezas →
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                  <button onClick={() => abrirModalEditar(v)} style={{ background: 'none', border: 'none', color: '#1A3C5E', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Editar
                  </button>
                  <button onClick={() => eliminarVehiculo(v.id)} style={{ background: 'none', border: 'none', color: '#D85A30', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Motores y transmisiones */}
        {!loadingMotores && motores.length > 0 && (
          <>
            <p style={{ ...seccionTituloStyle, marginTop: '20px' }}>🔧 Motores y transmisiones ({motores.length})</p>
            {motores.map((m) => (
              <div key={m.id} style={{ ...vehiculoCardStyle, opacity: m.disponible === false ? 0.6 : 1 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ backgroundColor: m.tipo === 'Motor' ? '#E8720C' : '#1A3C5E', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '12px' }}>
                      {m.tipo === 'Motor' ? '🔧 Motor' : '⚙️ Transmisión'}
                    </span>
                    {m.disponible === false && (
                      <span style={{ backgroundColor: '#F4F5F5', color: '#888', fontSize: '11px', padding: '3px 8px', borderRadius: '12px' }}>
                        No disponible
                      </span>
                    )}
                  </div>
                  <p style={{ fontWeight: 'bold', color: '#1A3C5E', fontSize: '16px', margin: '6px 0 0' }}>
                    {m.marca} {m.modelo} {m.ano}
                  </p>
                  {m.cilindrada && (
                    <p style={{ color: '#888', fontSize: '13px', margin: '2px 0 0' }}>{m.cilindrada}</p>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                  <button onClick={() => abrirModalEditarMotor(m)} style={{ background: 'none', border: 'none', color: '#1A3C5E', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Editar
                  </button>
                  <button onClick={() => toggleDisponibilidadMotor(m)} style={{ background: 'none', border: 'none', color: '#888', fontSize: '12px', cursor: 'pointer' }}>
                    {m.disponible === false ? 'Activar' : 'Desactivar'}
                  </button>
                  <button onClick={() => eliminarMotor(m.id)} style={{ background: 'none', border: 'none', color: '#D85A30', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {!loadingVehiculos && !loadingMotores && totalItems === 0 && (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Aún no has agregado nada al inventario</p>
        )}
      </div>

      {/* Modal vehículo */}
      {modalVisible && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '16px' }}>
              {vehiculoEditando ? 'Editar vehículo' : 'Agregar vehículo'}
            </h2>
            <SelectorMarcaModelo
              marca={marca} modelo={modelo}
              onMarca={setMarca} onModelo={setModelo}
              inputStyle={inputStyle}
            />
            <input type="number" placeholder="Año (ej. 2015)" value={ano} onChange={(e) => setAno(e.target.value)} style={inputStyle} />
            <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '6px' }}>Transmisión</p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              {['Manual', 'Automática'].map((opt) => (
                <button key={opt} onClick={() => setTransmision(opt)} style={transmision === opt ? selectorActiveStyle : selectorStyle}>{opt}</button>
              ))}
            </div>
            <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '6px' }}>Tracción</p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              {['Sencillo', '4x4'].map((opt) => (
                <button key={opt} onClick={() => setTraccion(opt)} style={traccion === opt ? selectorActiveStyle : selectorStyle}>{opt}</button>
              ))}
            </div>
            <input type="text" placeholder="Cilindrada (ej. 2.0L, V6)" value={cilindrada} onChange={(e) => setCilindrada(e.target.value)} style={inputStyle} />
            {vehiculoEditando && (
              <p style={{ fontSize: '12px', color: '#999', marginTop: '4px', marginBottom: '8px', fontStyle: 'italic' }}>
                Las piezas de este vehículo no se modifican aquí — usa "Ver / editar piezas" para eso.
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setModalVisible(false)} style={cancelButtonStyle}>Cancelar</button>
              <button onClick={guardarVehiculo} disabled={guardando} style={buttonStyle}>
                {guardando ? 'Guardando...' : (vehiculoEditando ? 'Guardar cambios' : 'Guardar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal motor/transmisión */}
      {motorModalVisible && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '16px' }}>
              {motorEditando ? 'Editar' : 'Agregar motor o transmisión'}
            </h2>
            <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '6px' }}>Tipo</p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              {['Motor', 'Transmisión'].map((opt) => (
                <button key={opt} onClick={() => setMotorTipo(opt)} style={motorTipo === opt ? selectorActiveStyle : selectorStyle}>
                  {opt === 'Motor' ? '🔧 Motor' : '⚙️ Transmisión'}
                </button>
              ))}
            </div>
            <input type="text" placeholder="Marca (ej. Nissan)" value={motorMarca} onChange={(e) => setMotorMarca(e.target.value)} style={inputStyle} />
            <input type="text" placeholder="Modelo (ej. Sentra)" value={motorModelo} onChange={(e) => setMotorModelo(e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Año (ej. 2015)" value={motorAno} onChange={(e) => setMotorAno(e.target.value)} style={inputStyle} />
            <input type="text" placeholder="Cilindrada (ej. 1.8L, V6)" value={motorCilindrada} onChange={(e) => setMotorCilindrada(e.target.value)} style={inputStyle} />
            {motorEditando && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <input type="checkbox" checked={motorDisponible} onChange={(e) => setMotorDisponible(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                <span style={{ fontSize: '14px', color: '#333' }}>Disponible</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setMotorModalVisible(false)} style={cancelButtonStyle}>Cancelar</button>
              <button onClick={guardarMotor} disabled={guardandoMotor} style={buttonStyle}>
                {guardandoMotor ? 'Guardando...' : (motorEditando ? 'Guardar cambios' : 'Guardar')}
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
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
              Activa o desactiva las piezas disponibles
            </p>
            {loadingPiezas ? (
              <p style={{ textAlign: 'center', color: '#888' }}>Cargando...</p>
            ) : (
              piezas.map((p) => (
                <div key={p.id} style={piezaRowStyle}>
                  <span style={{ color: p.disponible ? '#333' : '#bbb', textDecoration: p.disponible ? 'none' : 'line-through', fontSize: '15px' }}>
                    {p.nombre}
                  </span>
                  <label style={switchStyle}>
                    <input type="checkbox" checked={!!p.disponible} onChange={() => togglePieza(p.id, p.disponible)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  </label>
                </div>
              ))
            )}
            <button onClick={cerrarPiezas} style={{ ...buttonStyle, backgroundColor: '#1A3C5E', marginTop: '16px' }}>
              Listo
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px', fontSize: '15px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box' };
const buttonStyle = { flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' };
const cancelButtonStyle = { flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#F4F5F5', color: '#888', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' };
const addButtonStyle = { padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', marginBottom: '16px' };
const vehiculoCardStyle = { backgroundColor: '#fff', borderRadius: '10px', padding: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };
const numeroBadgeStyle = { backgroundColor: '#F4F5F5', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: '#1A3C5E', flexShrink: 0 };
const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 };
const modalStyle = { backgroundColor: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%' };
const selectorStyle = { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#F4F5F5', color: '#888', fontWeight: '600', cursor: 'pointer', fontSize: '14px' };
const selectorActiveStyle = { ...selectorStyle, backgroundColor: '#1A3C5E', borderColor: '#1A3C5E', color: '#fff' };
const piezaRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F4F5F5' };
const switchStyle = { display: 'flex', alignItems: 'center' };
const seccionTituloStyle = { fontSize: '13px', fontWeight: 'bold', color: '#888', letterSpacing: '1px', marginBottom: '10px', marginTop: '8px' };