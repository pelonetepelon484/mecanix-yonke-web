'use client';

import { useState } from 'react';
import { csvHistorial, nombreCsvHistorial } from '../../../../lib/exportarHistorial';
import { guardarCsv, listarTodosLosVehiculos, msOVacio } from './datos';

// "Descargar mi historial": un archivo CSV con los servicios y los recordatorios pendientes de
// todos los vehículos, sin datos del cliente. Disponible siempre que se ve el historial (bandera
// encendida y dueño), aunque el Premium haya vencido o falte aceptar los términos, igual que borrar.
export default function DescargarHistorial({ tallerId, fuentes = null }) {
  const [preparando, setPreparando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const f = fuentes ?? { listar: listarTodosLosVehiculos, guardar: guardarCsv };

  async function descargar() {
    setPreparando(true);
    setMensaje('');
    try {
      const vehiculos = await f.listar(tallerId);
      if (vehiculos.length === 0) { setMensaje('Todavía no tienes vehículos en tu historial.'); return; }
      f.guardar(csvHistorial(vehiculos, msOVacio), nombreCsvHistorial());
      setMensaje(`Listo: ${vehiculos.length} vehículo(s) en el archivo.`);
    } catch (err) {
      console.error(err);
      setMensaje('No pudimos preparar tu historial. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setPreparando(false);
    }
  }

  return (
    <div style={{ margin: '0 0 14px' }}>
      <button type="button" onClick={descargar} disabled={preparando} style={boton}>
        {preparando ? 'Preparando...' : '⬇️ Descargar mi historial'}
      </button>
      <p style={{ fontSize: '12px', color: '#555', margin: '4px 0 0' }}>
        Archivo CSV (se abre en Excel o Google Sheets) con servicios y recordatorios pendientes; sin datos de tus clientes.
      </p>
      {mensaje && <p role="status" style={{ fontSize: '13px', color: '#1A3C5E', margin: '4px 0 0' }}>{mensaje}</p>}
    </div>
  );
}

const boton = { width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' };
