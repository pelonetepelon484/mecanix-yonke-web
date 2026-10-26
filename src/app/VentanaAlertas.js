'use client';

// Ventana "Alertas de búsqueda" de la portada: las alertas más recientes del estado del visitante
// (de /api/alertas-recientes: solo pieza, vehículo, estado y fecha). 5 a la vez; con más, rota
// (la siguiente entra arriba y sale la de abajo) y da la vuelta. "hace X minutos" con la hora del
// servidor. Se vuelve a pedir cada 90 s, y nada mientras la pestaña no está a la vista.
// - "Yo la tengo": con sesión, a /panel/reservaciones?pedido={id}; sin sesión, al registro de
//   yonke con esa alerta (al terminar el registro lo lleva a contestarla).
// - Clic en la ventana: con sesión, al listado completo (Pedidos); sin sesión, al registro.
// - Sin config/pedidosClientes.alertasPortada, o sin alertas, no se muestra NADA.
// - Con config/pedidosClientes.alertasPortadaTodos, si el estado del visitante tiene menos de 5, el
//   servidor completa con alertas de otros estados que aceptan envíos, cada una con su estado.
// - Si no se sabe el estado del visitante, en lugar de alertas le pide elegirlo arriba.
import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { leerBanderaAlertasPortada } from './lib/banderaPedidosClientes';
import {
  REFRESCO_PORTADA_MS, ROTACION_MS, VISIBLES_PORTADA, haceCuanto, rotacionInicial, rotarUnPaso,
} from '../lib/alertasRecientes';

export const TEXTO_YO_LA_TENGO = 'Yo la tengo';
export const TEXTO_ELIGE_ESTADO = 'Elige tu estado arriba para ver las alertas de búsqueda de tu estado.';
export const RUTA_REGISTRO_ALERTAS = '/panel/registro?desde=alertas';
const ALTO_FILA = 80;

// Pide las alertas: con un estado elegido, ese; con "Todos los estados", el servidor usa la
// ubicación aproximada del visitante. null si no se pudo; { noDisponible: true } con la bandera apagada.
async function pedirAlertas(estado) {
  try {
    const url = estado && estado !== 'todos' ? `/api/alertas-recientes?estado=${encodeURIComponent(estado)}` : '/api/alertas-recientes';
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return data.disponible === false ? { noDisponible: true } : null;
    return data;
  } catch {
    return null; // sin red: se queda lo último que se mostró
  }
}

export const enlaceYoLaTengo = (id, conSesion) => (conSesion
  ? `/panel/reservaciones?pedido=${id}`
  : `/panel/registro?pedido=${id}&desde=alertas`);

export default function VentanaAlertas({ estado }) {
  const [activa, setActiva] = useState(false);
  const [conSesion, setConSesion] = useState(false);
  const [datos, setDatos] = useState(null); // { estado, estadoNombre, alertas, desfase }
  const [rotacion, setRotacion] = useState({ mostradas: [], siguiente: 0 });
  const [ahoraLocal, setAhoraLocal] = useState(0); // hora del celular de la última actualización del texto
  const ultimaCarga = useRef(0);

  useEffect(() => {
    let cancelado = false;
    leerBanderaAlertasPortada().then((v) => { if (!cancelado) setActiva(v); });
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    if (!activa) return undefined;
    return onAuthStateChanged(auth, (u) => setConSesion(Boolean(u)));
  }, [activa]);

  // Carga y recarga cada 90 s, solo con la pestaña a la vista; al volver, recarga si ya tocaba.
  useEffect(() => {
    if (!activa) return undefined;
    let cancelado = false;
    const cargar = () => {
      ultimaCarga.current = Date.now();
      pedirAlertas(estado).then((data) => {
        if (cancelado || !data) return;
        if (data.noDisponible) { setActiva(false); return; }
        const lista = Array.isArray(data.alertas) ? data.alertas : [];
        const local = Date.now();
        const servidor = Date.parse(data.ahora);
        setDatos({ estado: data.estado, estadoNombre: data.estadoNombre, alertas: lista, desfase: Number.isNaN(servidor) ? 0 : servidor - local });
        setAhoraLocal(local);
        setRotacion(rotacionInicial(lista));
      });
    };
    const visible = () => document.visibilityState !== 'hidden';
    cargar();
    const intervalo = setInterval(() => { if (visible()) cargar(); }, REFRESCO_PORTADA_MS);
    const alVolver = () => { if (visible() && Date.now() - ultimaCarga.current >= REFRESCO_PORTADA_MS) cargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { cancelado = true; clearInterval(intervalo); document.removeEventListener('visibilitychange', alVolver); };
  }, [activa, estado]);

  const alertas = useMemo(() => datos?.alertas ?? [], [datos]);
  const rota = alertas.length > VISIBLES_PORTADA;

  // Rotación (solo con más de 5) y reloj de "hace X minutos" (cada 30 s), en pausa sin pestaña.
  useEffect(() => {
    if (!rota) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') setRotacion((r) => rotarUnPaso(r, alertas));
    }, ROTACION_MS);
    return () => clearInterval(id);
  }, [rota, alertas]);
  useEffect(() => {
    if (!datos) return undefined;
    const id = setInterval(() => { if (document.visibilityState !== 'hidden') setAhoraLocal(Date.now()); }, 30 * 1000);
    return () => clearInterval(id);
  }, [datos]);

  if (!activa || !datos) return null;
  if (!datos.estado) {
    return <p style={elige}>🔔 {TEXTO_ELIGE_ESTADO}</p>;
  }
  if (alertas.length === 0) return null;

  const porId = new Map(alertas.map((a) => [a.id, a]));
  const mostradas = rotacion.mostradas.map((id) => porId.get(id)).filter(Boolean);
  const ahoraServidor = ahoraLocal + datos.desfase;
  const irAlListado = () => { window.location.href = conSesion ? '/panel/reservaciones' : RUTA_REGISTRO_ALERTAS; };

  return (
    <div
      role="link" tabIndex={0} aria-label="Ver todas las alertas de búsqueda"
      onClick={irAlListado} onKeyDown={(e) => { if (e.key === 'Enter') irAlListado(); }}
      style={caja}
    >
      <style>{ANIMACION}</style>
      <p style={titulo}>🔔 Alertas de búsqueda recientes</p>
      <p style={subtitulo}>Clientes buscando piezas ahora. ¿Tienes alguna?</p>
      <div style={{ height: Math.min(mostradas.length, VISIBLES_PORTADA) * ALTO_FILA, overflow: 'hidden' }}>
        {mostradas.map((a, i) => (
          <div key={a.id} className={rota && i === 0 ? 'mecanix-alerta-entra' : undefined} style={fila}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={pieza}>{a.pieza}</p>
              <p style={detalle}>{a.vehiculo?.marca} {a.vehiculo?.modelo} {a.vehiculo?.anio}</p>
              {/* Cada alerta con su estado: con config/pedidosClientes.alertasPortadaTodos pueden venir de
                  otros estados (traen estadoNombre propio); si no, todas son del estado del visitante. */}
              <p style={cuando}>{a.estadoNombre || datos.estadoNombre} · {haceCuanto(a.creadoAt, ahoraServidor)}</p>
            </div>
            <a href={enlaceYoLaTengo(a.id, conSesion)} onClick={(e) => e.stopPropagation()} style={boton}>{TEXTO_YO_LA_TENGO}</a>
          </div>
        ))}
      </div>
    </div>
  );
}

// La que entra se desliza desde arriba; sin animación si el celular pide menos movimiento.
const ANIMACION = `
@keyframes mecanixAlertaEntra { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.mecanix-alerta-entra { animation: mecanixAlertaEntra 0.45s ease-out; }
@media (prefers-reduced-motion: reduce) { .mecanix-alerta-entra { animation: none; } }
`;

const caja = { backgroundColor: '#fff', borderRadius: '20px', padding: '16px 18px 8px', boxShadow: '0 4px 16px rgba(26,60,94,0.07)', marginBottom: '12px', cursor: 'pointer', border: '1.5px solid #FFD8B5' };
const titulo = { margin: 0, fontSize: '15px', fontWeight: '700', color: '#1A3C5E' };
const subtitulo = { margin: '2px 0 10px', fontSize: '12px', color: '#888' };
const fila = { height: `${ALTO_FILA}px`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid #F2F2F2' };
const pieza = { margin: 0, fontSize: '14px', fontWeight: '700', color: '#1A3C5E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const detalle = { margin: '2px 0 0', fontSize: '12px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const cuando = { margin: '2px 0 0', fontSize: '11px', color: '#E8720C', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const boton = { flexShrink: 0, padding: '8px 12px', borderRadius: '999px', backgroundColor: '#E8720C', color: '#fff', fontSize: '12px', fontWeight: '700', textDecoration: 'none' };
const elige = { margin: '0 0 12px', padding: '10px 14px', borderRadius: '12px', backgroundColor: '#EEF4FA', color: '#1A3C5E', fontSize: '13px', textAlign: 'center' };
