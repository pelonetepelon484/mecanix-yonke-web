'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// Mismo slug que usa el resto del proyecto para IDs legibles (sin acentos, minúsculas,
// espacios -> guiones) — así "Baja California" siempre cae en el mismo doc "baja-california"
// sin importar quién lo escriba.
function normalizarId(nombre) {
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminEstadosPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [estados, setEstados] = useState([]);
  const [guardandoId, setGuardandoId] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [agregando, setAgregando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const snap = await getDocs(collection(db, 'estados'));
      if (snap.empty) {
        // Primera vez que se abre esta página: siembra Baja California como ya funciona hoy
        // (tieneVisitas true). setDoc con ID fijo es idempotente — si dos admins la abren a
        // la vez no se duplica, solo se sobreescribe con el mismo valor.
        await setDoc(doc(db, 'estados', 'baja-california'), {
          nombre: 'Baja California', tieneVisitas: true, orden: 1,
        });
        const snap2 = await getDocs(collection(db, 'estados'));
        setEstados(snap2.docs.map((d) => ({ id: d.id, ...d.data() })));
      } else {
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        lista.sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || (a.nombre || '').localeCompare(b.nombre || '', 'es'));
        setEstados(lista);
      }
    } catch (e) {
      console.error('[admin/estados] Error cargando estados', e);
      alert('No se pudieron cargar los estados. Revisa las reglas de Firestore.');
    }
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  async function toggleVisitas(estado) {
    setGuardandoId(estado.id);
    try {
      await updateDoc(doc(db, 'estados', estado.id), { tieneVisitas: !estado.tieneVisitas });
      setEstados((prev) => prev.map((e) => (e.id === estado.id ? { ...e, tieneVisitas: !e.tieneVisitas } : e)));
    } catch (e) {
      console.error('[admin/estados] No se pudo cambiar tieneVisitas', e);
      alert('No se pudo guardar el cambio, intenta de nuevo.');
    }
    setGuardandoId(null);
  }

  async function agregarEstado() {
    const nombre = nuevoNombre.trim();
    if (!nombre) { alert('Escribe el nombre del estado'); return; }
    const id = normalizarId(nombre);
    if (!id) { alert('Ese nombre no es válido'); return; }
    if (estados.some((e) => e.id === id)) { alert('Ese estado ya existe'); return; }
    setAgregando(true);
    try {
      // Nuevo estado siempre arranca con tieneVisitas:false — el interruptor lo prende David
      // manualmente cuando consiga quien haga las visitas ahí (regla de negocio: "todos los
      // demás estados = FALSE por ahora").
      await setDoc(doc(db, 'estados', id), { nombre, tieneVisitas: false, orden: estados.length + 1 });
      setNuevoNombre('');
      await cargar();
    } catch (e) {
      console.error('[admin/estados] No se pudo agregar el estado', e);
      alert('No se pudo agregar el estado, intenta de nuevo.');
    }
    setAgregando(false);
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', fontFamily: "'Inter', sans-serif", paddingBottom: '40px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>
            ← Volver
          </button>
          <h1 style={{ color: '#fff', fontSize: '18px', margin: '4px 0 0', fontWeight: '700' }}>Estados</h1>
        </div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '16px' }}>
        {cargando ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Cargando...</p>
        ) : (
          <>
            <p style={{ color: '#666', fontSize: '13px', margin: '0 0 16px', lineHeight: '1.5' }}>
              El interruptor "Visitas" controla si Premium/Élite incluyen las 2 visitas de
              captura al mes en ese estado (y su precio). Actívalo solo cuando ya tengas quien
              las haga ahí.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {estados.map((e) => (
                <div key={e.id} style={{
                  backgroundColor: '#fff', borderRadius: '12px', padding: '14px 16px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
                }}>
                  <p style={{ fontWeight: '700', color: '#1A3C5E', fontSize: '15px', margin: 0 }}>{e.nombre}</p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}>
                    <span style={{ fontSize: '13px', color: e.tieneVisitas ? '#2E7D32' : '#888', fontWeight: '600' }}>
                      {guardandoId === e.id ? 'Guardando...' : (e.tieneVisitas ? '✓ Con visitas' : 'Sin visitas')}
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(e.tieneVisitas)}
                      disabled={guardandoId === e.id}
                      onChange={() => toggleVisitas(e)}
                      style={{ width: '18px', height: '18px', accentColor: '#2E7D32', cursor: 'pointer' }}
                    />
                  </label>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#1A3C5E', margin: '0 0 10px' }}>+ Agregar estado</p>
              <input
                type="text"
                placeholder="Ej. Jalisco"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', backgroundColor: '#F8F9FA', color: '#333', boxSizing: 'border-box', marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}
              />
              <button
                onClick={agregarEstado}
                disabled={agregando}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: agregando ? 'default' : 'pointer' }}
              >
                {agregando ? 'Agregando...' : 'Agregar estado'}
              </button>
              <p style={{ fontSize: '11px', color: '#999', marginTop: '8px', marginBottom: 0 }}>
                Nace sin visitas — actívalas después con el interruptor de arriba.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
