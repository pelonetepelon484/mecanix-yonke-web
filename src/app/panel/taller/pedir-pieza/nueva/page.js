'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePedirPieza } from '../contexto';
import { crearSolicitud } from '../datos';
import SelectorMarcaModelo from '../../../../lib/SelectorMarcaModelo';
import { ESTADO_DEFAULT, cargarEstados } from '../../../../lib/estados';
import { MENSAJES_SOLICITUD, validarSolicitud } from '../../../../../lib/solicitudesPiezas';

const inputBase = {
  width: '100%', boxSizing: 'border-box', padding: '14px', fontSize: '16px', borderRadius: '10px',
  border: '1px solid #CCC', backgroundColor: '#fff', marginBottom: '10px',
};
const etiqueta = { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px', fontWeight: 'bold' };
const seccion = { backgroundColor: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '14px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' };
const botonGrande = { minHeight: '52px', padding: '0 18px', borderRadius: '12px', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' };

export default function NuevaSolicitudPieza() {
  const router = useRouter();
  const { tallerId, taller } = usePedirPieza();
  const [estados, setEstados] = useState([{ id: ESTADO_DEFAULT, nombre: 'Baja California' }]);
  const [estado, setEstado] = useState(ESTADO_DEFAULT);
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState('');
  const [pieza, setPieza] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    cargarEstados().then(setEstados).catch(() => {});
  }, []);

  async function enviar() {
    setError('');
    const datos = {
      vehiculo: { marca: marca.trim(), modelo: modelo.trim(), anio: anio.trim() === '' ? Number.NaN : Number(anio) },
      pieza: pieza.trim(),
      nota: nota.trim(),
    };
    const problema = validarSolicitud(datos);
    if (problema) { setError(problema); return; }
    if (!taller) return;
    setEnviando(true);
    try {
      const id = await crearSolicitud({
        tallerId, tallerNombre: taller.nombre, tallerWhatsapp: taller.whatsapp,
        estado, vehiculo: datos.vehiculo, pieza: datos.pieza, nota: datos.nota,
      });
      router.replace(`/panel/taller/pedir-pieza/${id}`);
    } catch (err) {
      console.error(err);
      setError(MENSAJES_SOLICITUD.guardarFallo);
    } finally {
      setEnviando(false);
    }
  }

  if (taller && !taller.activo) {
    return (
      <main style={{ minHeight: '100vh', padding: '24px' }}>
        <p role="alert" style={{ color: '#8A2A1A' }}>Tu taller está desactivado: no puedes pedir piezas nuevas.</p>
        <button onClick={() => router.push('/panel/taller/pedir-pieza')}>Volver</button>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '4px 0 14px' }}>Pedir una pieza</h1>

        <div style={seccion}>
          <p style={{ margin: '0 0 10px', fontWeight: 'bold', color: '#1A3C5E' }}>Vehículo</p>
          <SelectorMarcaModelo
            marca={marca} modelo={modelo}
            onMarca={setMarca} onModelo={setModelo}
            inputStyle={inputBase} selectStyle={inputBase}
          />
          <label style={etiqueta}>Año</label>
          <input type="number" inputMode="numeric" value={anio} onChange={(e) => setAnio(e.target.value)} style={inputBase} />
        </div>

        <div style={seccion}>
          <label style={etiqueta}>Pieza que buscas</label>
          <input value={pieza} onChange={(e) => setPieza(e.target.value)} placeholder="Ej. Defensa delantera" style={inputBase} />
          <label style={etiqueta}>Nota (opcional)</label>
          <textarea rows={3} maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} style={{ ...inputBase, resize: 'vertical' }} />
          <label style={etiqueta}>¿En qué estado buscas la pieza?</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} style={inputBase}>
            {estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>

        {error && <p role="alert" style={{ ...seccion, color: '#B3261E', fontSize: '14px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="button" onClick={() => router.push('/panel/taller/pedir-pieza')} style={{ ...botonGrande, flex: 1, backgroundColor: '#EEF1F5', color: '#333' }}>
            Cancelar
          </button>
          <button type="button" onClick={enviar} disabled={enviando} style={{ ...botonGrande, flex: 1, backgroundColor: '#1A3C5E', color: '#fff', opacity: enviando ? 0.6 : 1 }}>
            {enviando ? 'Enviando...' : 'Enviar pedido'}
          </button>
        </div>
      </div>
    </main>
  );
}
