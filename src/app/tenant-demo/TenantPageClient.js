'use client';

import { useState, useMemo } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

const CIUDADES_BC = [
  { key: 'tijuana', label: 'Tijuana' },
  { key: 'mexicali', label: 'Mexicali' },
  { key: 'ensenada', label: 'Ensenada' },
  { key: 'tecate', label: 'Tecate' },
  { key: 'rosarito', label: 'Playas de Rosarito' },
  { key: 'sanquintin', label: 'San Quintín' },
];

const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_LABELS = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom' };

const DIACRITICOS_COMBINABLES = new RegExp('[\\u0300-\\u036f]', 'g');
function normalizar(texto) {
  return (texto ?? '').toString().toLowerCase().normalize('NFD').replace(DIACRITICOS_COMBINABLES, '');
}

function obtenerEstadoAbierto(horario) {
  if (!horario) return null;
  const ahora = new Date();
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const diaActual = diasSemana[ahora.getDay()];
  const diaData = horario[diaActual];
  if (!diaData || !diaData.abierto) return { abierto: false, texto: 'Cerrado hoy' };
  const [horaAbre, minAbre] = diaData.apertura.split(':').map(Number);
  const [horaCierra, minCierra] = diaData.cierre.split(':').map(Number);
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const minutosAbre = horaAbre * 60 + minAbre;
  const minutosCierra = horaCierra * 60 + minCierra;
  if (minutosAhora >= minutosAbre && minutosAhora < minutosCierra) {
    return { abierto: true, texto: `Abierto · Cierra a las ${diaData.cierre}` };
  }
  if (minutosAhora < minutosAbre) {
    return { abierto: false, texto: `Abre hoy a las ${diaData.apertura}` };
  }
  return { abierto: false, texto: 'Cerrado por hoy' };
}

function formatearHorario(horario) {
  if (!horario) return null;
  const diasAbiertos = DIAS_ORDEN.filter((d) => horario[d]?.abierto);
  if (diasAbiertos.length === 0) return null;
  const grupos = [];
  let grupoActual = null;
  for (const dia of diasAbiertos) {
    const h = `${horario[dia].apertura}–${horario[dia].cierre}`;
    if (grupoActual && grupoActual.horario === h) { grupoActual.hasta = dia; }
    else { grupoActual = { desde: dia, hasta: dia, horario: h }; grupos.push(grupoActual); }
  }
  return grupos.map((g) =>
    g.desde === g.hasta ? `${DIAS_LABELS[g.desde]} ${g.horario}` : `${DIAS_LABELS[g.desde]}–${DIAS_LABELS[g.hasta]} ${g.horario}`
  ).join('  ·  ');
}

function generarNumeroPedido() {
  const random = Math.floor(1000 + Math.random() * 9000);
  const fecha = new Date();
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  return `MYV-${mes}${dia}-${random}`;
}

export default function TenantPageClient({ negocio, branding, inventario }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroMarca, setFiltroMarca] = useState('');
  const [filtroTransmision, setFiltroTransmision] = useState('');
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const [expandidos, setExpandidos] = useState(new Set());

  const [reservaVisible, setReservaVisible] = useState(false);
  const [reservaContexto, setReservaContexto] = useState(null);
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [guardandoReserva, setGuardandoReserva] = useState(false);
  const [numeroPedido, setNumeroPedido] = useState(null);

  const marcasDisponibles = useMemo(() => {
    const set = new Set();
    inventario.vehiculos.forEach((v) => v.marca && set.add(v.marca));
    inventario.motores.forEach((m) => m.marca && set.add(m.marca));
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [inventario]);

  const transmisionesDisponibles = useMemo(() => {
    const set = new Set();
    inventario.vehiculos.forEach((v) => v.transmision && set.add(v.transmision));
    inventario.motores.forEach((m) => m.tipo === 'Transmisión' && m.transmision && set.add(m.transmision));
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [inventario]);

  const queryNorm = normalizar(busqueda.trim());

  const vehiculosFiltrados = useMemo(() => {
    return inventario.vehiculos
      .filter((v) => !filtroMarca || v.marca === filtroMarca)
      .filter((v) => !filtroTransmision || v.transmision === filtroTransmision)
      .map((v) => {
        const camposVehiculo = normalizar([v.marca, v.modelo, v.ano, v.transmision, v.traccion, v.configuracionMotor, v.cilindrada].filter(Boolean).join(' '));
        const vehiculoCoincideDirecto = !queryNorm || camposVehiculo.includes(queryNorm);
        let piezas = v.piezas || [];
        if (soloDisponibles) piezas = piezas.filter((p) => p.disponible);
        piezas = piezas.map((p) => ({ ...p, _match: Boolean(queryNorm) && normalizar(p.nombre).includes(queryNorm) }));
        const algunaPiezaCoincide = piezas.some((p) => p._match);
        const visible = !queryNorm || vehiculoCoincideDirecto || algunaPiezaCoincide;
        // No se auto-expande la lista de piezas aunque haya coincidencia: un yonke con
        // decenas de vehículos (cada uno con ~40 piezas) podría auto-expandir cientos de
        // filas a la vez con una sola búsqueda de una pieza común (ej. "espejo") — se
        // mantiene el control manual por vehículo y solo se resalta el botón.
        return { ...v, piezas, _visible: visible, _algunaPiezaCoincide: algunaPiezaCoincide };
      })
      .filter((v) => v._visible && (!soloDisponibles || v.piezas.length > 0));
  }, [inventario.vehiculos, filtroMarca, filtroTransmision, soloDisponibles, queryNorm]);

  const motoresFiltrados = useMemo(() => {
    return inventario.motores
      .filter((m) => !filtroMarca || m.marca === filtroMarca)
      .filter((m) => !filtroTransmision || (m.tipo === 'Transmisión' && m.transmision === filtroTransmision))
      .filter((m) => !soloDisponibles || m.disponible)
      .filter((m) => {
        if (!queryNorm) return true;
        const campos = normalizar([m.tipo, m.marca, m.modelo, m.ano, m.configuracionMotor, m.transmision, m.cilindrada].filter(Boolean).join(' '));
        return campos.includes(queryNorm);
      });
  }, [inventario.motores, filtroMarca, filtroTransmision, soloDisponibles, queryNorm]);

  const totalResultados = vehiculosFiltrados.length + motoresFiltrados.length;
  const hayFiltrosActivos = Boolean(busqueda.trim() || filtroMarca || filtroTransmision || soloDisponibles);
  const hayInventario = inventario.vehiculos.length + inventario.motores.length > 0;

  const estadoAbierto = obtenerEstadoAbierto(negocio.horario);
  const horarioTexto = formatearHorario(negocio.horario);
  const ciudadLabel = CIUDADES_BC.find((c) => c.key === negocio.ciudad)?.label || negocio.ciudad;
  const mapsHref = negocio.direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${negocio.direccion}, ${ciudadLabel}`)}`
    : null;

  function toggleExpandido(id) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function whatsappHrefPieza(vehiculo, piezaNombre) {
    if (!negocio.whatsapp) return null;
    const mensaje = `Hola, vi ${piezaNombre} de ${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.ano} en ${negocio.nombre}. ¿Sigue disponible?`;
    return `https://wa.me/52${negocio.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`;
  }

  function whatsappHrefMotor(motor) {
    if (!negocio.whatsapp) return null;
    const mensaje = `Hola, vi ${motor.tipo} ${motor.marca} ${motor.modelo} ${motor.ano} en ${negocio.nombre}. ¿Sigue disponible?`;
    return `https://wa.me/52${negocio.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`;
  }

  function abrirReservaPieza(vehiculo, pieza) {
    setReservaContexto({
      piezaSolicitada: pieza.nombre,
      vehiculoId: vehiculo.id,
      vehiculo: {
        // Vehículos viejos pueden no tener transmision/traccion/configuracionMotor/cilindrada
        // — Firestore rechaza `undefined`, así que se normaliza a null.
        marca: vehiculo.marca ?? null, modelo: vehiculo.modelo ?? null, ano: vehiculo.ano ?? null,
        transmision: vehiculo.transmision ?? null, traccion: vehiculo.traccion ?? null,
        configuracionMotor: vehiculo.configuracionMotor ?? null, cilindrada: vehiculo.cilindrada ?? null,
      },
      motor: null,
    });
    setNombreCliente(''); setTelefonoCliente(''); setNumeroPedido(null);
    setReservaVisible(true);
  }

  function abrirReservaMotor(motor) {
    setReservaContexto({
      piezaSolicitada: `${motor.tipo} ${motor.marca} ${motor.modelo} ${motor.ano}`,
      vehiculoId: null,
      vehiculo: null,
      motor: {
        tipo: motor.tipo ?? null, marca: motor.marca ?? null, modelo: motor.modelo ?? null,
        ano: motor.ano ?? null, cilindrada: motor.cilindrada ?? null,
      },
    });
    setNombreCliente(''); setTelefonoCliente(''); setNumeroPedido(null);
    setReservaVisible(true);
  }

  function cerrarReserva() {
    setReservaVisible(false); setReservaContexto(null); setNumeroPedido(null);
  }

  async function confirmarReserva() {
    if (!nombreCliente.trim() || !telefonoCliente.trim()) { alert('Llena tu nombre y teléfono'); return; }
    setGuardandoReserva(true);
    try {
      const numero = generarNumeroPedido();
      await addDoc(collection(db, 'reservaciones'), {
        numeroPedido: numero,
        yonkeId: negocio.id,
        yonkeNombre: negocio.nombre,
        vehiculoId: reservaContexto.vehiculoId,
        vehiculo: reservaContexto.vehiculo,
        motor: reservaContexto.motor,
        piezaSolicitada: reservaContexto.piezaSolicitada,
        nombreCliente: nombreCliente.trim(),
        telefonoCliente: telefonoCliente.trim(),
        estado: 'pendiente',
        fecha: new Date(),
      });
      setNumeroPedido(numero);
    } catch (error) {
      console.error(error);
      alert('Hubo un error al generar tu reservación');
    } finally {
      setGuardandoReserva(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: branding.colorFondo, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ backgroundColor: branding.colorPrimario, padding: '28px 16px' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center' }}>
          <div style={logoMarcoStyle}>
            <img
              src={branding.logoUrl}
              alt={branding.nombre}
              style={{
                width: '100%', maxWidth: 'min(770px, 90vw)',
                height: 'auto', maxHeight: '252px',
                objectFit: 'contain', display: 'block',
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '620px', margin: '0 auto', padding: '20px 16px' }}>

        {/* Info del negocio */}
        <div style={infoCardStyle}>
          <p style={{ fontWeight: '700', color: branding.colorPrimario, fontSize: '18px', margin: '0 0 8px' }}>
            {negocio.nombre}
          </p>

          {estadoAbierto && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              backgroundColor: estadoAbierto.abierto ? '#E8F5E9' : '#FDECEA',
              color: estadoAbierto.abierto ? '#2E7D32' : '#C62828',
              fontSize: '12px', fontWeight: '700', padding: '4px 10px',
              borderRadius: '20px', marginBottom: '10px',
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: estadoAbierto.abierto ? '#2E7D32' : '#C62828', display: 'inline-block' }} />
              {estadoAbierto.texto}
            </div>
          )}

          {negocio.direccion && (
            mapsHref ? (
              <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={infoLineLinkStyle(branding.colorPrimario)}>
                📍 {negocio.direccion}{ciudadLabel ? `, ${ciudadLabel}` : ''}
              </a>
            ) : (
              <p style={infoLineStyle}>📍 {negocio.direccion}{ciudadLabel ? `, ${ciudadLabel}` : ''}</p>
            )
          )}

          {negocio.telefono && (
            <a href={`tel:${negocio.telefono.replace(/\D/g, '')}`} style={infoLineLinkStyle(branding.colorPrimario)}>
              📞 {negocio.telefono}
            </a>
          )}

          {horarioTexto && (
            <p style={{ ...infoLineStyle, marginTop: '6px' }}>🕐 {horarioTexto}</p>
          )}
        </div>

        {/* Buscador */}
        <input
          type="text"
          placeholder="Busca por marca, modelo, año o pieza (ej. Sentra, espejo, 2015)"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={buscadorStyle}
        />

        {/* Filtros rápidos */}
        {(marcasDisponibles.length > 0 || transmisionesDisponibles.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {marcasDisponibles.map((m) => (
              <button
                key={m}
                onClick={() => setFiltroMarca(filtroMarca === m ? '' : m)}
                style={filtroMarca === m ? chipActivoStyle(branding.colorPrimario) : chipStyle}
              >
                {m}
              </button>
            ))}
            {transmisionesDisponibles.map((t) => (
              <button
                key={t}
                onClick={() => setFiltroTransmision(filtroTransmision === t ? '' : t)}
                style={filtroTransmision === t ? chipActivoStyle(branding.colorPrimario) : chipStyle}
              >
                {t}
              </button>
            ))}
            <button
              onClick={() => setSoloDisponibles((v) => !v)}
              style={soloDisponibles ? chipActivoStyle(branding.colorAcento) : chipStyle}
            >
              ✓ Solo disponibles
            </button>
          </div>
        )}

        <h2 style={{ fontSize: '15px', fontWeight: '700', color: branding.colorPrimario, marginBottom: '14px' }}>
          {hayFiltrosActivos ? `${totalResultados} resultado${totalResultados === 1 ? '' : 's'}` : `Inventario disponible (${inventario.vehiculos.length + inventario.motores.length})`}
        </h2>

        {!hayInventario ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>
            Aún no hay inventario cargado.
          </p>
        ) : totalResultados === 0 ? (
          <div style={vacioStyle}>
            <p style={{ margin: '0 0 10px', fontSize: '14px', color: '#555' }}>
              Este yonke no tiene esa pieza — busca en todos los yonkes en mecanixyonkevirtual.com
            </p>
            <a href="https://mecanixyonkevirtual.com" style={{ ...enlaceSitioStyle, backgroundColor: branding.colorAcento }}>
              Buscar en todos los yonkes →
            </a>
          </div>
        ) : (
          <>
            {vehiculosFiltrados.map((v) => {
              const expandido = expandidos.has(v.id);
              return (
                <div key={v.id} style={cardStyle}>
                  <p style={itemTituloStyle(branding.colorPrimario)}>🚗 {v.marca} {v.modelo} {v.ano}</p>
                  <p style={itemSubStyle}>
                    {[v.transmision, v.traccion, v.configuracionMotor, v.cilindrada].filter(Boolean).join(' · ')}
                  </p>

                  {v.piezas.length > 0 && (
                    <>
                      <button
                        onClick={() => toggleExpandido(v.id)}
                        style={{ ...verPiezasBtnStyle, color: v._algunaPiezaCoincide ? branding.colorAcento : branding.colorPrimario }}
                      >
                        {expandido ? '▾' : '▸'} Ver piezas ({v.piezas.length}){v._algunaPiezaCoincide ? ' · coincide con tu búsqueda' : ''}
                      </button>

                      {expandido && (
                        <div style={{ marginTop: '8px' }}>
                          {v.piezas.map((p) => (
                            <div key={p.id} style={piezaRowStyle(p._match)}>
                              <span style={{ color: p.disponible ? '#333' : '#bbb', textDecoration: p.disponible ? 'none' : 'line-through', fontSize: '13px' }}>
                                {p.nombre}
                              </span>
                              {p.disponible ? (
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
                                  {whatsappHrefPieza(v, p.nombre) && (
                                    <a href={whatsappHrefPieza(v, p.nombre)} target="_blank" rel="noopener noreferrer" style={miniWhatsappStyle}>💬</a>
                                  )}
                                  <button onClick={() => abrirReservaPieza(v, p)} style={miniReservarStyle(branding.colorAcento)}>Reservar</button>
                                </div>
                              ) : (
                                <span style={noDisponibleTagStyle}>No disponible</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {motoresFiltrados.map((m) => (
              <div key={m.id} style={cardStyle}>
                <span style={tipoBadgeStyle(branding.colorAcento)}>
                  {m.tipo === 'Motor' ? '🔧 Motor' : '⚙️ Transmisión'}
                </span>
                <p style={itemTituloStyle(branding.colorPrimario)}>
                  {m.marca} {m.modelo} {m.ano}
                </p>
                <p style={itemSubStyle}>
                  {[m.configuracionMotor, m.transmision, m.cilindrada].filter(Boolean).join(' · ')}
                </p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  {whatsappHrefMotor(m) && (
                    <a href={whatsappHrefMotor(m)} target="_blank" rel="noopener noreferrer" style={whatsappBotonStyle}>
                      💬 Preguntar por WhatsApp
                    </a>
                  )}
                  <button onClick={() => abrirReservaMotor(m)} style={reservarBotonStyle(branding.colorAcento)}>
                    Reservar
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {reservaVisible && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            {numeroPedido ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '40px', margin: '0 0 12px' }}>✅</p>
                <h3 style={{ color: branding.colorPrimario, fontSize: '18px', marginBottom: '8px', fontWeight: '700' }}>¡Reservación confirmada!</h3>
                <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>Presenta este número en el yonke:</p>
                <div style={{ backgroundColor: branding.colorPrimario, color: '#fff', fontSize: '20px', fontWeight: '700', padding: '14px', borderRadius: '12px', letterSpacing: '2px' }}>
                  {numeroPedido}
                </div>
                <button onClick={cerrarReserva} style={{ ...reservarBotonStyle(branding.colorAcento), width: '100%', marginTop: '18px' }}>Cerrar</button>
              </div>
            ) : (
              <>
                <h3 style={{ color: branding.colorPrimario, fontSize: '17px', marginBottom: '4px', fontWeight: '700' }}>Reservar</h3>
                <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>{reservaContexto?.piezaSolicitada}</p>
                <input type="text" placeholder="Tu nombre" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} style={inputStyle} />
                <input type="tel" placeholder="Tu teléfono" value={telefonoCliente} onChange={(e) => setTelefonoCliente(e.target.value)} style={inputStyle} />
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button onClick={cerrarReserva} style={cancelButtonStyle}>Cancelar</button>
                  <button onClick={confirmarReserva} disabled={guardandoReserva} style={{ ...reservarBotonStyle(branding.colorAcento), flex: 1 }}>
                    {guardandoReserva ? 'Generando...' : 'Confirmar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

const logoMarcoStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: '#fff', borderRadius: '16px', padding: '18px 28px',
  marginBottom: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
};
const infoCardStyle = {
  backgroundColor: '#fff', borderRadius: '16px', padding: '16px', marginBottom: '18px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
};
const infoLineStyle = { color: '#555', fontSize: '13px', margin: '4px 0' };
const infoLineLinkStyle = (color) => ({
  display: 'block', color, fontSize: '13px', margin: '4px 0', textDecoration: 'none', fontWeight: '600',
});
const buscadorStyle = {
  width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #ddd',
  fontSize: '15px', color: '#333', backgroundColor: '#fff', boxSizing: 'border-box',
  marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
};
const chipStyle = {
  padding: '7px 14px', borderRadius: '20px', border: '1px solid #ddd',
  backgroundColor: '#fff', color: '#666', fontWeight: '600', fontSize: '12px', cursor: 'pointer',
};
const chipActivoStyle = (color) => ({
  ...chipStyle, backgroundColor: color, borderColor: color, color: '#fff',
});
const vacioStyle = {
  textAlign: 'center', backgroundColor: '#fff', borderRadius: '16px', padding: '28px 20px', marginTop: '12px',
};
const enlaceSitioStyle = {
  display: 'inline-block', color: '#fff', textDecoration: 'none', fontWeight: '700',
  fontSize: '13px', padding: '10px 18px', borderRadius: '50px',
};
const cardStyle = {
  backgroundColor: '#fff', borderRadius: '16px', padding: '18px', marginBottom: '14px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
};
const tipoBadgeStyle = (color) => ({
  display: 'inline-block', backgroundColor: color, color: '#fff', fontSize: '11px',
  fontWeight: '700', padding: '3px 8px', borderRadius: '12px', marginBottom: '8px',
});
const itemTituloStyle = (color) => ({
  fontWeight: '700', color, fontSize: '16px', margin: '4px 0 2px',
});
const itemSubStyle = { color: '#888', fontSize: '13px', margin: 0 };
const verPiezasBtnStyle = {
  background: 'none', border: 'none', fontWeight: '700', fontSize: '12px',
  cursor: 'pointer', padding: '10px 0 0', display: 'block',
};
const piezaRowStyle = (destacada) => ({
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '8px 0', borderBottom: '1px solid #F4F5F5',
  backgroundColor: destacada ? '#FFF9E6' : 'transparent',
});
const noDisponibleTagStyle = {
  fontSize: '11px', color: '#aaa', fontWeight: '600', flexShrink: 0,
};
const miniWhatsappStyle = {
  fontSize: '16px', textDecoration: 'none', lineHeight: 1,
};
const miniReservarStyle = (color) => ({
  background: 'none', border: `1px solid ${color}`, color, fontSize: '11px',
  fontWeight: '700', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
});
const whatsappBotonStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '10px 16px', borderRadius: '50px', backgroundColor: '#25D366', color: '#fff',
  fontWeight: '700', fontSize: '13px', textDecoration: 'none', flex: 1,
};
const reservarBotonStyle = (color) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '10px 16px', borderRadius: '50px', backgroundColor: color, color: '#fff',
  fontWeight: '700', fontSize: '13px', border: 'none', cursor: 'pointer', flex: 1,
});
const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000,
};
const modalStyle = {
  backgroundColor: '#fff', borderRadius: '20px', padding: '24px', maxWidth: '380px', width: '100%',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};
const inputStyle = {
  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
  marginBottom: '12px', fontSize: '15px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box',
};
const cancelButtonStyle = {
  flex: 1, padding: '14px', borderRadius: '50px', border: 'none',
  backgroundColor: '#F4F5F5', color: '#888', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
};
