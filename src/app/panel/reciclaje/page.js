'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection, query, orderBy, onSnapshot, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, writeBatch,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import BottomNav from '../BottomNav';
import { MATERIALES_RECICLAJE_BASE } from '../../lib/materialesReciclajeBase';
import { ESTADO_DEFAULT, estadoDeYonke } from '../../lib/estados';
import { DECLARACION_LEGAL_BC } from '../../lib/declaracionLegalReciclaje';
import {
  IVA_PORCENTAJE_DEFAULT, IVA_RETENIDO_PORCENTAJE_DEFAULT, ISR_PORCENTAJE_DEFAULT,
  INCLUIR_AVISO_FACTURA_DEFAULT, AVISO_FACTURA_TEXTO,
} from '../../lib/fiscalReciclajeDefault';

// Siembra la lista base UNA sola vez (si la subcolección está vacía) — mismo patrón que
// crearPiezasComunes en admin/yonke/[id]/inventario/page.js: un solo writeBatch, precioPorKilo
// en 0 para que el yonke sepa que le falta ponerle precio antes de comprar con ese material.
async function sembrarMaterialesBase(yonkeId) {
  const ref = collection(db, 'yonkes', yonkeId, 'materialesReciclaje');
  const snap = await getDocs(ref);
  if (!snap.empty) return;
  const batch = writeBatch(db);
  MATERIALES_RECICLAJE_BASE.forEach((nombre) => {
    batch.set(doc(ref), { nombre, precioPorKilo: 0 });
  });
  await batch.commit();
}

function formatoMoneda(n) {
  return (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function getFecha(c) {
  return c.fecha?.toDate ? c.fecha.toDate() : new Date(c.fecha);
}

// Compras antiguas (antes de soportar varios conceptos por compra) guardan material/kilos/precio
// directo en el documento; las nuevas guardan un arreglo `conceptos`. Esta función deja ambos
// formatos con la misma forma para que el resto de la pantalla no tenga que distinguirlos.
function conceptosDeCompra(c) {
  if (c.conceptos && c.conceptos.length > 0) return c.conceptos;
  if (c.material) {
    return [{ material: c.material, materialId: c.materialId, precioPorKilo: c.precioPorKilo, kilos: c.kilos, importe: c.total }];
  }
  return [];
}

function tituloCompra(c) {
  const items = conceptosDeCompra(c);
  if (items.length <= 1) return items[0]?.material || '(sin material)';
  return items.map((i) => i.material).join(', ');
}

function subtituloCompra(c) {
  const items = conceptosDeCompra(c);
  if (items.length === 1) {
    const i = items[0];
    return `${i.kilos} kg × ${formatoMoneda(i.precioPorKilo)}`;
  }
  const kilosTotal = items.reduce((sum, i) => sum + (i.kilos || 0), 0);
  return `${items.length} conceptos · ${kilosTotal.toLocaleString('es-MX')} kg`;
}

// Mismo cálculo de "inicio de periodo" que ya usa panel/ventas/page.js — para que "hoy/semana/mes"
// signifique exactamente lo mismo en todo el panel del yonke.
function getFechaInicio(periodo) {
  const hoy = new Date();
  if (periodo === 'hoy') {
    const inicio = new Date(hoy);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  }
  if (periodo === 'semana') {
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - 7);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  }
  if (periodo === 'mes') {
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }
  return new Date(0);
}

export default function ReciclajePanel() {
  const router = useRouter();
  const { user, yonkeId, loading } = useAuth();

  const [nombreYonke, setNombreYonke] = useState('');
  const [tab, setTab] = useState('comprar'); // 'comprar' | 'materiales' | 'reportes'

  const [materiales, setMateriales] = useState([]);
  const [loadingMateriales, setLoadingMateriales] = useState(true);
  const [compras, setCompras] = useState([]);
  const [loadingCompras, setLoadingCompras] = useState(true);

  // Formulario de compra — concepto que se está armando (material + kilos) antes de agregarlo
  // a la lista de conceptos de la compra actual.
  const [materialSeleccionadoId, setMaterialSeleccionadoId] = useState('');
  const [kilos, setKilos] = useState('');
  const [conceptos, setConceptos] = useState([]);
  const [guardandoCompra, setGuardandoCompra] = useState(false);

  // Datos del vendedor y declaración legal de la compra actual — editables, se capturan una vez
  // por compra (no por concepto).
  const [vendedorNombre, setVendedorNombre] = useState('');
  const [vendedorDireccion, setVendedorDireccion] = useState('');
  const [vendedorRfc, setVendedorRfc] = useState('');
  const [vendedorCurp, setVendedorCurp] = useState('');
  const [declaracionLegal, setDeclaracionLegal] = useState('');

  // Datos fiscales de la compra actual — prellenados desde el default del perfil (ver
  // panel/perfil/page.js), editables por si una compra en particular necesita otro porcentaje.
  const [ivaPorcentaje, setIvaPorcentaje] = useState(String(IVA_PORCENTAJE_DEFAULT));
  const [ivaRetenidoPorcentaje, setIvaRetenidoPorcentaje] = useState(String(IVA_RETENIDO_PORCENTAJE_DEFAULT));
  const [isrPorcentaje, setIsrPorcentaje] = useState(String(ISR_PORCENTAJE_DEFAULT));
  const [incluirAvisoFactura, setIncluirAvisoFactura] = useState(INCLUIR_AVISO_FACTURA_DEFAULT);

  // Modal material (agregar / editar precio)
  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [materialEditando, setMaterialEditando] = useState(null);
  const [materialNombre, setMaterialNombre] = useState('');
  const [materialPrecio, setMaterialPrecio] = useState('');
  const [guardandoMaterial, setGuardandoMaterial] = useState(false);

  // Ticket
  const [compraParaTicket, setCompraParaTicket] = useState(null);

  // Reportes
  const [periodoActivo, setPeriodoActivo] = useState('hoy');

  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => router.push('/panel'), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  useEffect(() => {
    if (!yonkeId) return;
    getDoc(doc(db, 'yonkes', yonkeId)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setNombreYonke(data.nombre || '');
      // La referencia legal (Código Civil de B.C.) solo aplica a yonkes de Baja California — para
      // los demás se deja en blanco pero editable, no inventamos una cita legal de otro estado.
      if (estadoDeYonke(data) === ESTADO_DEFAULT) setDeclaracionLegal(DECLARACION_LEGAL_BC);
      const f = data.fiscalReciclaje || {};
      setIvaPorcentaje(String(f.ivaPorcentaje ?? IVA_PORCENTAJE_DEFAULT));
      setIvaRetenidoPorcentaje(String(f.ivaRetenidoPorcentaje ?? IVA_RETENIDO_PORCENTAJE_DEFAULT));
      setIsrPorcentaje(String(f.isrPorcentaje ?? ISR_PORCENTAJE_DEFAULT));
      setIncluirAvisoFactura(f.incluirAvisoFactura ?? INCLUIR_AVISO_FACTURA_DEFAULT);
    }).catch((e) => console.error(e));
  }, [yonkeId]);

  useEffect(() => {
    if (!yonkeId) return;
    sembrarMaterialesBase(yonkeId).catch((e) => console.error('[reciclaje] No se pudo sembrar la lista base', e));
    const ref = collection(db, 'yonkes', yonkeId, 'materialesReciclaje');
    const q = query(ref, orderBy('nombre'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMateriales(lista);
      setLoadingMateriales(false);
    });
    return unsubscribe;
  }, [yonkeId]);

  useEffect(() => {
    if (!yonkeId) return;
    const ref = collection(db, 'yonkes', yonkeId, 'comprasReciclaje');
    const q = query(ref, orderBy('fecha', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCompras(lista);
      setLoadingCompras(false);
    });
    return unsubscribe;
  }, [yonkeId]);

  const materialSeleccionado = materiales.find((m) => m.id === materialSeleccionadoId) || null;
  const kilosNum = parseFloat(kilos);
  const importeConcepto = materialSeleccionado && !isNaN(kilosNum) && kilosNum > 0
    ? kilosNum * (materialSeleccionado.precioPorKilo || 0)
    : 0;
  const totalCompra = conceptos.reduce((sum, c) => sum + c.importe, 0);
  const ivaPct = parseFloat(ivaPorcentaje) || 0;
  const ivaRetPct = parseFloat(ivaRetenidoPorcentaje) || 0;
  const isrPct = parseFloat(isrPorcentaje) || 0;
  const montoIva = totalCompra * (ivaPct / 100);
  const montoIvaRetenido = totalCompra * (ivaRetPct / 100);
  const montoIsr = totalCompra * (isrPct / 100);
  const netoAPagar = totalCompra + montoIva - montoIvaRetenido - montoIsr;

  function generarFolioReciclaje() {
    const random = Math.floor(1000 + Math.random() * 9000);
    const fecha = new Date();
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `RC-${mes}${dia}-${random}`;
  }

  function agregarConcepto() {
    if (!materialSeleccionado) { alert('Selecciona un material'); return; }
    if (!kilosNum || kilosNum <= 0) { alert('Escribe los kilos'); return; }
    if (!materialSeleccionado.precioPorKilo) {
      alert(`"${materialSeleccionado.nombre}" todavía no tiene precio — ponle precio primero en la pestaña Materiales.`);
      return;
    }
    // precioPorKilo se copia AQUÍ, al agregar el concepto — si después cambia el precio del
    // material, este concepto ya agregado (y la compra una vez guardada) NO se recalcula
    // (histórico correcto, mismo criterio que ya usaba esta pantalla).
    setConceptos((prev) => [...prev, {
      materialId: materialSeleccionado.id,
      material: materialSeleccionado.nombre,
      precioPorKilo: materialSeleccionado.precioPorKilo,
      kilos: kilosNum,
      importe: Math.round(importeConcepto * 100) / 100,
    }]);
    setMaterialSeleccionadoId('');
    setKilos('');
  }

  function quitarConcepto(index) {
    setConceptos((prev) => prev.filter((_, i) => i !== index));
  }

  async function registrarCompra() {
    if (!vendedorNombre.trim()) { alert('Escribe el nombre de quien vende el material'); return; }
    if (conceptos.length === 0) { alert('Agrega al menos un concepto (material + kilos)'); return; }
    setGuardandoCompra(true);
    try {
      const datos = {
        folio: generarFolioReciclaje(),
        vendedor: {
          nombre: vendedorNombre.trim(),
          direccion: vendedorDireccion.trim(),
          rfc: vendedorRfc.trim(),
          curp: vendedorCurp.trim(),
        },
        declaracionLegal: declaracionLegal.trim(),
        conceptos,
        total: Math.round(totalCompra * 100) / 100,
        // Porcentajes Y montos ya calculados se guardan juntos — mismo criterio de snapshot que
        // el resto de la nota: si el yonke cambia sus porcentajes por defecto después, esta
        // compra ya registrada no se recalcula.
        ivaPorcentaje: ivaPct,
        ivaRetenidoPorcentaje: ivaRetPct,
        isrPorcentaje: isrPct,
        montoIva: Math.round(montoIva * 100) / 100,
        montoIvaRetenido: Math.round(montoIvaRetenido * 100) / 100,
        montoIsr: Math.round(montoIsr * 100) / 100,
        netoAPagar: Math.round(netoAPagar * 100) / 100,
        incluirAvisoFactura,
        fecha: new Date(),
      };
      const ref = await addDoc(collection(db, 'yonkes', yonkeId, 'comprasReciclaje'), datos);
      setConceptos([]);
      setVendedorNombre('');
      setVendedorDireccion('');
      setVendedorRfc('');
      setVendedorCurp('');
      setCompraParaTicket({ id: ref.id, ...datos });
    } catch (error) {
      console.error('[registrarCompra]', error?.code, error);
      alert(`No se pudo guardar${error?.code ? ` (${error.code})` : ''}`);
    } finally {
      setGuardandoCompra(false);
    }
  }

  function abrirModalAgregarMaterial() {
    setMaterialEditando(null);
    setMaterialNombre('');
    setMaterialPrecio('');
    setMaterialModalVisible(true);
  }

  function abrirModalEditarMaterial(material) {
    setMaterialEditando(material);
    setMaterialNombre(material.nombre);
    setMaterialPrecio(String(material.precioPorKilo ?? ''));
    setMaterialModalVisible(true);
  }

  async function guardarMaterial() {
    const precio = parseFloat(materialPrecio);
    if (!materialEditando && !materialNombre.trim()) { alert('Escribe el nombre del material'); return; }
    if (isNaN(precio) || precio < 0) { alert('Escribe un precio válido'); return; }
    setGuardandoMaterial(true);
    try {
      if (materialEditando) {
        // Actualiza el precio (y el nombre, por si se corrige un typo) del material — esto NO
        // toca las compras ya guardadas, que llevan su propia copia del precio de ese momento.
        await updateDoc(doc(db, 'yonkes', yonkeId, 'materialesReciclaje', materialEditando.id), {
          nombre: materialNombre.trim(), precioPorKilo: precio,
        });
      } else {
        await addDoc(collection(db, 'yonkes', yonkeId, 'materialesReciclaje'), {
          nombre: materialNombre.trim(), precioPorKilo: precio,
        });
      }
      setMaterialModalVisible(false);
    } catch (error) {
      console.error('[guardarMaterial]', error?.code, error);
      alert(`No se pudo guardar${error?.code ? ` (${error.code})` : ''}`);
    } finally {
      setGuardandoMaterial(false);
    }
  }

  async function eliminarCompra(compra) {
    if (!confirm(`¿Eliminar esta compra${compra.folio ? ` (folio ${compra.folio})` : ''}? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteDoc(doc(db, 'yonkes', yonkeId, 'comprasReciclaje', compra.id));
      if (compraParaTicket?.id === compra.id) setCompraParaTicket(null);
    } catch (error) {
      console.error('[eliminarCompra]', error?.code, error);
      alert(`No se pudo eliminar${error?.code ? ` (${error.code})` : ''}`);
    }
  }

  async function eliminarMaterial(material) {
    if (!confirm(`¿Quitar "${material.nombre}" de tu lista? Las compras ya registradas con este material no se ven afectadas.`)) return;
    try {
      await deleteDoc(doc(db, 'yonkes', yonkeId, 'materialesReciclaje', material.id));
      if (materialSeleccionadoId === material.id) setMaterialSeleccionadoId('');
    } catch (error) {
      console.error(error);
      alert('No se pudo eliminar');
    }
  }

  async function handleLogout() { await signOut(auth); router.push('/panel'); }

  if (loading || !user) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3C5E' }}>
        <p style={{ color: '#fff' }}>Cargando...</p>
      </main>
    );
  }

  const comprasFiltradas = compras.filter((c) => getFecha(c) >= getFechaInicio(periodoActivo));
  const totalPeriodo = comprasFiltradas.reduce((sum, c) => sum + (c.total || 0), 0);
  const desglose = {};
  comprasFiltradas.forEach((c) => {
    conceptosDeCompra(c).forEach((item) => {
      const clave = item.material || '(sin nombre)';
      if (!desglose[clave]) desglose[clave] = { kilos: 0, total: 0 };
      desglose[clave].kilos += item.kilos || 0;
      desglose[clave].total += item.importe || 0;
    });
  });
  const desgloseOrdenado = Object.entries(desglose).sort((a, b) => b[1].total - a[1].total);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
      {/* Imprime SOLO el ticket — ver #ticket-imprimible más abajo. Mismo truco de siempre para
          impresión nativa (window.print) sin abrir ventana aparte: en pantalla el ticket vive
          dentro de un modal normal; al imprimir, todo lo demás se oculta y solo el ticket queda
          visible, ya sin overlay ni botones (esos también se ocultan, ver estilo noImprimirStyle). */}
      <style>{`
        @media print {
          @page { margin: 0; }
          body * { visibility: hidden; }
          #ticket-imprimible, #ticket-imprimible * { visibility: visible; }
          #ticket-imprimible { position: absolute; top: 0; left: 0; width: 80mm; }
          .no-imprimir { display: none !important; }
        }
      `}</style>

      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>♻️ Compra de reciclables</h1>
            <p style={{ color: '#ccc', fontSize: '13px', margin: '2px 0 0' }}>Herramienta interna — tus clientes no ven esto</p>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        <div className="no-imprimir" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[
            { key: 'comprar', label: '🧾 Comprar' },
            { key: 'materiales', label: '⚖️ Materiales' },
            { key: 'reportes', label: '📊 Reportes' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{ ...tabButtonStyle, ...(tab === t.key ? tabButtonActivoStyle : {}) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'comprar' && (
          <div className="no-imprimir" style={sectionStyle}>
            {loadingMateriales ? (
              <p style={{ color: '#888' }}>Cargando materiales...</p>
            ) : materiales.length === 0 ? (
              <p style={{ color: '#888' }}>Todavía no tienes materiales. Ve a la pestaña Materiales para agregar uno.</p>
            ) : (
              <>
                <p style={labelStyle}>Material</p>
                <select
                  value={materialSeleccionadoId}
                  onChange={(e) => setMaterialSeleccionadoId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Selecciona un material</option>
                  {materiales.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} — {m.precioPorKilo ? `${formatoMoneda(m.precioPorKilo)}/kg` : 'sin precio'}
                    </option>
                  ))}
                </select>

                <p style={labelStyle}>Kilos</p>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={kilos}
                  onChange={(e) => setKilos(e.target.value)}
                  placeholder="Ej. 12.5"
                  style={inputStyle}
                />

                {importeConcepto > 0 && (
                  <p style={{ color: '#888', fontSize: '13px', margin: '6px 0 0' }}>
                    Importe de este concepto: <strong style={{ color: '#1A3C5E' }}>{formatoMoneda(importeConcepto)}</strong>
                  </p>
                )}

                <button onClick={agregarConcepto} style={{ ...addButtonStyle, marginTop: '10px' }}>
                  + Agregar concepto
                </button>

                {conceptos.length > 0 && (
                  <>
                    <p style={{ ...seccionTituloStyle, marginTop: '20px' }}>Conceptos de esta compra</p>
                    {conceptos.map((c, i) => (
                      <div key={i} style={compraRowStyle}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E', fontSize: '14px' }}>{c.material}</p>
                          <p style={{ margin: '2px 0 0', color: '#888', fontSize: '12px' }}>
                            {c.kilos} kg × {formatoMoneda(c.precioPorKilo)}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E' }}>{formatoMoneda(c.importe)}</p>
                          <button onClick={() => quitarConcepto(i)} style={ticketBotonStyle}>✕</button>
                        </div>
                      </div>
                    ))}

                    <p style={{ ...labelStyle, marginTop: '20px' }}>Nombre de quien vende *</p>
                    <input
                      type="text"
                      value={vendedorNombre}
                      onChange={(e) => setVendedorNombre(e.target.value)}
                      placeholder="Nombre completo"
                      style={inputStyle}
                    />
                    <p style={labelStyle}>Dirección (opcional)</p>
                    <input
                      type="text"
                      value={vendedorDireccion}
                      onChange={(e) => setVendedorDireccion(e.target.value)}
                      placeholder="Calle, colonia, ciudad"
                      style={inputStyle}
                    />
                    <p style={labelStyle}>RFC (opcional)</p>
                    <input
                      type="text"
                      value={vendedorRfc}
                      onChange={(e) => setVendedorRfc(e.target.value)}
                      style={inputStyle}
                    />
                    <p style={labelStyle}>CURP (opcional)</p>
                    <input
                      type="text"
                      value={vendedorCurp}
                      onChange={(e) => setVendedorCurp(e.target.value)}
                      style={inputStyle}
                    />
                    <p style={labelStyle}>Declaración legal en la nota (opcional, editable)</p>
                    <textarea
                      value={declaracionLegal}
                      onChange={(e) => setDeclaracionLegal(e.target.value)}
                      rows={3}
                      placeholder="Se deja en blanco si no aplica en tu estado"
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                    />

                    <p style={{ ...seccionTituloStyle, marginTop: '20px' }}>Datos fiscales de esta compra</p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={labelStyle}>I.V.A. %</p>
                        <input
                          type="number" min="0" step="0.01" inputMode="decimal"
                          value={ivaPorcentaje} onChange={(e) => setIvaPorcentaje(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={labelStyle}>I.V.A. ret. %</p>
                        <input
                          type="number" min="0" step="0.01" inputMode="decimal"
                          value={ivaRetenidoPorcentaje} onChange={(e) => setIvaRetenidoPorcentaje(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={labelStyle}>I.S.R. %</p>
                        <input
                          type="number" min="0" step="0.01" inputMode="decimal"
                          value={isrPorcentaje} onChange={(e) => setIsrPorcentaje(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '14px', color: '#333', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={incluirAvisoFactura}
                        onChange={(e) => setIncluirAvisoFactura(e.target.checked)}
                      />
                      Incluir aviso de &ldquo;factura provisional&rdquo;
                    </label>

                    <div style={totalBoxStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', padding: '2px 0' }}>
                        <span>Total</span><span>{formatoMoneda(totalCompra)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', padding: '2px 0' }}>
                        <span>I.V.A. {ivaPct}%</span><span>{formatoMoneda(montoIva)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', padding: '2px 0' }}>
                        <span>- I.V.A. Ret. {ivaRetPct}%</span><span>{formatoMoneda(montoIvaRetenido)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', padding: '2px 0' }}>
                        <span>- Retención {isrPct}% I.S.R.</span><span>{formatoMoneda(montoIsr)}</span>
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#888' }}>Neto a pagar</p>
                      <p style={{ margin: '2px 0 0', fontSize: '28px', fontWeight: 'bold', color: '#1A3C5E' }}>
                        {formatoMoneda(netoAPagar)}
                      </p>
                    </div>

                    <button onClick={registrarCompra} disabled={guardandoCompra} style={{ ...primaryButtonStyle, marginTop: '16px' }}>
                      {guardandoCompra ? 'Guardando...' : 'Registrar compra'}
                    </button>
                  </>
                )}
              </>
            )}

            {!loadingCompras && compras.length > 0 && (
              <>
                <p style={{ ...seccionTituloStyle, marginTop: '24px' }}>Últimas compras</p>
                {compras.slice(0, 8).map((c) => (
                  <div key={c.id} style={compraRowStyle}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E', fontSize: '14px' }}>{tituloCompra(c)}</p>
                      <p style={{ margin: '2px 0 0', color: '#888', fontSize: '12px' }}>
                        {c.folio ? `${c.folio} · ` : ''}{subtituloCompra(c)} · {getFecha(c).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E' }}>{formatoMoneda(c.total)}</p>
                      <button onClick={() => setCompraParaTicket(c)} style={ticketBotonStyle}>🖨️</button>
                      <button onClick={() => eliminarCompra(c)} style={eliminarBotonStyle}>🗑️</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'materiales' && (
          <div className="no-imprimir" style={sectionStyle}>
            <button onClick={abrirModalAgregarMaterial} style={{ ...addButtonStyle, marginBottom: '16px' }}>
              + Agregar material
            </button>
            {loadingMateriales ? (
              <p style={{ color: '#888' }}>Cargando...</p>
            ) : materiales.length === 0 ? (
              <p style={{ color: '#888' }}>Sin materiales todavía.</p>
            ) : (
              materiales.map((m) => (
                <div key={m.id} style={compraRowStyle}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E', fontSize: '15px' }}>{m.nombre}</p>
                    <p style={{ margin: '2px 0 0', color: m.precioPorKilo ? '#888' : '#D85A30', fontSize: '13px' }}>
                      {m.precioPorKilo ? `${formatoMoneda(m.precioPorKilo)} / kg` : 'Sin precio — ponle uno para poder comprarlo'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => abrirModalEditarMaterial(m)} style={{ background: 'none', border: 'none', color: '#1A3C5E', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Editar
                    </button>
                    <button onClick={() => eliminarMaterial(m)} style={{ background: 'none', border: 'none', color: '#D85A30', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'reportes' && (
          <div className="no-imprimir">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {[
                { key: 'hoy', label: 'Hoy' },
                { key: 'semana', label: 'Esta semana' },
                { key: 'mes', label: 'Este mes' },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriodoActivo(p.key)}
                  style={{ ...tabButtonStyle, flex: 1, ...(periodoActivo === p.key ? tabButtonActivoStyle : {}) }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div style={{ ...sectionStyle, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>Total pagado</p>
              <p style={{ margin: '4px 0 0', fontSize: '32px', fontWeight: 'bold', color: '#1A3C5E' }}>
                {formatoMoneda(totalPeriodo)}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
                {comprasFiltradas.length} {comprasFiltradas.length === 1 ? 'compra' : 'compras'}
              </p>
            </div>

            {desgloseOrdenado.length > 0 && (
              <>
                <p style={seccionTituloStyle}>Desglose por material</p>
                <div style={sectionStyle}>
                  {desgloseOrdenado.map(([material, datos], i) => (
                    <div key={material} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid #F4F5F5' }}>
                      <p style={{ margin: 0, color: '#333', fontSize: '14px' }}>{material}</p>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, color: '#1A3C5E', fontWeight: 'bold', fontSize: '14px' }}>{formatoMoneda(datos.total)}</p>
                        <p style={{ margin: 0, color: '#888', fontSize: '12px' }}>{datos.kilos.toLocaleString('es-MX')} kg</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <p style={seccionTituloStyle}>Historial del periodo</p>
            {loadingCompras ? (
              <p style={{ color: '#888' }}>Cargando...</p>
            ) : comprasFiltradas.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '16px 0' }}>Sin compras en este periodo</p>
            ) : (
              comprasFiltradas.map((c) => (
                <div key={c.id} style={compraRowStyle}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E', fontSize: '14px' }}>{tituloCompra(c)}</p>
                    <p style={{ margin: '2px 0 0', color: '#888', fontSize: '12px' }}>
                      {c.folio ? `${c.folio} · ` : ''}{subtituloCompra(c)} · {getFecha(c).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E' }}>{formatoMoneda(c.total)}</p>
                    <button onClick={() => setCompraParaTicket(c)} style={ticketBotonStyle}>🖨️</button>
                    <button onClick={() => eliminarCompra(c)} style={eliminarBotonStyle}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal material */}
      {materialModalVisible && (
        <div className="no-imprimir" style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '16px' }}>
              {materialEditando ? 'Editar material' : 'Agregar material'}
            </h2>
            <p style={labelStyle}>Nombre</p>
            <input type="text" value={materialNombre} onChange={(e) => setMaterialNombre(e.target.value)} placeholder="Ej. Aluminio" style={inputStyle} />
            <p style={labelStyle}>Precio por kilo</p>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={materialPrecio} onChange={(e) => setMaterialPrecio(e.target.value)} placeholder="Ej. 35.00" style={inputStyle} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => setMaterialModalVisible(false)} style={secondaryButtonStyle}>Cancelar</button>
              <button onClick={guardarMaterial} disabled={guardandoMaterial} style={primaryButtonStyle}>
                {guardandoMaterial ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ticket */}
      {compraParaTicket && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: '340px' }}>
            <TicketReciclaje compra={compraParaTicket} nombreYonke={nombreYonke} />
            <div className="no-imprimir" style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => setCompraParaTicket(null)} style={secondaryButtonStyle}>Cerrar</button>
              <button onClick={() => window.print()} style={primaryButtonStyle}>🖨️ Imprimir</button>
            </div>
          </div>
        </div>
      )}

      <div className="no-imprimir">
        <BottomNav />
      </div>
    </main>
  );
}

// Ticket angosto tipo impresora térmica (58/80mm) — monoespaciado, sin colores ni imágenes para
// que imprima limpio en térmica de un solo color. `id="ticket-imprimible"` es lo que el CSS de
// @media print de arriba usa para ocultar todo lo demás de la página al imprimir.
function TicketReciclaje({ compra, nombreYonke }) {
  const fecha = getFecha(compra);
  const items = conceptosDeCompra(compra);
  const vendedor = compra.vendedor || {};
  // Compras registradas antes de agregar la sección fiscal no tienen estos campos — el ticket
  // simplemente no muestra el desglose ni el neto (queda igual que antes, solo con el TOTAL).
  const tieneDesgloseFiscal = compra.netoAPagar !== undefined && compra.netoAPagar !== null;
  return (
    <div id="ticket-imprimible" style={ticketStyle}>
      {compra.incluirAvisoFactura && (
        <p style={{ ...ticketLineaStyle, fontSize: '11px', marginBottom: '8px' }}>{AVISO_FACTURA_TEXTO}</p>
      )}
      <p style={ticketCentroStyle}>{nombreYonke || 'Mecanix Yonke Virtual'}</p>
      <p style={ticketCentroStyle}>Compra de material reciclable</p>
      <p style={ticketSepStyle}>--------------------------------</p>
      {compra.folio && <p style={ticketLineaStyle}>Folio: {compra.folio}</p>}
      <p style={ticketLineaStyle}>{fecha.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</p>

      {vendedor.nombre && (
        <>
          <p style={ticketSepStyle}>--------------------------------</p>
          <p style={ticketLineaStyle}>Vendedor: {vendedor.nombre}</p>
          {vendedor.direccion && <p style={ticketLineaStyle}>Dirección: {vendedor.direccion}</p>}
          {vendedor.rfc && <p style={ticketLineaStyle}>RFC: {vendedor.rfc}</p>}
          {vendedor.curp && <p style={ticketLineaStyle}>CURP: {vendedor.curp}</p>}
        </>
      )}

      <p style={ticketSepStyle}>--------------------------------</p>
      <p style={{ ...ticketLineaStyle, fontWeight: 'bold' }}>Descripción · Kg · Importe</p>
      {items.map((it, i) => (
        <div key={i}>
          <p style={ticketLineaStyle}>{it.material}</p>
          <p style={ticketLineaStyle}>{it.kilos} kg × {formatoMoneda(it.precioPorKilo)} = {formatoMoneda(it.importe)}</p>
        </div>
      ))}
      <p style={ticketSepStyle}>--------------------------------</p>
      <p style={tieneDesgloseFiscal ? ticketLineaStyle : ticketTotalStyle}>TOTAL: {formatoMoneda(compra.total)}</p>

      {tieneDesgloseFiscal && (
        <>
          <p style={ticketLineaStyle}>I.V.A. {compra.ivaPorcentaje}%: {formatoMoneda(compra.montoIva)}</p>
          <p style={ticketLineaStyle}>- I.V.A. Ret. {compra.ivaRetenidoPorcentaje}%: {formatoMoneda(compra.montoIvaRetenido)}</p>
          <p style={ticketLineaStyle}>- Retención {compra.isrPorcentaje}% I.S.R.: {formatoMoneda(compra.montoIsr)}</p>
          <p style={ticketSepStyle}>--------------------------------</p>
          <p style={ticketTotalStyle}>NETO A PAGAR: {formatoMoneda(compra.netoAPagar)}</p>
        </>
      )}

      {compra.declaracionLegal && (
        <>
          <p style={ticketSepStyle}>--------------------------------</p>
          <p style={{ ...ticketLineaStyle, fontSize: '11px' }}>{compra.declaracionLegal}</p>
        </>
      )}
    </div>
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
const primaryButtonStyle = {
  flex: 1, padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C',
  color: '#fff', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
};
const secondaryButtonStyle = {
  flex: 1, padding: '14px', borderRadius: '10px', border: '1.5px solid #1A3C5E',
  backgroundColor: '#fff', color: '#1A3C5E', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
};
const addButtonStyle = {
  width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#1A3C5E',
  color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer',
};
const tabButtonStyle = {
  flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#fff',
  color: '#666', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
};
const tabButtonActivoStyle = {
  backgroundColor: '#1A3C5E', color: '#fff', border: '1px solid #1A3C5E',
};
const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000,
};
const modalStyle = {
  backgroundColor: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%',
  maxHeight: '85vh', overflowY: 'auto',
};
const seccionTituloStyle = {
  fontSize: '14px', fontWeight: 'bold', color: '#1A3C5E', margin: '20px 0 10px',
};
const compraRowStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  backgroundColor: '#fff', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};
const totalBoxStyle = {
  backgroundColor: '#F4F5F5', borderRadius: '10px', padding: '14px', marginTop: '16px', textAlign: 'center',
};
const ticketBotonStyle = {
  background: 'none', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '15px',
};
const eliminarBotonStyle = {
  background: 'none', border: '1px solid #F3C7BB', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '15px',
};
const ticketStyle = {
  fontFamily: "'Courier New', Courier, monospace", width: '280px', maxWidth: '100%', margin: '0 auto',
  color: '#000', backgroundColor: '#fff', fontSize: '13px', lineHeight: '1.5',
};
const ticketCentroStyle = { textAlign: 'center', fontWeight: 'bold', margin: '2px 0' };
const ticketSepStyle = { margin: '4px 0', overflow: 'hidden', whiteSpace: 'nowrap' };
const ticketLineaStyle = { margin: '2px 0' };
const ticketTotalStyle = { margin: '4px 0', fontWeight: 'bold', fontSize: '15px' };
