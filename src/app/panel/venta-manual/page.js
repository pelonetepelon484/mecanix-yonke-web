'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, getDocs, addDoc, doc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import BottomNav from '../BottomNav';
import NotaGarantiaModal from '../NotaGarantiaModal';
import { sacarDelInventario } from '../../../lib/vehiculoEstado';
import { piezasDisponibles, resolverVentaDeInventario, resolverVentaCustom, PIEZA_CUSTOM_MAX_LEN } from '../../../lib/ventaPiezaLogic';

const OPCION_OTRA = '__OTRA__';

function registrarEvento(nombre, params = {}) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', nombre, params);
  }
}

export default function VentaManualPanel() {
  const router = useRouter();
  const { user, yonkeId, yonkePlan, loading } = useAuth();

  const [vehiculos, setVehiculos] = useState([]);
  const [loadingVehiculos, setLoadingVehiculos] = useState(true);

  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [piezasDelVehiculo, setPiezasDelVehiculo] = useState([]);
  const [loadingPiezas, setLoadingPiezas] = useState(false);
  const [piezaSeleccionId, setPiezaSeleccionId] = useState(''); // '' | id real de la pieza | OPCION_OTRA
  const [piezaOtroTexto, setPiezaOtroTexto] = useState('');
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorVenta, setErrorVenta] = useState('');
  const [avisoSinPiezas, setAvisoSinPiezas] = useState(false);
  const [sacandoDelInventario, setSacandoDelInventario] = useState(false);
  const [folioGenerado, setFolioGenerado] = useState(null);
  const [ventaGenerada, setVentaGenerada] = useState(null); // { id, ...datos } para la nota de garantía
  const [notaModalVisible, setNotaModalVisible] = useState(false);
  const [nombreYonke, setNombreYonke] = useState('');
  const [logoUrl, setLogoUrl] = useState(null);

  const piezasParaElegir = piezasDisponibles(piezasDelVehiculo);

  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => router.push('/panel'), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  useEffect(() => {
    async function cargarVehiculos() {
      if (!yonkeId || yonkePlan !== 'premium') return;
      try {
        const ref = collection(db, 'yonkes', yonkeId, 'vehiculos');
        const q = query(ref, orderBy('marca'));
        const snap = await getDocs(q);
        // disponible !== false — un vehículo ya sacado del inventario no debería ofrecerse
        // para atribuirle una venta nueva (auditoría 2026-09-24).
        const lista = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((v) => v.disponible !== false);
        setVehiculos(lista);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingVehiculos(false);
      }
    }
    cargarVehiculos();
  }, [yonkeId, yonkePlan]);

  // Piezas disponibles del vehículo elegido (yonkes/{id}/vehiculos/{id}/piezas: { nombre, disponible }).
  // onSnapshot en vez de getDocs para reflejar en vivo si alguien más vende una pieza mientras el
  // formulario sigue abierto (la transacción de registrarVenta es la que da la garantía real).
  useEffect(() => {
    if (!yonkeId || !vehiculoSeleccionado) {
      setPiezasDelVehiculo([]);
      return;
    }
    setLoadingPiezas(true);
    const ref = collection(db, 'yonkes', yonkeId, 'vehiculos', vehiculoSeleccionado.id, 'piezas');
    const unsubscribe = onSnapshot(ref, (snap) => {
      setPiezasDelVehiculo(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingPiezas(false);
    }, (error) => {
      console.error(error);
      setLoadingPiezas(false);
    });
    return unsubscribe;
  }, [yonkeId, vehiculoSeleccionado]);

  // Nombre y logo del yonke — solo para el encabezado de la nota de garantía impresa.
  useEffect(() => {
    if (!yonkeId) return;
    getDoc(doc(db, 'yonkes', yonkeId)).then((snap) => {
      if (snap.exists()) {
        setNombreYonke(snap.data().nombre || '');
        setLogoUrl(snap.data().logoUrl || null);
      }
    }).catch((e) => console.error(e));
  }, [yonkeId]);

  function generarFolioManual() {
    const random = Math.floor(1000 + Math.random() * 9000);
    const fecha = new Date();
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `VM-${mes}${dia}-${random}`;
  }

  async function registrarVenta() {
    setErrorVenta('');
    if (!vehiculoSeleccionado) {
      alert('Selecciona el vehículo del que vendiste la pieza');
      return;
    }
    if (!piezaSeleccionId) {
      alert('Selecciona qué pieza vendiste');
      return;
    }
    if (piezaSeleccionId === OPCION_OTRA && !piezaOtroTexto.trim()) {
      alert('Escribe el nombre de la pieza');
      return;
    }
    if (!monto || isNaN(parseFloat(monto))) {
      alert('Escribe un monto válido');
      return;
    }

    setGuardando(true);
    const folio = generarFolioManual();
    const vehiculoSnapshot = {
      marca: vehiculoSeleccionado.marca,
      modelo: vehiculoSeleccionado.modelo,
      ano: vehiculoSeleccionado.ano,
    };
    const base = {
      numeroPedido: folio,
      yonkeId,
      origen: 'manual',
      vehiculo: vehiculoSnapshot,
      monto: parseFloat(monto),
      fecha: new Date(),
    };

    try {
      let ventaId;
      let datosVentaFinal;

      if (piezaSeleccionId === OPCION_OTRA) {
        // "Otra...": texto libre, no toca el inventario.
        const resultado = resolverVentaCustom(piezaOtroTexto);
        if (!resultado.ok) {
          setErrorVenta(resultado.error);
          setGuardando(false);
          return;
        }
        datosVentaFinal = { ...base, partSource: resultado.ventaExtra.partSource, piezaVendida: resultado.ventaExtra.piezaVendida };
        const ventaRef = await addDoc(collection(db, 'ventas'), datosVentaFinal);
        ventaId = ventaRef.id;
      } else {
        // Pieza del inventario: releer + marcar no disponible + crear la venta, todo en la misma
        // transacción, para que dos ventas simultáneas de la misma pieza no puedan pasar las dos.
        const piezaRef = doc(db, 'yonkes', yonkeId, 'vehiculos', vehiculoSeleccionado.id, 'piezas', piezaSeleccionId);
        const ventaRef = doc(collection(db, 'ventas'));
        await runTransaction(db, async (transaction) => {
          const piezaSnap = await transaction.get(piezaRef);
          const piezaActual = piezaSnap.exists() ? piezaSnap.data() : null;
          const resultado = resolverVentaDeInventario(piezaActual, piezaSeleccionId);
          if (!resultado.ok) {
            throw new Error(resultado.error);
          }
          transaction.update(piezaRef, resultado.piezaUpdate);
          transaction.set(ventaRef, {
            ...base,
            partSource: resultado.ventaExtra.partSource,
            piezaId: resultado.ventaExtra.piezaId,
            piezaVendida: resultado.ventaExtra.piezaVendida,
          });
        });
        const nombrePieza = piezasParaElegir.find((p) => p.id === piezaSeleccionId)?.nombre || '';
        datosVentaFinal = { ...base, partSource: 'inventory', piezaId: piezaSeleccionId, piezaVendida: nombrePieza };
        ventaId = ventaRef.id;

        // Requisito 5: si ya no quedan piezas disponibles, avisar -- nunca sacar del inventario
        // automáticamente.
        try {
          const snap = await getDocs(collection(db, 'yonkes', yonkeId, 'vehiculos', vehiculoSeleccionado.id, 'piezas'));
          const restantes = piezasDisponibles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          if (restantes.length === 0) setAvisoSinPiezas(true);
        } catch (e) {
          console.error(e);
        }
      }

      setFolioGenerado(folio);
      setVentaGenerada({ id: ventaId, ...datosVentaFinal });
    } catch (error) {
      console.error(error);
      // Errores de la transacción (p.ej. "ya se vendió") tienen mensaje claro para el usuario;
      // cualquier otra falla (red, permisos) usa el mensaje genérico de siempre.
      setErrorVenta(error?.message || 'No se pudo registrar la venta');
    } finally {
      setGuardando(false);
    }
  }

  function registrarOtra() {
    setVehiculoSeleccionado(null);
    setPiezaSeleccionId('');
    setPiezaOtroTexto('');
    setMonto('');
    setErrorVenta('');
    setAvisoSinPiezas(false);
    setFolioGenerado(null);
    setVentaGenerada(null);
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

  // Pantalla de bloqueo para plan freemium
  if (yonkePlan !== 'premium') {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
        <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Venta manual</h1>
          </div>
        </div>
        <div style={lockContainerStyle}>
          <p style={{ fontSize: '64px', margin: '0 0 16px' }}>🔒</p>
          <h2 style={lockTituloStyle}>Función del Plan Premium</h2>
          <p style={lockMensajeStyle}>
            El registro de ventas manuales está disponible en el Plan Premium.
          </p>
          <p style={lockContactoStyle}>
            Comunícate con nosotros para activar tu Plan Premium y acceder a todas las funciones.
          </p>
          <a
            href="https://wa.me/5216611034260?text=Hola%2C%20me%20interesa%20el%20Plan%20Premium%20de%20Mecanix%20Yonke%20Virtual"
            target="_blank"
            rel="noopener noreferrer"
            style={lockBotonStyle}
            onClick={() => registrarEvento('clic_premium', {
              ubicacion: 'venta_manual_bloqueada',
              plan_actual: yonkePlan,
            })}
          >
            Quiero Premium
          </a>
        </div>
        <BottomNav />
      </main>
    );
  }

  if (folioGenerado) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
        <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Venta manual</h1>
          </div>
        </div>
        <div style={{ maxWidth: '420px', margin: '40px auto', padding: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '48px', margin: '0 0 12px' }}>✅</p>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '6px' }}>¡Venta registrada!</h2>
          <p style={{ fontSize: '14px', color: '#888', marginBottom: '16px' }}>Folio de la venta:</p>
          <div style={{ backgroundColor: '#1A3C5E', color: '#fff', fontSize: '22px', fontWeight: 'bold', padding: '16px', borderRadius: '10px', letterSpacing: '1px', marginBottom: '24px' }}>
            {folioGenerado}
          </div>
          {avisoSinPiezas && (
            <div style={{ backgroundColor: '#FFF4E5', border: '1px solid #E8720C', borderRadius: '10px', padding: '14px', marginBottom: '16px', textAlign: 'left' }}>
              <p style={{ fontSize: '14px', color: '#1A3C5E', margin: '0 0 8px', fontWeight: 'bold' }}>
                Este vehículo ya no tiene piezas disponibles
              </p>
              <p style={{ fontSize: '13px', color: '#666', margin: '0 0 12px' }}>
                ¿Quieres sacarlo del inventario? Si te equivocas, puedes reactivarlo después.
              </p>
              <button
                onClick={async () => {
                  setSacandoDelInventario(true);
                  try {
                    await sacarDelInventario(db, yonkeId, vehiculoSeleccionado.id, 'vendido');
                    setAvisoSinPiezas(false);
                  } catch (e) {
                    console.error(e);
                    alert('No se pudo sacar el vehículo del inventario');
                  } finally {
                    setSacandoDelInventario(false);
                  }
                }}
                disabled={sacandoDelInventario}
                style={secondaryButtonStyle}
              >
                {sacandoDelInventario ? 'Guardando...' : 'Sacar del inventario'}
              </button>
            </div>
          )}
          <button onClick={() => setNotaModalVisible(true)} style={{ ...secondaryButtonStyle, marginBottom: '12px' }}>
            🛡️ Generar nota de garantía
          </button>
          <button onClick={registrarOtra} style={{ ...secondaryButtonStyle, marginBottom: '12px' }}>
            Registrar otra venta
          </button>
          <button onClick={() => router.push('/panel/inventario')} style={primaryButtonStyle}>
            Listo
          </button>
        </div>
        {notaModalVisible && ventaGenerada && (
          <NotaGarantiaModal
            venta={ventaGenerada}
            yonkeId={yonkeId}
            nombreYonke={nombreYonke}
            logoUrl={logoUrl}
            onClose={() => setNotaModalVisible(false)}
          />
        )}
        <BottomNav />
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Venta manual</h1>
            <p style={{ color: '#ccc', fontSize: '13px', margin: '2px 0 0' }}>Registra ventas hechas fuera de la plataforma</p>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        <div style={sectionStyle}>
          <p style={labelStyle}>Vehículo</p>
          {loadingVehiculos ? (
            <p style={{ color: '#888' }}>Cargando...</p>
          ) : (
            <button onClick={() => setSelectorVisible(true)} style={selectorButtonStyle}>
              {vehiculoSeleccionado
                ? `${vehiculoSeleccionado.marca} ${vehiculoSeleccionado.modelo} ${vehiculoSeleccionado.ano}`
                : 'Selecciona un vehículo de tu inventario'}
            </button>
          )}

          <p style={labelStyle}>Pieza vendida</p>
          {!vehiculoSeleccionado ? (
            <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>Primero selecciona un vehículo</p>
          ) : loadingPiezas ? (
            <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>Cargando piezas...</p>
          ) : (
            <select
              value={piezaSeleccionId}
              onChange={(e) => { setPiezaSeleccionId(e.target.value); setErrorVenta(''); }}
              style={inputStyle}
            >
              <option value="">Selecciona una pieza</option>
              {piezasParaElegir.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
              <option value={OPCION_OTRA}>Otra...</option>
            </select>
          )}
          {piezaSeleccionId === OPCION_OTRA && (
            <input
              type="text"
              value={piezaOtroTexto}
              onChange={(e) => setPiezaOtroTexto(e.target.value)}
              placeholder="Escribe el nombre de la pieza"
              maxLength={PIEZA_CUSTOM_MAX_LEN}
              style={{ ...inputStyle, marginTop: '8px' }}
            />
          )}

          <p style={labelStyle}>Monto de la venta</p>
          <input
            type="number"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="Monto en pesos"
            style={inputStyle}
          />

          {errorVenta && (
            <p style={{ color: '#C0392B', fontSize: '13px', marginTop: '10px', marginBottom: 0 }}>{errorVenta}</p>
          )}
          <button onClick={registrarVenta} disabled={guardando} style={{ ...primaryButtonStyle, marginTop: '20px' }}>
            {guardando ? 'Guardando...' : 'Registrar venta'}
          </button>
        </div>
      </div>

      {selectorVisible && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '16px' }}>Selecciona el vehículo</h2>
            {vehiculos.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#888', padding: '20px 0' }}>No tienes vehículos en tu inventario</p>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {vehiculos.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => {
                      setVehiculoSeleccionado(v);
                      setSelectorVisible(false);
                      // Requisito 6: cambiar de vehículo reinicia la pieza elegida -- las piezas
                      // disponibles de uno no tienen nada que ver con las del otro.
                      setPiezaSeleccionId('');
                      setPiezaOtroTexto('');
                      setErrorVenta('');
                      setAvisoSinPiezas(false);
                    }}
                    style={vehiculoOpcionStyle}
                  >
                    {v.marca} {v.modelo} {v.ano}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setSelectorVisible(false)} style={{ ...secondaryButtonStyle, marginTop: '16px' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

const sectionStyle = {
  backgroundColor: '#fff', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};
const labelStyle = {
  fontSize: '13px', color: '#666', marginBottom: '6px', marginTop: '12px',
};
const inputStyle = {
  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
  fontSize: '15px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box',
};
const selectorButtonStyle = {
  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
  backgroundColor: '#F4F5F5', color: '#888', fontSize: '15px', textAlign: 'left', cursor: 'pointer',
};
const primaryButtonStyle = {
  width: '100%', padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C',
  color: '#fff', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
};
const secondaryButtonStyle = {
  width: '100%', padding: '14px', borderRadius: '10px', border: '1.5px solid #1A3C5E',
  backgroundColor: '#fff', color: '#1A3C5E', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
};
const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000,
};
const modalStyle = {
  backgroundColor: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%',
};
const vehiculoOpcionStyle = {
  padding: '14px 0', borderBottom: '1px solid #F4F5F5', fontSize: '15px', color: '#333', cursor: 'pointer',
};
const lockContainerStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: '48px 32px', textAlign: 'center', maxWidth: '400px', margin: '0 auto',
};
const lockTituloStyle = {
  fontSize: '22px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '12px',
};
const lockMensajeStyle = {
  fontSize: '15px', color: '#555', lineHeight: '1.6', marginBottom: '12px',
};
const lockContactoStyle = {
  fontSize: '13px', color: '#888', lineHeight: '1.6', marginBottom: '24px',
};
const lockBotonStyle = {
  backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold', fontSize: '14px',
  padding: '12px 24px', borderRadius: '24px', textDecoration: 'none', display: 'inline-block',
};