'use client';

// Panel admin "Pedidos de piezas": interruptor de la función para clientes, contadores y dos
// pestañas (pedidos de clientes y pedidos de talleres). La sesión de admin la exige
// admin/layout.js; la protección real son las reglas de Firestore.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cargarEstados } from '../../lib/estados';
import { resumenPedidos, estaVencido } from '../../../lib/pedidosClientes';
import { cambiarBanderaPedidosClientes, contarRespuestas, leerBanderaPedidosClientes, listarPedidosClientes } from './datos';
import PestanaClientes from './PestanaClientes';
import PestanaTalleres from './PestanaTalleres';

export default function PedidosAdminPage() {
  const router = useRouter();
  const [pestana, setPestana] = useState('clientes');
  const [bandera, setBandera] = useState(null); // null = cargando
  const [cambiandoBandera, setCambiandoBandera] = useState(false);
  const [pedidos, setPedidos] = useState(null);
  const [conteos, setConteos] = useState({});
  const [estados, setEstados] = useState([]);
  const [error, setError] = useState('');

  const cargarPedidos = useCallback(() => listarPedidosClientes()
    .then(async (lista) => {
      // Respuestas solo de los abiertos vigentes (para los contadores): 1 lectura de agregación cada uno.
      const ahora = new Date();
      const abiertos = lista.filter((p) => p.estadoPedido === 'abierta' && !estaVencido(p.expiraAt, ahora));
      const pares = await Promise.all(abiertos.map(async (p) => [p.id, await contarRespuestas('pedidosClientes', p.id)]));
      setConteos(Object.fromEntries(pares));
      setPedidos(lista);
      setError('');
    })
    .catch((err) => {
      console.error(err);
      setError('No pudimos cargar los pedidos de clientes.');
    }), []);

  useEffect(() => {
    leerBanderaPedidosClientes().then(setBandera).catch(() => setBandera(false));
    cargarEstados().then(setEstados).catch(() => {});
    cargarPedidos();
  }, [cargarPedidos]);

  async function alternarBandera() {
    const nueva = !bandera;
    const texto = nueva
      ? '¿Activar el pedido de piezas para clientes? En el buscador desaparece el campo "Tu WhatsApp" y, sin resultados, aparece "Avisar a los yonkes". Las búsquedas ya no se guardan en Contactos pendientes.'
      : '¿Desactivar el pedido de piezas para clientes? El botón "Avisar a los yonkes" desaparece y el buscador vuelve a pedir "Tu WhatsApp" como antes.';
    if (!window.confirm(texto)) return;
    setCambiandoBandera(true);
    try {
      await cambiarBanderaPedidosClientes(nueva);
      setBandera(nueva);
    } catch (err) {
      console.error(err);
      window.alert('No se pudo cambiar el interruptor. Revisa tu conexión y tus permisos de admin.');
    } finally {
      setCambiandoBandera(false);
    }
  }

  const resumen = pedidos ? resumenPedidos(pedidos, conteos, new Date()) : null;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#1A3C5E', fontSize: '14px', cursor: 'pointer', padding: '8px 0' }}>
          ← Admin
        </button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '4px 0 14px' }}>Pedidos de piezas</h1>

        <div style={{ ...caja, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E' }}>Pedido de piezas para clientes activado</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#666' }}>
              Escribe config/pedidosClientes.habilitado. El servidor tarda hasta 1 minuto en notarlo.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={bandera === true}
            aria-label="Pedido de piezas para clientes activado"
            disabled={bandera === null || cambiandoBandera}
            onClick={alternarBandera}
            style={{ minWidth: '120px', minHeight: '40px', borderRadius: '20px', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#fff', backgroundColor: bandera ? '#2E7D32' : '#888', opacity: bandera === null || cambiandoBandera ? 0.6 : 1 }}
          >
            {bandera === null ? '...' : bandera ? 'Activado' : 'Desactivado'}
          </button>
        </div>

        {resumen && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            <Contador titulo="Pedidos abiertos" valor={resumen.abiertos} />
            <Contador titulo="Con al menos una respuesta" valor={resumen.conRespuesta} />
            <Contador titulo="Sin respuestas" valor={resumen.sinRespuesta} />
            <Contador titulo="Cerrados (últimos 7 días)" valor={resumen.cerrados7Dias} />
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {[['clientes', 'Pedidos de clientes'], ['talleres', 'Pedidos de talleres']].map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={pestana === valor}
              onClick={() => setPestana(valor)}
              style={{ flex: 1, minHeight: '44px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: pestana === valor ? '#1A3C5E' : '#fff', color: pestana === valor ? '#fff' : '#1A3C5E' }}
            >
              {texto}
            </button>
          ))}
        </div>

        {error && <p role="alert" style={{ color: '#B3261E' }}>{error}</p>}
        {pestana === 'clientes'
          ? <PestanaClientes pedidos={pedidos} conteos={conteos} estados={estados} onCambio={cargarPedidos} />
          : <PestanaTalleres estados={estados} />}
      </div>
    </main>
  );
}

function Contador({ titulo, valor }) {
  return (
    <div style={{ ...caja, marginBottom: 0, textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: '26px', fontWeight: 'bold', color: '#1A3C5E' }}>{valor}</p>
      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#666' }}>{titulo}</p>
    </div>
  );
}

const caja = { backgroundColor: '#fff', borderRadius: '14px', padding: '14px 16px', marginBottom: '14px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' };
