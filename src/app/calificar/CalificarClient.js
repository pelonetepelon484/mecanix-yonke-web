'use client';

import { useState } from 'react';
import {
  collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { idVentaPublica } from '../../lib/ventasPublicas';

export default function CalificarClient() {
  const [numeroPedido, setNumeroPedido] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [venta, setVenta] = useState(null);
  const [yaBuscado, setYaBuscado] = useState(false);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function buscarPedido() {
    if (!numeroPedido.trim()) {
      alert('Escribe tu número de pedido');
      return;
    }
    setBuscando(true);
    setYaBuscado(true);
    setVenta(null);

    try {
      // ventasPublicas/{folio}: copia mínima y no personal de la venta (ver src/lib/ventasPublicas.ts).
      // `ventas` es privada del yonke dueño y del admin, por eso esta página ya no la consulta.
      const folio = idVentaPublica(numeroPedido);
      const publicaSnap = folio ? await getDoc(doc(db, 'ventasPublicas', folio)) : null;

      if (publicaSnap && publicaSnap.exists()) {
        const ventaData = publicaSnap.data();

        const califRef = collection(db, 'calificaciones');
        const qCalif = query(califRef, where('ventaId', '==', ventaData.ventaId));
        const califSnap = await getDocs(qCalif);

        setVenta({ ...ventaData, id: ventaData.ventaId, yaCalificado: !califSnap.empty });
      }
    } catch (error) {
      console.error(error);
      alert('Hubo un error al buscar tu pedido');
    } finally {
      setBuscando(false);
    }
  }

  async function enviarCalificacion() {
    if (estrellas === 0) {
      alert('Selecciona cuántas estrellas quieres dar');
      return;
    }
    setEnviando(true);
    try {
      await addDoc(collection(db, 'calificaciones'), {
        ventaId: venta.id,
        yonkeId: venta.yonkeId,
        estrellas,
        comentario: comentario.trim(),
        fecha: new Date(),
      });

      setEnviado(true);
    } catch (error) {
      console.error(error);
      alert('Hubo un error al enviar tu calificación');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '24px 16px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/mecanix-logo.webp"
            alt="Mecanix"
            style={{ width: '240px', maxWidth: '100%', margin: '0 auto', display: 'block' }}
          />
          <p style={{ fontSize: '14px', color: '#E8720C', letterSpacing: '2px', marginTop: '8px', fontWeight: 'bold' }}>
            CALIFICA TU EXPERIENCIA
          </p>
        </div>

        {!venta?.yaCalificado && !enviado && (
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', color: '#1A3C5E', marginBottom: '16px', fontWeight: 'bold' }}>
              Ingresa tu número de pedido
            </h2>
            <input
              type="text"
              placeholder="Ej. MYV-0615-1234"
              value={numeroPedido}
              onChange={(e) => setNumeroPedido(e.target.value)}
              style={inputStyle}
            />
            <button onClick={buscarPedido} disabled={buscando} style={buttonStyle}>
              {buscando ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        )}

        {yaBuscado && !buscando && !venta && (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '20px', fontSize: '14px' }}>
            No encontramos ese número de pedido. Verifica que esté correcto.
          </p>
        )}

        {venta?.yaCalificado && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p style={{ fontSize: '40px', margin: 0 }}>✅</p>
            <p style={{ color: '#1A3C5E', fontWeight: 'bold', marginTop: '8px' }}>
              Ya calificaste este pedido. ¡Gracias!
            </p>
          </div>
        )}

        {venta && !venta.yaCalificado && !enviado && (
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '24px', marginTop: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '15px', color: '#1A3C5E', fontWeight: 'bold', margin: 0 }}>
              {venta.piezaVendida}
            </p>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>
              {venta.vehiculo?.marca} {venta.vehiculo?.modelo} {venta.vehiculo?.ano}
            </p>

            <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
              ¿Cómo fue tu experiencia?
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  onClick={() => setEstrellas(n)}
                  style={{
                    fontSize: '36px',
                    cursor: 'pointer',
                    color: n <= estrellas ? '#E8720C' : '#ddd',
                  }}
                >
                  ★
                </span>
              ))}
            </div>

            <textarea
              placeholder="Cuéntanos más (opcional)"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              style={{ ...inputStyle, minHeight: '80px', resize: 'none' }}
            />

            <button onClick={enviarCalificacion} disabled={enviando} style={buttonStyle}>
              {enviando ? 'Enviando...' : 'Enviar calificación'}
            </button>
          </div>
        )}

        {enviado && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p style={{ fontSize: '40px', margin: 0 }}>🎉</p>
            <p style={{ color: '#1A3C5E', fontWeight: 'bold', marginTop: '8px', fontSize: '16px' }}>
              ¡Gracias por tu calificación!
            </p>
            <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
              Tu opinión ayuda a otros clientes
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

const inputStyle = {
  width: '100%',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #ddd',
  marginBottom: '12px',
  fontSize: '15px',
  backgroundColor: '#F4F5F5',
  color: '#333',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const buttonStyle = {
  width: '100%',
  padding: '14px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#E8720C',
  color: '#fff',
  fontWeight: 'bold',
  fontSize: '15px',
  cursor: 'pointer',
  marginTop: '4px',
};