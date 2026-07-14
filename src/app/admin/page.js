'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, setDoc, getDoc, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';

const CIUDADES_BC = [
  { key: 'tijuana', label: 'Tijuana' },
  { key: 'mexicali', label: 'Mexicali' },
  { key: 'ensenada', label: 'Ensenada' },
  { key: 'tecate', label: 'Tecate' },
  { key: 'rosarito', label: 'Playas de Rosarito' },
  { key: 'sanquintin', label: 'San Quintín' },
];

export default function AdminPage() {
  const router = useRouter();
  const [yonkes, setYonkes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [regenerandoCatalogo, setRegenerandoCatalogo] = useState(false);

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

  async function toggleActivo(yonke) {
    await updateDoc(doc(db, 'yonkes', yonke.id), { activo: !yonke.activo });
  }

  async function cambiarPlan(yonke) {
    const nuevoPlan = yonke.plan === 'premium' ? 'freemium' : 'premium';
    if (!confirm(`¿Cambiar a ${yonke.nombre} al plan ${nuevoPlan}?`)) return;
    await updateDoc(doc(db, 'yonkes', yonke.id), { plan: nuevoPlan });
  }

  async function handleLogout() {
    await signOut(auth);
    router.push('/panel');
  }

  const yonkesFiltrados = yonkes.filter(y =>
    y.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    y.ciudad?.toLowerCase().includes(busqueda.toLowerCase())
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
<button
            onClick={regenerarCatalogo}
            disabled={regenerandoCatalogo}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              backgroundColor: '#1A3C5E', color: '#fff', fontWeight: '600',
              fontSize: '13px', cursor: regenerandoCatalogo ? 'wait' : 'pointer',
              marginRight: '8px', opacity: regenerandoCatalogo ? 0.6 : 1,
            }}
          >
            {regenerandoCatalogo ? '⏳ Actualizando...' : '🔄 Actualizar catálogo'}
          </button>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>

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
                      {y.plan === 'premium' ? '⭐ Premium' : '🆓 Freemium'}
                    </span>
                    <span style={{
                      backgroundColor: y.activo ? '#E8F5E9' : '#FDECEA',
                      color: y.activo ? '#2E7D32' : '#C62828',
                      fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px'
                    }}>
                      {y.activo ? '✓ Activo' : '✗ Inactivo'}
                    </span>
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
                <button onClick={() => cambiarPlan(y)} style={actionButtonStyle(y.plan === 'premium' ? '#666' : '#2E7D32')}>
                  {y.plan === 'premium' ? '⬇️ Bajar a Freemium' : '⬆️ Subir a Premium'}
                </button>
                <button onClick={() => toggleActivo(y)} style={actionButtonStyle(y.activo ? '#C62828' : '#2E7D32')}>
                  {y.activo ? '🔴 Desactivar' : '🟢 Activar'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
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