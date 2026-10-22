'use client';

// "Seguimiento en línea" en el detalle de la orden (etapa 1). Bandera: config/ordenes.seguimientoHabilitado.
// - Solo órdenes creadas con un aviso que incluye el seguimiento (ordenConSeguimiento); las
//   anteriores muestran una nota que lo explica.
// - Activar (o reactivar con un token nuevo): Premium vigente SIEMPRE, taller activo, términos
//   vigentes y bandera (las reglas exigen lo mismo).
// - Activo: enlace, "Compartir por WhatsApp" (con el teléfono que la orden ya tiene en pantalla; sin
//   él, WhatsApp abre para elegir contacto; no se guarda nada), "Copiar enlace", nota pública y
//   "Desactivar enlace" (este último sin Premium ni términos vigentes, igual que con la bandera apagada).
import { useEffect, useState } from 'react';
import { ordenConSeguimiento } from '../../../../lib/avisoOrden';
import { esPremiumVigente } from '../../../../lib/planes';
import {
  ADVERTENCIA_ENLACE_SEGUIMIENTO, ADVERTENCIA_NOTA_SEGUIMIENTO, MAX_NOTA_SEGUIMIENTO, MENSAJES_SEGUIMIENTO,
  enlaceCompartirSeguimiento, enlaceSeguimiento, validarNotaSeguimiento, venceSeguimiento,
} from '../../../../lib/seguimiento';
import { activarSeguimiento, desactivarSeguimiento, guardarNotaSeguimiento, leerSeguimiento } from './datos';

const caja = { backgroundColor: '#fff', border: '1px solid #DDE3EA', borderRadius: '12px', padding: '14px', margin: '0 0 14px' };
const boton = { width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' };
const botonPrincipal = { ...boton, backgroundColor: '#1A3C5E', color: '#fff' };
const nota = { fontSize: '13px', color: '#555', margin: '6px 0 0', lineHeight: 1.5 };
const aFecha = (v) => (v?.toDate ? v.toDate() : v instanceof Date ? v : null);
const formatoFecha = (f) => f.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

export default function SeguimientoOrden({ tallerId, taller, folio, orden, configOrdenes, puedeEditar, vencida, onCambio }) {
  const habilitada = configOrdenes?.seguimientoHabilitado === true;
  const token = orden?.seguimientoToken || null;
  const [seguimiento, setSeguimiento] = useState(undefined); // undefined = cargando
  const [ahora, setAhora] = useState(0); // hora de la carga (no se lee el reloj al pintar)
  const [texto, setTexto] = useState(orden?.notaSeguimiento ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    Promise.resolve(token ? leerSeguimiento(token) : null)
      .catch((err) => { console.error(err); return null; })
      .then((s) => { if (!cancelado) { setAhora(Date.now()); setSeguimiento(s); } });
    return () => { cancelado = true; };
  }, [token]);

  // Bandera apagada y sin enlace: no aparece nada (como antes).
  if (!habilitada && !token) return null;
  if (!ordenConSeguimiento(orden?.avisoVersion)) {
    if (!habilitada) return null;
    return (
      <section aria-label="Seguimiento en línea" style={caja}>
        <h2 style={{ fontSize: '17px', color: '#1A3C5E', margin: '0 0 6px' }}>Seguimiento en línea</h2>
        <p data-testid="seguimiento-anterior" style={nota}>{MENSAJES_SEGUIMIENTO.anteriorAlAviso}</p>
      </section>
    );
  }
  if (seguimiento === undefined) return null;

  const vence = aFecha(seguimiento?.expiraAt);
  const activo = Boolean(seguimiento) && vence !== null && vence.getTime() > ahora;
  const premium = esPremiumVigente(taller, new Date(ahora));
  const venceSiActiva = venceSeguimiento(orden?.expiraAt, orden?.primeraEntregaAt ?? null, new Date(ahora));
  const plazoVencido = venceSiActiva !== null && venceSiActiva.getTime() <= ahora;
  const puedeActivar = habilitada && puedeEditar && premium && !vencida && !plazoVencido;

  async function activar() {
    setOcupado(true); setError(''); setAviso('');
    try {
      await activarSeguimiento({ tallerId, folio, taller });
      setAviso('Enlace de seguimiento activado.');
      onCambio?.();
    } catch (err) {
      setError(err.message || MENSAJES_SEGUIMIENTO.fallo);
    } finally {
      setOcupado(false);
    }
  }

  async function desactivar() {
    if (!window.confirm('¿Desactivar el enlace de seguimiento? Quien lo tenga ya no podrá abrirlo.')) return;
    setOcupado(true); setError(''); setAviso('');
    try {
      await desactivarSeguimiento(token);
      setSeguimiento(null);
      setAviso('Enlace desactivado.');
    } catch (err) {
      console.error(err);
      setError(MENSAJES_SEGUIMIENTO.desactivarFallo);
    } finally {
      setOcupado(false);
    }
  }

  async function guardarNota() {
    const problema = validarNotaSeguimiento(texto);
    if (problema) { setError(problema); return; }
    setOcupado(true); setError(''); setAviso('');
    try {
      await guardarNotaSeguimiento({ tallerId, folio, nota: texto, taller });
      setAviso('Nota guardada.');
      onCambio?.();
    } catch (err) {
      setError(err.message || MENSAJES_SEGUIMIENTO.fallo);
    } finally {
      setOcupado(false);
    }
  }

  async function copiar(enlace) {
    try {
      await navigator.clipboard.writeText(enlace);
      setAviso('Enlace copiado.');
    } catch {
      setAviso('No pudimos copiarlo: mantén presionado el enlace para copiarlo.');
    }
  }

  const razonSinActivar = !habilitada ? null
    : !premium ? MENSAJES_SEGUIMIENTO.sinPremium
      : plazoVencido ? MENSAJES_SEGUIMIENTO.vencido
        : null;

  return (
    <section aria-label="Seguimiento en línea" style={caja}>
      <h2 style={{ fontSize: '17px', color: '#1A3C5E', margin: '0 0 6px' }}>Seguimiento en línea</h2>
      {aviso && <p role="status" style={{ ...nota, color: '#1A3C5E' }}>{aviso}</p>}
      {error && <p role="alert" style={{ ...nota, color: '#B3261E' }}>{error}</p>}

      {activo ? (
        <>
          <p role="note" data-testid="advertencia-enlace" style={{ fontSize: '14px', color: '#8A2A1A', backgroundColor: '#FFF6E8', border: '1px solid #E8720C', borderRadius: '10px', padding: '10px', margin: '0 0 10px', lineHeight: 1.5 }}>
            {ADVERTENCIA_ENLACE_SEGUIMIENTO}
          </p>
          <label htmlFor="enlace-seguimiento" style={{ fontSize: '13px', color: '#555' }}>Enlace para tu cliente</label>
          <input id="enlace-seguimiento" readOnly value={enlaceSeguimiento(token)} onFocus={(e) => e.target.select()} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '10px', border: '1px solid #CCC', fontSize: '13px' }} />
          <p style={nota}>El enlace deja de abrir el {formatoFecha(vence)}.</p>
          <a
            href={enlaceCompartirSeguimiento(orden?.cliente?.telefono, taller?.nombre || '', orden?.vehiculo ?? {}, enlaceSeguimiento(token))}
            target="_blank" rel="noopener noreferrer"
            style={{ ...botonPrincipal, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxSizing: 'border-box', backgroundColor: '#1E7E34', borderColor: '#1E7E34' }}
          >
            Compartir por WhatsApp
          </a>
          <button type="button" onClick={() => copiar(enlaceSeguimiento(token))} style={boton}>Copiar enlace</button>

          <label htmlFor="nota-seguimiento" style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#1A3C5E', margin: '14px 0 4px' }}>Nota para tu cliente (opcional)</label>
          <p style={{ ...nota, margin: '0 0 6px', color: '#8A2A1A' }}>{ADVERTENCIA_NOTA_SEGUIMIENTO}</p>
          <textarea
            id="nota-seguimiento" value={texto} maxLength={MAX_NOTA_SEGUIMIENTO} rows={3} disabled={!puedeEditar || vencida}
            onChange={(e) => setTexto(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '10px', border: '1px solid #CCC', fontSize: '15px' }}
          />
          <p style={{ ...nota, textAlign: 'right' }}>{texto.length}/{MAX_NOTA_SEGUIMIENTO}</p>
          {puedeEditar && !vencida && (
            <button type="button" onClick={guardarNota} disabled={ocupado} style={boton}>Guardar nota</button>
          )}
          <button type="button" onClick={desactivar} disabled={ocupado} style={{ ...boton, borderColor: '#B3261E', color: '#B3261E' }}>Desactivar enlace</button>
        </>
      ) : (
        <>
          <p style={nota}>
            {token
              ? 'El enlace de seguimiento de esta orden está desactivado o ya venció.'
              : 'Comparte con tu cliente un enlace para que vea el estado de su vehículo sin llamarte.'}
          </p>
          {puedeActivar && (
            <button type="button" onClick={activar} disabled={ocupado} style={botonPrincipal}>
              {token ? 'Activar un enlace nuevo' : 'Activar seguimiento'}
            </button>
          )}
          {!puedeActivar && razonSinActivar && <p data-testid="seguimiento-sin-activar" style={nota}>{razonSinActivar}</p>}
        </>
      )}
    </section>
  );
}
