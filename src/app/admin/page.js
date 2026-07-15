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
  const [migrando, setMigrando] = useState(false);

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
        </div>

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
                  {y.plan === 'premium' ? '⬇️ Bajar a Básico' : '⬆️ Subir a Premium'}
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