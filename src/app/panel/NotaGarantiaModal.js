'use client';

// Modal compartido para generar/reimprimir una nota de garantía a partir de una venta ya
// registrada (panel/venta-manual y panel/ventas) — un solo componente para que los dos no se
// desincronicen. Reutiliza el mismo truco de impresión que el ticket de reciclaje
// (panel/reciclaje/page.js): window.print() nativo + CSS @media print que oculta todo menos
// #ticket-imprimible, sin ventana aparte ni Bluetooth.

import { useState, useEffect } from 'react';
import {
  collection, query, where, limit, getDocs, addDoc, updateDoc, doc, getDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GARANTIA_DIAS_DEFAULT, GARANTIA_QUE_CUBRE_DEFAULT, GARANTIA_QUE_NO_CUBRE_DEFAULT } from '../lib/garantiaDefault';

function getFechaDe(valor) {
  return valor?.toDate ? valor.toDate() : new Date(valor);
}

function formatearFecha(fecha) {
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatoMoneda(n) {
  return (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

// venta: { id, numeroPedido, piezaVendida, vehiculo:{marca,modelo,ano}, monto, fecha, nombreCliente? }
export default function NotaGarantiaModal({ venta, yonkeId, nombreYonke, logoUrl, onClose }) {
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState('formulario'); // 'formulario' | 'ticket'
  const [notaId, setNotaId] = useState(null);

  const [nombreCliente, setNombreCliente] = useState(venta.nombreCliente || '');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [dias, setDias] = useState(String(GARANTIA_DIAS_DEFAULT));
  const [queCubre, setQueCubre] = useState(GARANTIA_QUE_CUBRE_DEFAULT);
  const [queNoCubre, setQueNoCubre] = useState(GARANTIA_QUE_NO_CUBRE_DEFAULT);
  const [fechaVencimiento, setFechaVencimiento] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Carga, EN PARALELO: (a) la configuración de garantía del yonke, para precargar días/textos
  // por defecto, y (b) si esta venta YA tiene una nota generada — de ser así, se salta el
  // formulario y va directo a la vista de impresión (reimprimir sin volver a capturar nada).
  useEffect(() => {
    let activo = true;
    async function cargar() {
      try {
        const [yonkeSnap, notasSnap] = await Promise.all([
          getDoc(doc(db, 'yonkes', yonkeId)),
          getDocs(query(
            collection(db, 'yonkes', yonkeId, 'notasGarantia'),
            where('ventaId', '==', venta.id),
            limit(1),
          )),
        ]);
        if (!activo) return;
        const g = yonkeSnap.exists() ? (yonkeSnap.data().garantia || {}) : {};
        const diasDefault = g.diasDefault || GARANTIA_DIAS_DEFAULT;
        const cubreDefault = g.queCubre || GARANTIA_QUE_CUBRE_DEFAULT;
        const noCubreDefault = g.queNoCubre || GARANTIA_QUE_NO_CUBRE_DEFAULT;

        if (!notasSnap.empty) {
          const notaDoc = notasSnap.docs[0];
          const nota = notaDoc.data();
          setNotaId(notaDoc.id);
          setNombreCliente(nota.nombreCliente || '');
          setTelefonoCliente(nota.telefonoCliente || '');
          setDias(String(nota.diasGarantia || diasDefault));
          setQueCubre(nota.queCubre || cubreDefault);
          setQueNoCubre(nota.queNoCubre || noCubreDefault);
          setFechaVencimiento(getFechaDe(nota.fechaVencimiento));
          setModo('ticket');
        } else {
          setDias(String(diasDefault));
          setQueCubre(cubreDefault);
          setQueNoCubre(noCubreDefault);
        }
      } catch (error) {
        console.error('[NotaGarantiaModal] No se pudo cargar', error);
      } finally {
        if (activo) setCargando(false);
      }
    }
    cargar();
    return () => { activo = false; };
  }, [yonkeId, venta.id]);

  async function generarNota() {
    const diasNum = parseInt(dias, 10);
    if (!diasNum || diasNum <= 0) { alert('Escribe un número de días válido'); return; }
    setGuardando(true);
    try {
      const fechaVenta = getFechaDe(venta.fecha);
      const vencimiento = new Date(fechaVenta);
      vencimiento.setDate(vencimiento.getDate() + diasNum);

      // queCubre/queNoCubre se guardan COMO ESTÁN en este momento (snapshot) — igual que
      // precioPorKilo en reciclaje: si el yonke edita sus condiciones después en Perfil, esta
      // nota ya generada no cambia retroactivamente.
      const datos = {
        ventaId: venta.id,
        numeroPedido: venta.numeroPedido || null,
        piezaVendida: venta.piezaVendida || null,
        vehiculo: venta.vehiculo || null,
        monto: venta.monto || 0,
        fechaVenta: getFechaDe(venta.fecha),
        nombreCliente: nombreCliente.trim(),
        telefonoCliente: telefonoCliente.trim(),
        diasGarantia: diasNum,
        fechaVencimiento: Timestamp.fromDate(vencimiento),
        queCubre: queCubre.trim(),
        queNoCubre: queNoCubre.trim(),
        fechaGeneracion: new Date(),
      };
      if (notaId) {
        await updateDoc(doc(db, 'yonkes', yonkeId, 'notasGarantia', notaId), datos);
      } else {
        const ref = await addDoc(collection(db, 'yonkes', yonkeId, 'notasGarantia'), datos);
        setNotaId(ref.id);
      }
      setFechaVencimiento(vencimiento);
      setModo('ticket');
    } catch (error) {
      console.error('[generarNota]', error?.code, error);
      alert(`No se pudo guardar la nota${error?.code ? ` (${error.code})` : ''}`);
    } finally {
      setGuardando(false);
    }
  }

  const vehiculoTexto = [venta.vehiculo?.marca, venta.vehiculo?.modelo, venta.vehiculo?.ano].filter(Boolean).join(' ');

  return (
    <div style={overlayStyle}>
      <style>{`
        @media print {
          @page { margin: 10mm; }
          body * { visibility: hidden; }
          #ticket-imprimible, #ticket-imprimible * { visibility: visible; }
          #ticket-imprimible { position: absolute; top: 0; left: 0; width: 100%; }
          .no-imprimir { display: none !important; }
        }
      `}</style>
      <div style={modalStyle}>
        {cargando ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '20px 0' }}>Cargando...</p>
        ) : modo === 'formulario' ? (
          <>
            <h2 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '4px' }}>Nota de garantía</h2>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
              {venta.piezaVendida} — {vehiculoTexto || 'Sin vehículo'} · {formatoMoneda(venta.monto)}
            </p>

            <p style={labelStyle}>Nombre del cliente</p>
            <input type="text" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} placeholder="Nombre completo" style={inputStyle} />

            <p style={labelStyle}>Teléfono (opcional)</p>
            <input type="tel" value={telefonoCliente} onChange={(e) => setTelefonoCliente(e.target.value)} placeholder="664 000 0000" style={inputStyle} />

            <p style={labelStyle}>Días de garantía</p>
            <input type="number" min="1" inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} style={{ ...inputStyle, maxWidth: '140px' }} />

            <p style={labelStyle}>Qué cubre</p>
            <textarea value={queCubre} onChange={(e) => setQueCubre(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />

            <p style={labelStyle}>Qué NO cubre</p>
            <textarea value={queNoCubre} onChange={(e) => setQueNoCubre(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={onClose} style={secondaryButtonStyle}>Cancelar</button>
              <button onClick={generarNota} disabled={guardando} style={primaryButtonStyle}>
                {guardando ? 'Guardando...' : 'Generar nota'}
              </button>
            </div>
          </>
        ) : (
          <>
            <NotaImprimible
              venta={venta} nombreYonke={nombreYonke} logoUrl={logoUrl}
              nombreCliente={nombreCliente} telefonoCliente={telefonoCliente}
              dias={dias} fechaVencimiento={fechaVencimiento}
              queCubre={queCubre} queNoCubre={queNoCubre}
            />
            <div className="no-imprimir" style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={onClose} style={secondaryButtonStyle}>Cerrar</button>
              <button onClick={() => setModo('formulario')} style={secondaryButtonStyle}>Editar</button>
              <button onClick={() => window.print()} style={primaryButtonStyle}>🖨️ Imprimir</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Documento imprimible, más completo que el ticket angosto de reciclaje (esto es una nota con
// validez legal/comercial para el cliente, no un comprobante rápido) pero con el mismo espíritu:
// fuente clara, sin depender de imágenes que no sean el logo, y `id="ticket-imprimible"` para
// que el CSS de impresión del modal la aísle del resto de la pantalla.
function NotaImprimible({ venta, nombreYonke, logoUrl, nombreCliente, telefonoCliente, dias, fechaVencimiento, queCubre, queNoCubre }) {
  const fechaVenta = getFechaDe(venta.fecha);
  const vehiculoTexto = [venta.vehiculo?.marca, venta.vehiculo?.modelo, venta.vehiculo?.ano].filter(Boolean).join(' ');
  return (
    <div id="ticket-imprimible" style={notaStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '2px solid #1A3C5E', paddingBottom: '10px', marginBottom: '14px' }}>
        {logoUrl && <img src={logoUrl} alt={nombreYonke} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />}
        <div>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '17px', color: '#1A3C5E' }}>{nombreYonke || 'Mecanix Yonke Virtual'}</p>
          <p style={{ margin: '2px 0 0', fontWeight: 'bold', fontSize: '13px', letterSpacing: '1px', color: '#555' }}>NOTA DE GARANTÍA</p>
        </div>
      </div>

      <FilaNota etiqueta="Folio" valor={venta.numeroPedido || '—'} />
      <FilaNota etiqueta="Fecha de venta" valor={formatearFecha(fechaVenta)} />
      <FilaNota etiqueta="Pieza" valor={venta.piezaVendida || '—'} />
      <FilaNota etiqueta="Vehículo" valor={vehiculoTexto || '—'} />
      <FilaNota etiqueta="Precio" valor={formatoMoneda(venta.monto)} />
      <FilaNota etiqueta="Cliente" valor={nombreCliente || '—'} />
      {telefonoCliente && <FilaNota etiqueta="Teléfono" valor={telefonoCliente} />}

      <div style={{ backgroundColor: '#F4F5F5', borderRadius: '8px', padding: '10px 12px', margin: '12px 0' }}>
        <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E', fontSize: '14px' }}>
          Garantía de {dias} días — válida hasta {fechaVencimiento ? formatearFecha(fechaVencimiento) : '—'}
        </p>
      </div>

      <p style={{ margin: '10px 0 2px', fontWeight: 'bold', fontSize: '12px', color: '#1A3C5E' }}>Qué cubre</p>
      <p style={{ margin: 0, fontSize: '12px', color: '#333', lineHeight: '1.5' }}>{queCubre}</p>

      <p style={{ margin: '10px 0 2px', fontWeight: 'bold', fontSize: '12px', color: '#1A3C5E' }}>Qué NO cubre</p>
      <p style={{ margin: 0, fontSize: '12px', color: '#333', lineHeight: '1.5' }}>{queNoCubre}</p>

      <div style={{ display: 'flex', gap: '24px', marginTop: '36px' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #333', paddingTop: '4px', fontSize: '11px', color: '#555' }}>Firma del cliente</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #333', paddingTop: '4px', fontSize: '11px', color: '#555' }}>Firma / sello del yonke</div>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: '10px', color: '#aaa', marginTop: '20px' }}>Generado con Mecanix Yonke Virtual</p>
    </div>
  );
}

function FilaNota({ etiqueta, valor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
      <span style={{ color: '#888' }}>{etiqueta}</span>
      <span style={{ color: '#1A3C5E', fontWeight: '600', textAlign: 'right' }}>{valor}</span>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000,
};
const modalStyle = {
  backgroundColor: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '440px', width: '100%',
  maxHeight: '90vh', overflowY: 'auto',
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
const notaStyle = {
  fontFamily: "'Inter', Arial, sans-serif", width: '340px', maxWidth: '100%', margin: '0 auto', color: '#000',
};
