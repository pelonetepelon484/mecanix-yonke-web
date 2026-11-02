'use client';

// Alguien reclama que el WhatsApp de este yonke no es del dueño de la cuenta. Desactiva la cuenta
// primero (ya no puede responder) y luego retira sus respuestas en búsquedas sin vencer, una por una
// para saber cuál falló. Borrar el yonke y liberar el número sigue siendo aparte, ya comprobado el reclamo.
import { useState } from 'react';
import { MOTIVO_NUMERO_AJENO } from '../../../../lib/retiroRespuestas';
import { AvisosRetiro } from '../../pedidos/RespuestasAdmin';
import { buscarRespuestasDeYonke, desactivarYonke, quitarRespuesta } from '../../pedidos/datos';

const PASOS = [
  'Quien reclama te escribe a contacto@mecanixyonkevirtual.com o por WhatsApp.',
  'Pídele que te escriba desde ese número, para comprobar que lo controla.',
  'Usa el botón de abajo: desactiva la cuenta y retira sus respuestas.',
  'Contacta al dueño de la cuenta por otro medio, si lo hay, y dale oportunidad de aclarar.',
  'Si el reclamo es cierto, elimina el yonke desde la lista: eso libera el número. Si no, vuelve a activarlo.',
];

const clave = ({ coleccion, pedido }) => `${coleccion}/${pedido.id}`;
const elegidaPorTaller = ({ pedido }, yonkeId) => pedido.yonkeElegido === yonkeId;

export default function ReclamoNumero({ yonkeId, onDesactivado }) {
  const [respuestas, setRespuestas] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [retiradas, setRetiradas] = useState([]);
  const [fallidas, setFallidas] = useState([]);
  const [desactivado, setDesactivado] = useState(false);
  const [error, setError] = useState('');

  async function buscar() {
    setTrabajando(true);
    setError('');
    try {
      setRespuestas(await buscarRespuestasDeYonke(yonkeId));
    } catch (err) {
      console.error(err);
      setError('No pudimos buscar sus respuestas.');
    } finally {
      setTrabajando(false);
    }
  }

  async function atender() {
    if (!window.confirm('¿Desactivar esta cuenta y retirar sus respuestas con el motivo "Número ajeno"?\n\nHazlo solo si quien reclama te escribió desde ese número.')) return;
    setTrabajando(true);
    setError('');
    try {
      await desactivarYonke(yonkeId);
      setDesactivado(true);
      onDesactivado();
    } catch (err) {
      console.error(err);
      setError('No se pudo desactivar la cuenta. No se retiró ninguna respuesta.');
      setTrabajando(false);
      return;
    }
    const hechas = [];
    const fallos = [];
    for (const item of respuestas.filter((i) => !elegidaPorTaller(i, yonkeId))) {
      try {
        await quitarRespuesta(item.coleccion, item.pedido.id, item.respuesta, MOTIVO_NUMERO_AJENO);
        hechas.push(item);
      } catch (err) {
        console.error(err);
        fallos.push(item);
      }
    }
    setRetiradas(hechas);
    setFallidas(fallos);
    setRespuestas(respuestas.filter((i) => !hechas.includes(i)));
    setTrabajando(false);
  }

  const pendientes = (respuestas || []).filter((i) => !elegidaPorTaller(i, yonkeId));
  const elegidas = (respuestas || []).filter((i) => elegidaPorTaller(i, yonkeId));

  return (
    <div style={{ fontSize: '13px', color: '#333' }}>
      <ol style={{ margin: '0 0 10px', paddingLeft: '20px', lineHeight: '1.5' }}>
        {PASOS.map((paso) => <li key={paso}>{paso}</li>)}
      </ol>
      {respuestas === null ? (
        <button type="button" disabled={trabajando} onClick={buscar} style={boton('#1A3C5E')}>{trabajando ? 'Buscando...' : 'Ver sus respuestas'}</button>
      ) : (
        <>
          <p style={{ margin: '0 0 6px', fontWeight: 'bold' }}>Respuestas en búsquedas sin vencer: {pendientes.length}</p>
          {pendientes.map((item) => <p key={clave(item)} style={{ margin: '0 0 4px' }}>{item.pedido.pieza}</p>)}
          {elegidas.map((item) => (
            <p key={clave(item)} style={{ margin: '0 0 4px', color: '#B3261E' }}>{item.pedido.pieza}: el taller ya la eligió y no se puede retirar. Avísale directamente.</p>
          ))}
          {!desactivado && <button type="button" disabled={trabajando} onClick={atender} style={boton('#B3261E')}>{trabajando ? 'Trabajando...' : 'Desactivar y retirar respuestas'}</button>}
          {desactivado && !trabajando && fallidas.length === 0 && <p role="status" style={{ margin: '6px 0', color: '#2E7D32', fontWeight: 'bold' }}>Cuenta desactivada. Respuestas retiradas: {retiradas.length}.</p>}
          {fallidas.length > 0 && (
            <>
              <p role="alert" style={{ margin: '6px 0', color: '#B3261E' }}>La cuenta quedó desactivada, pero {fallidas.length} respuesta(s) no se pudieron retirar.</p>
              <button type="button" disabled={trabajando} onClick={atender} style={boton('#B3261E')}>Reintentar</button>
            </>
          )}
        </>
      )}
      {retiradas.map((item) => (
        <AvisosRetiro key={clave(item)} coleccion={item.coleccion} pedido={item.pedido} retiro={{ ...item.respuesta, motivo: MOTIVO_NUMERO_AJENO }} />
      ))}
      {error && <p role="alert" style={{ margin: '6px 0 0', color: '#B3261E' }}>{error}</p>}
    </div>
  );
}

const boton = (color) => ({ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: 'none', backgroundColor: color, color: '#fff', fontWeight: 'bold', cursor: 'pointer' });
