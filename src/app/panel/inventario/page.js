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
  const [loadingVehiculos, setLoadingVehiculos] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');
  const [transmision, setTransmision] = useState('Manual');
  const [traccion, setTraccion] = useState('Sencillo');
  const [cilindrada, setCilindrada] = useState('');
  const [guardando, setGuardando] = useState(false);

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
  console.log('Inventario: yonkeId =', yonkeId);
  if (!yonkeId) return;
  console.log('Inventario: armando query de vehículos');
  const ref = collection(db, 'yonkes', yonkeId, 'vehiculos');
  const q = query(ref, orderBy('fechaIngreso', 'desc'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    console.log('Inventario: snapshot recibido, docs =', snapshot.docs.length);
    const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setVehiculos(lista);
    setLoadingVehiculos(false);
  }, (error) => {
    console.log('Inventario: ERROR en onSnapshot:', error);
  });
  return unsubscribe;
}, [yonkeId]);

  async function agregarVehiculo() {
    if (!marca || !modelo || !ano) {
      alert('Llena marca, modelo y año');
      return;
    }
    setGuardando(true);
    try {
      const ref = collection(db, 'yonkes', yonkeId, 'vehiculos');
      const vehiculoRef = await addDoc(ref, {
        marca: marca.trim(),
        modelo: modelo.trim(),
        ano: parseInt(ano),
        transmision,
        traccion,
        cilindrada: cilindrada.trim() || null,
        disponible: true,
        fechaIngreso: new Date(),
      });

      await crearPiezasComunes(vehiculoRef);

      setMarca('');
      setModelo('');
      setAno('');
      setCilindrada('');
      setTransmision('Manual');
      setTraccion('Sencillo');
      setModalVisible(false);
    } catch (error) {
      console.error(error);
      alert('No se pudo agregar el vehículo');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarVehiculo(vehiculoId) {
    if (!confirm('¿Seguro que quieres quitarlo del inventario?')) return;
    await deleteDoc(doc(db, 'yonkes', yonkeId, 'vehiculos', vehiculoId));
  }

  function abrirPiezas(vehiculo) {
    setVehiculoSeleccionado(vehiculo);
    setPiezasModalVisible(true);
    setLoadingPiezas(true);

    const piezasRef = collection(db, 'yonkes', yonkeId, 'vehiculos', vehiculo.id, 'piezas');
    const unsubscribe = onSnapshot(piezasRef, (snapshot) => {
      const lista = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      setPiezas(lista);
      setLoadingPiezas(false);
    });

    setVehiculoSeleccionado(prev => ({ ...vehiculo, _unsubscribe: unsubscribe }));
  }

  function cerrarPiezas() {
    if (vehiculoSeleccionado?._unsubscribe) {
      vehiculoSeleccionado._unsubscribe();
    }
    setPiezasModalVisible(false);
    setVehiculoSeleccionado(null);
    setPiezas([]);
  }

  async function togglePieza(piezaId, disponibleActual) {
    try {
      const piezaRef = doc(db, 'yonkes', yonkeId, 'vehiculos', vehiculoSeleccionado.id, 'piezas', piezaId);
      await updateDoc(piezaRef, { disponible: !disponibleActual });
    } catch (error) {
      alert('No se pudo actualizar la pieza');
    }
  }

  async function handleLogout() {
    await signOut(auth);
    router.push('/panel');
  }

  if (loading || !user) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3C5E' }}>
        <p style={{ color: '#fff' }}>Cargando...</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Inventario</h1>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        <button onClick={() => setModalVisible(true)} style={addButtonStyle}>
          + Agregar vehículo
        </button>

        {loadingVehiculos ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Cargando...</p>
        ) : vehiculos.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Aún no has agregado vehículos</p>
        ) : (
          vehiculos.map((v) => (
            <div key={v.id} style={vehiculoCardStyle}>
              <div onClick={() => abrirPiezas(v)} style={{ flex: 1, cursor: 'pointer' }}>
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
              <button onClick={() => eliminarVehiculo(v.id)} style={{ background: 'none', border: 'none', color: '#D85A30', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                Eliminar
              </button>
            </div>
          ))
        )}
      </div>

      {modalVisible && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '16px' }}>Agregar vehículo</h2>

            <input type="text" placeholder="Marca (ej. Nissan)" value={marca} onChange={(e) => setMarca(e.target.value)} style={inputStyle} />
            <input type="text" placeholder="Modelo (ej. Sentra)" value={modelo} onChange={(e) => setModelo(e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Año (ej. 2015)" value={ano} onChange={(e) => setAno(e.target.value)} style={inputStyle} />

            <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '6px' }}>Transmisión</p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              {['Manual', 'Automática'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setTransmision(opt)}
                  style={transmision === opt ? selectorActiveStyle : selectorStyle}
                >
                  {opt}
                </button>
              ))}
            </div>

            <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '6px' }}>Tracción</p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              {['Sencillo', '4x4'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setTraccion(opt)}
                  style={traccion === opt ? selectorActiveStyle : selectorStyle}
                >
                  {opt}
                </button>
              ))}
            </div>

            <input type="text" placeholder="Cilindrada (ej. 2.0L, V6)" value={cilindrada} onChange={(e) => setCilindrada(e.target.value)} style={inputStyle} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setModalVisible(false)} style={cancelButtonStyle}>Cancelar</button>
              <button onClick={agregarVehiculo} disabled={guardando} style={buttonStyle}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    <input
                      type="checkbox"
                      checked={!!p.disponible}
                      onChange={() => togglePieza(p.id, p.disponible)}
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
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

const inputStyle = {
  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px',
  fontSize: '15px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box',
};

const buttonStyle = {
  flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#E8720C',
  color: '#fff', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
};

const cancelButtonStyle = {
  flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#F4F5F5',
  color: '#888', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
};

const addButtonStyle = {
  width: '100%', padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C',
  color: '#fff', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', marginBottom: '16px',
};

const vehiculoCardStyle = {
  backgroundColor: '#fff', borderRadius: '10px', padding: '16px', marginBottom: '12px',
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000,
};

const modalStyle = {
  backgroundColor: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%',
};

const selectorStyle = {
  flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#F4F5F5',
  color: '#888', fontWeight: '600', cursor: 'pointer', fontSize: '14px',
};

const selectorActiveStyle = {
  ...selectorStyle, backgroundColor: '#1A3C5E', borderColor: '#1A3C5E', color: '#fff',
};

const piezaRowStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F4F5F5',
};

const switchStyle = {
  display: 'flex', alignItems: 'center',
};