'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { esPrecioValido, formatPrecio } from '../../lib/precio';
import { VERSION_LEGAL } from '../../lib/versionesLegales';
import { whatsappHrefPromo } from '../../lib/promos';
import { anchorVehiculo, hrefContactoVehiculo, idVehiculoDesdeHash, urlVehiculo } from '../../lib/contactoVehiculo';
import { whatsappHref } from '../../lib/whatsapp';
import { registrarContactoVehiculo } from '../lib/registrarContactoVehiculo';
import { conFallbackDePermisos } from '../../lib/conFallbackDePermisos';
import AvisoPrivacidadReserva from '../lib/AvisoPrivacidadReserva';
import FotoTarjeta from '../lib/FotoTarjeta';
import VisorFotosVehiculo from '../lib/VisorFotosVehiculo';
import VisorFotos from '../lib/VisorFotos';
import { fotosDeItem } from '../../lib/fotosPieza';

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

// Luminancia percibida simplificada (no necesita precisión WCAG, solo decidir si el crédito de
// Mecanix en el footer debe usar el logo blanco o el azul normal) -- branding.colorFondo lo
// personaliza cada yonke, así que un fondo oscuro es un caso real, no hipotético.
function esColorOscuro(hex) {
  if (!hex || typeof hex !== 'string') return false;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia < 0.5;
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

// Marca de agua del sello "Yonke Verificado": capa de fondo, MUY baja opacidad para que
// nunca compita con el texto. Va como primer hijo de una tarjeta con position:'relative' +
// overflow:'hidden'; el resto del contenido debe ir en un wrapper position:'relative',
// zIndex:1 para quedar garantizadamente encima.
function SelloMarcaAgua() {
  return (
    <img
      src="/sello_verificado.png"
      alt=""
      aria-hidden="true"
      style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '65%', maxWidth: '200px', opacity: 0.17, pointerEvents: 'none', zIndex: 0,
      }}
    />
  );
}

// Insignia visible "Verificado" — junto al nombre del negocio, no confundir con la marca de agua.
function BadgeVerificado() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      backgroundColor: '#E8F5E9', color: '#2E7D32', fontSize: '11px',
      fontWeight: '700', padding: '3px 8px', borderRadius: '12px', flexShrink: 0,
    }}>
      ✓ Verificado
    </span>
  );
}

export default function TenantPageClient({ negocio, branding, inventario }) {
  // Visor de fotos del vehículo (las 4, deslizable) -- null = cerrado. Las otras 3 fotos no se
  // piden al navegador hasta que esto deja de ser null.
  const [visorVehiculo, setVisorVehiculo] = useState(null);
  // Visor de las fotos (hasta 3) de un motor/transmisión -- null = cerrado.
  const [visorFotos, setVisorFotos] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroMarca, setFiltroMarca] = useState('');
  const [filtroTransmision, setFiltroTransmision] = useState('');
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const [expandidos, setExpandidos] = useState(new Set());

  // Ancla #vehiculo-{id} (la usa el mensaje de WhatsApp para "compartir" un vehículo): al cargar,
  // si el hash trae un id de vehículo, lo expande y hace scroll hacia él. Si el hash no existe o
  // no corresponde a ningún vehículo, la carga sigue normal, sin error.
  useEffect(() => {
    const id = idVehiculoDesdeHash(window.location.hash);
    if (!id) return;
    setExpandidos((prev) => new Set(prev).add(id));
    const intento = setTimeout(() => {
      document.getElementById(anchorVehiculo(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150); // deja que el DOM pinte las tarjetas antes de buscar el elemento
    return () => clearTimeout(intento);
  }, []);


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
      const datosReserva = {
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
      };
      // Si las reglas aún no permiten avisoPrivacidadVersion, se reserva sin ese campo.
      await conFallbackDePermisos(
        () => addDoc(collection(db, 'reservaciones'), { ...datosReserva, avisoPrivacidadVersion: VERSION_LEGAL }),
        () => addDoc(collection(db, 'reservaciones'), datosReserva),
        'reservación + avisoPrivacidadVersion',
      );
      setNumeroPedido(numero);
    } catch (error) {
      console.error(error);
      alert('Hubo un error al generar tu reservación');
    } finally {
      setGuardandoReserva(false);
    }
  }

  // Enlace + registro de "toque" para el botón de WhatsApp de un vehículo — compartido entre la
  // tarjeta y el panel expandido. null si el yonke no tiene WhatsApp válido (el botón se oculta).
  // Botón flotante general — mensaje genérico (no ligado a un vehículo en particular).
  const whatsappHrefGeneral = whatsappHref(negocio.whatsapp, 'Hola, vi su página y tengo una pregunta.');

  function hrefWhatsappVehiculo(v) {
    if (typeof window === 'undefined') return null;
    const url = urlVehiculo(`${window.location.origin}${window.location.pathname}`, v.id);
    return hrefContactoVehiculo(negocio.whatsapp, v.marca, v.modelo, v.ano, url);
  }

  function alTocarWhatsappVehiculo(e, vehiculoId) {
    e.stopPropagation();
    registrarContactoVehiculo(negocio.id, vehiculoId);
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: branding.colorFondo, fontFamily: "'Inter', sans-serif" }}>
      {/* backgroundColor se pinta de inmediato (colorPrimario); si hay fondoUrl, la imagen se
          dibuja encima en cuanto termina de cargar — nunca hay un parpadeo blanco porque el color
          ya está ahí desde el primer frame, sin esperar ningún estado de carga. Si no hay
          fondoUrl, el comportamiento es EXACTAMENTE el de antes (solo color). */}
      <div style={{
        backgroundColor: branding.colorPrimario,
        ...(branding.fondoUrl ? {
          backgroundImage: `url(${branding.fondoUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
        } : {}),
        padding: '28px 16px',
      }}>
        <div style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center' }}>
          {/* El logo es opcional (branding.logoUrl es null si el yonke nunca subió uno -- ya NO
              cae al logo de Mecanix, ver getTenant.js). El nombre SIEMPRE se muestra como texto,
              además del logo cuando existe -- nunca solo el logo, para que el header identifique
              al yonke incluso sin imagen. */}
          {branding.logoUrl && (
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
          )}
          <p style={nombreHeaderStyle}>{branding.nombre}</p>
        </div>
      </div>

      <div style={{ maxWidth: '620px', margin: '0 auto', padding: '20px 16px' }}>

        {/* Info del negocio */}
        <div style={infoCardStyle}>
          {negocio.verificado && <SelloMarcaAgua />}
          <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '0 0 8px' }}>
            <p style={{ fontWeight: '700', color: branding.colorPrimario, fontSize: '18px', margin: 0 }}>
              {negocio.nombre}
            </p>
            {negocio.verificado && <BadgeVerificado />}
          </div>

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
        </div>

        {/* Sobre nosotros — texto plano (nunca HTML), oculto si el yonke nunca lo capturó. */}
        {branding.sobreNosotros && (
          <section aria-label="Sobre nosotros" style={sobreNosotrosStyle}>
            {branding.sobreNosotros.fotoUrl && (
              <img
                src={branding.sobreNosotros.fotoUrl}
                alt=""
                loading="lazy"
                style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', borderRadius: '12px', marginBottom: '12px', display: 'block' }}
              />
            )}
            <p style={sobreNosotrosTituloStyle(branding.colorPrimario)}>Sobre nosotros</p>
            <p style={sobreNosotrosTextoStyle}>{branding.sobreNosotros.texto}</p>
            {(branding.sobreNosotros.aniosExperiencia || branding.sobreNosotros.direccion || branding.sobreNosotros.horario) && (
              <p style={sobreNosotrosDetalleStyle}>
                {[
                  branding.sobreNosotros.aniosExperiencia ? `${branding.sobreNosotros.aniosExperiencia} años de experiencia` : null,
                  branding.sobreNosotros.direccion,
                  branding.sobreNosotros.horario,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
          </section>
        )}

        {/* Promociones del yonke (máx. 3) — cada imagen abre su WhatsApp con un mensaje que
            menciona la promoción; sin número válido se muestra la imagen sin enlace. Si no hay
            promociones, la sección no se dibuja. Las URLs vienen de Storage: unoptimized evita
            gastar la cuota de optimización de imágenes de Vercel. */}
        {branding.promoImagenes?.length > 0 && (
          <section aria-label="Promociones" style={{ marginBottom: '20px' }}>
            <p style={promosTituloStyle(branding.colorPrimario)}>🔥 Promociones</p>
            <div style={promosGridStyle}>
              {branding.promoImagenes.map((promo) => {
                const href = whatsappHrefPromo(negocio.whatsapp, promo.titulo, branding.nombre);
                const contenido = (
                  <>
                    <Image
                      src={promo.url}
                      alt={promo.titulo}
                      width={1200}
                      height={800}
                      unoptimized
                      loading="lazy"
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                    <div style={{ padding: '10px 12px' }}>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: branding.colorPrimario, lineHeight: '1.3' }}>{promo.titulo}</p>
                      {href && <p style={{ margin: '4px 0 0', fontSize: '12px', color: branding.colorAcento, fontWeight: '700' }}>💬 Toca para preguntar por WhatsApp</p>}
                    </div>
                  </>
                );
                return href ? (
                  <a key={promo.url} href={href} target="_blank" rel="noopener noreferrer" style={promoCardStyle}>{contenido}</a>
                ) : (
                  <div key={promo.url} style={promoCardStyle}>{contenido}</div>
                );
              })}
            </div>
          </section>
        )}

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
              const hrefWhatsapp = hrefWhatsappVehiculo(v);
              return (
                <div key={v.id} id={anchorVehiculo(v.id)} style={cardStyle}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <FotoTarjeta
                      url={v.fotos?.frontal?.url}
                      alt={`${v.marca} ${v.modelo} ${v.ano}`.trim()}
                      onClick={v.fotos?.frontal ? () => setVisorVehiculo({ fotos: v.fotos, nombre: `${v.marca} ${v.modelo} ${v.ano}`.trim(), slotInicial: 'frontal' }) : undefined}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={itemTituloStyle(branding.colorPrimario)}>🚗 {v.marca} {v.modelo} {v.ano}</p>
                      <p style={itemSubStyle}>
                        {[v.transmision, v.traccion, v.configuracionMotor, v.cilindrada].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>

                  {hrefWhatsapp && (
                    <a
                      href={hrefWhatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => alTocarWhatsappVehiculo(e, v.id)}
                      style={whatsappVehiculoBtnStyle}
                    >
                      💬 Preguntar por este vehículo
                    </a>
                  )}

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
                          {hrefWhatsapp && (
                            <a
                              href={hrefWhatsapp}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => alTocarWhatsappVehiculo(e, v.id)}
                              style={{ ...whatsappVehiculoBtnStyle, marginBottom: '10px' }}
                            >
                              💬 Preguntar por este vehículo completo
                            </a>
                          )}
                          {negocio.tienePoliticas && (
                            <a href="/politicas" style={{ ...footerEnlaceStyle(branding.colorPrimario), display: 'inline-block', marginBottom: '10px' }}>
                              Políticas y garantía →
                            </a>
                          )}
                          {v.piezas.map((p) => (
                            <div key={p.id} style={piezaRowStyle(p._match)}>
                              <div style={{ minWidth: 0, paddingRight: '8px' }}>
                                <span style={{ color: p.disponible ? '#333' : '#bbb', textDecoration: p.disponible ? 'none' : 'line-through', fontSize: '13px' }}>
                                  {p.nombre}
                                </span>
                                {p.disponible && (
                                  esPrecioValido(p.precio)
                                    ? <span style={precioPiezaStyle}>{formatPrecio(p.precio)}</span>
                                    : <span style={consultarPrecioStyle}>Consultar precio con el yonke</span>
                                )}
                              </div>
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
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <FotoTarjeta
                    url={fotosDeItem(m)[0]?.url}
                    alt={`${m.tipo} ${m.marca} ${m.modelo} ${m.ano}`.trim()}
                    icono="🔧"
                    total={fotosDeItem(m).length}
                    onClick={fotosDeItem(m).length > 0
                      ? () => setVisorFotos({ fotos: fotosDeItem(m), titulo: `${m.tipo} ${m.marca} ${m.modelo} ${m.ano}`.trim() })
                      : undefined}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={tipoBadgeStyle(branding.colorAcento)}>
                      {m.tipo === 'Motor' ? '🔧 Motor' : '⚙️ Transmisión'}
                    </span>
                    <p style={itemTituloStyle(branding.colorPrimario)}>
                      {m.marca} {m.modelo} {m.ano}
                    </p>
                    <p style={itemSubStyle}>
                      {[m.configuracionMotor, m.transmision, m.cilindrada].filter(Boolean).join(' · ')}
                    </p>
                    {esPrecioValido(m.precio)
                      ? <p style={{ ...precioPiezaStyle, display: 'block', margin: '6px 0 0', fontSize: '15px', marginLeft: 0 }}>{formatPrecio(m.precio)}</p>
                      : <p style={{ ...consultarPrecioStyle, display: 'block', margin: '6px 0 0', marginLeft: 0 }}>Consultar precio</p>}
                  </div>
                </div>
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

        <footer style={footerStyle}>
          {negocio.tienePoliticas && (
            <a href="/politicas" style={footerEnlaceStyle(branding.colorPrimario)}>
              Políticas y garantía →
            </a>
          )}
          {/* Crédito discreto de Mecanix -- nunca debe competir visualmente con el contenido del
              yonke ni con "Políticas y garantía" de arriba, por eso va aparte, chico y gris. Logo
              blanco si el fondo del yonke es oscuro (colorFondo personalizable por el yonke),
              si no la versión normal (azul) del wordmark. */}
          <a
            href="https://mecanixyonkevirtual.com"
            target="_blank"
            rel="noopener noreferrer"
            style={creditoMecanixStyle}
          >
            Con tecnología
            <img
              src={esColorOscuro(branding.colorFondo) ? '/logo-mecanix-blanco.webp' : '/logo-mecanix-palabra.webp'}
              alt="Mecanix"
              style={{ height: '17px', width: 'auto', verticalAlign: 'middle' }}
            />
          </a>
        </footer>
      </div>

      {negocio.whatsapp && whatsappHrefGeneral && (
        <a
          href={whatsappHrefGeneral}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Preguntar por WhatsApp"
          style={whatsappFlotanteStyle(branding.colorAcento)}
        >
          💬
        </a>
      )}

      {visorVehiculo && (
        <VisorFotosVehiculo
          fotos={visorVehiculo.fotos}
          nombreVehiculo={visorVehiculo.nombre}
          slotInicial={visorVehiculo.slotInicial}
          onClose={() => setVisorVehiculo(null)}
        />
      )}
      {visorFotos && (
        <VisorFotos items={visorFotos.fotos} titulo={visorFotos.titulo} onClose={() => setVisorFotos(null)} />
      )}

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
                <AvisoPrivacidadReserva color={branding.colorPrimario} />
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
const nombreHeaderStyle = {
  color: '#fff', fontSize: '22px', fontWeight: '700', margin: 0,
  textShadow: '0 1px 3px rgba(0,0,0,0.25)',
};
const infoCardStyle = {
  backgroundColor: '#fff', borderRadius: '16px', padding: '16px', marginBottom: '18px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)', position: 'relative', overflow: 'hidden',
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
const footerStyle = { textAlign: 'center', marginTop: '28px', paddingTop: '18px', borderTop: '1px solid #E5E8EC' };
const footerEnlaceStyle = (color) => ({ color, fontSize: '13px', fontWeight: '700', textDecoration: 'none' });
const creditoMecanixStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
  color: '#999', fontSize: '12px', textDecoration: 'none', marginTop: '10px',
};
const whatsappVehiculoBtnStyle = {
  display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '10px',
  padding: '10px 14px', borderRadius: '10px', backgroundColor: '#25D366', color: '#fff',
  fontWeight: '700', fontSize: '13px',
};
const whatsappFlotanteStyle = (color) => ({
  position: 'fixed', bottom: '20px', right: '20px', width: '56px', height: '56px',
  borderRadius: '50%', backgroundColor: color, color: '#fff', display: 'flex',
  alignItems: 'center', justifyContent: 'center', fontSize: '26px', textDecoration: 'none',
  boxShadow: '0 4px 14px rgba(0,0,0,0.25)', zIndex: 500,
});
const precioPiezaStyle = { display: 'block', color: '#2E7D32', fontSize: '13px', fontWeight: '700', marginTop: '2px' };
const consultarPrecioStyle = { display: 'block', color: '#999', fontSize: '11px', marginTop: '2px' };
const sobreNosotrosStyle = { backgroundColor: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(26,60,94,0.06)' };
const sobreNosotrosTituloStyle = (color) => ({ fontSize: '15px', fontWeight: '700', color, margin: '0 0 8px' });
const sobreNosotrosTextoStyle = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' };
const sobreNosotrosDetalleStyle = { fontSize: '12px', color: '#888', margin: '10px 0 0' };
const promosTituloStyle = (color) => ({ fontSize: '15px', fontWeight: '700', color, margin: '0 0 10px' });
const promosGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' };
const promoCardStyle = {
  display: 'block', textDecoration: 'none', backgroundColor: '#fff', borderRadius: '12px',
  overflow: 'hidden', boxShadow: '0 2px 8px rgba(26,60,94,0.08)', border: '1px solid #EEF0F2',
};
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
