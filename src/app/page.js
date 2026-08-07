'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { buscarVehiculosEnAniosParalelo } from './lib/buscarVehiculosPorAnio';
function registrarEvento(nombre, params = {}) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', nombre, params);
  }
}

const CIUDADES_BC = [
  { key: 'tijuana', label: 'Tijuana' },
  { key: 'mexicali', label: 'Mexicali' },
  { key: 'ensenada', label: 'Ensenada' },
  { key: 'tecate', label: 'Tecate' },
  { key: 'rosarito', label: 'Playas de Rosarito' },
  { key: 'sanquintin', label: 'San Quintín' },
];

const PIEZAS_CATALOGO = [
  'Faro delantero izquierdo', 'Faro delantero derecho', 'Calavera trasera izquierda', 'Calavera trasera derecha',
  'Cofre', 'Cajuela', 'Parachoques delantero', 'Parachoques trasero', 'Espejo izquierdo', 'Espejo derecho',
  'Puerta delantera izquierda', 'Puerta delantera derecha', 'Puerta trasera izquierda', 'Puerta trasera derecha',
  'Parabrisas', 'Rines', 'Tablero', 'Asientos', 'Orquilla derecha', 'Orquilla izquierda',
  'Disco de freno delantero', 'Disco de freno trasero', 'Prensa de freno', 'Amortiguador delantero izquierdo',
  'Amortiguador delantero derecho', 'Resortes delanteros', 'Resortes traseros', 'Amortiguador trasero derecho',
  'Amortiguador trasero izquierdo', 'Compresor A/C', 'Alternador', 'Computadora de motor',
  'Computadora de transmisión', 'Caja de fusibles', 'Cremallera', 'Bomba de dirección', 'Barra estabilizadora',
  'Múltiple de admisión', 'Múltiple de escape', 'Garganta', 'Filtro de aire', 'Manguera de aire', 'Sensor MAF',
  'Flecha delantera izquierda', 'Flecha delantera derecha', 'Motor', 'Transmisión',
];

const TIPO_BUSQUEDA = [
  { key: 'vehiculo', label: '🚗 Vehículo', desc: 'Con motor y transmisión' },
  { key: 'motor', label: '🔧 Motor', desc: 'Motor suelto' },
  { key: 'transmision', label: '⚙️ Transmisión', desc: 'Transmisión suelta' },
];

const BANNER_IMAGES = [
  '/rigs1.png', '/rigs2.png', '/rigs3.png',
];

function BannerRH() {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndice(prev => (prev + 1) % BANNER_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <a
      href="https://wa.me/526633349151"
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => registrarEvento('click_publicidad', {
        anunciante: 'rh_diagnostico',
        medio: 'whatsapp',
      })}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '16px',
        backgroundColor: '#111',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        textDecoration: 'none',
        padding: '8px',
        position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute', top: '6px', right: '8px',
        backgroundColor: 'rgba(255,255,255,0.15)', color: '#ccc',
        fontSize: '9px', padding: '2px 6px', borderRadius: '10px',
        fontWeight: '600', letterSpacing: '0.5px',
      }}>
        Publicidad
      </div>
      <img
        src={BANNER_IMAGES[indice]}
        alt="RH Diagnóstico Automotriz"
        style={{ width: '200px', height: '200px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
      />
      <div style={{ flex: 1 }}>
        <p style={{ color: '#fff', fontWeight: '700', fontSize: '13px', margin: '0 0 4px' }}>
          RH Diagnóstico Automotriz
        </p>
        <p style={{ color: '#aaa', fontSize: '12px', margin: '0 0 6px', lineHeight: '1.4' }}>
          Sensores TPMS · Escaneo · Servicio a domicilio
        </p>
        <span style={{
          backgroundColor: '#25D366', color: '#fff',
          fontSize: '11px', fontWeight: '700', padding: '4px 10px',
          borderRadius: '12px', display: 'inline-block',
        }}>
          💬 Contactar
        </span>
      </div>
    </a>
  );
}

// Leyenda del sello "Mecanix Verificado" — aparece en la página principal (siempre visible)
// y también arriba de los resultados de búsqueda; mismo componente en los dos lugares para
// que no se desincronicen el texto o el estilo.
function LeyendaVerificados() {
  return (
    <a
      href="/verificados"
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none',
        backgroundColor: '#EEF2F7', borderRadius: '14px', padding: '14px 18px',
        marginBottom: '16px', border: '1.5px solid #C5D4E8',
      }}
    >
      <span style={{ fontSize: '20px', flexShrink: 0 }}>🔵</span>
      <p style={{ margin: 0, fontSize: '13px', color: '#1A3C5E', lineHeight: '1.5' }}>
        Busca el sello <strong>Mecanix Verificado</strong> — confirmamos personalmente que
        esos yonkes son negocios reales.{' '}
        <span style={{ color: '#E8720C', fontWeight: '700', whiteSpace: 'nowrap' }}>Ver yonkes verificados →</span>
      </p>
    </a>
  );
}

// Marca de agua del sello "Yonke Verificado": capa de fondo, MUY baja opacidad para que
// nunca compita con el texto de la tarjeta. Va como primer hijo de una tarjeta con
// position:'relative' + overflow:'hidden'; el resto del contenido de la tarjeta debe ir en
// un wrapper con position:'relative', zIndex:1 para quedar garantizadamente encima.
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

// Insignia visible "Verificado" — junto al nombre del yonke, no confundir con la marca de agua.
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

export default function Home() {
  const [ciudad, setCiudad] = useState('');
  const [tipoBusqueda, setTipoBusqueda] = useState('vehiculo');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [busquedaHecha, setBusquedaHecha] = useState(false);
  const [piezaNoEncontrada, setPiezaNoEncontrada] = useState(false);
  const [tipoResultado, setTipoResultado] = useState('exacto');

  const [modalVisible, setModalVisible] = useState(false);
  const [yonkeSeleccionado, setYonkeSeleccionado] = useState(null);
  const [piezaSolicitada, setPiezaSolicitada] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [numeroPedido, setNumeroPedido] = useState(null);
  const [piezaBuscada, setPiezaBuscada] = useState('');
  const [yonkesConLogo, setYonkesConLogo] = useState([]);
  const [interesaEnvio, setInteresaEnvio] = useState(false);
  const [piezaSeleccion, setPiezaSeleccion] = useState('');
  const [catalogoVehiculos, setCatalogoVehiculos] = useState({});
  const [marcaSel, setMarcaSel] = useState('');
  const [modeloSel, setModeloSel] = useState('');

  // Buscador inteligente (texto libre)
  const [textoLibre, setTextoLibre] = useState('');
  const [contactoLibre, setContactoLibre] = useState('');
  const [buscandoLibre, setBuscandoLibre] = useState(false);
  const [mensajeLibre, setMensajeLibre] = useState(null);
  const [encabezadoVehiculo, setEncabezadoVehiculo] = useState(null);
  const [resultadosMotoresLibre, setResultadosMotoresLibre] = useState([]);
  const [resultadosTransmisionesLibre, setResultadosTransmisionesLibre] = useState([]);
  const [resultadosCercanosLibre, setResultadosCercanosLibre] = useState([]);
  const [resultadosMotoresCercanosLibre, setResultadosMotoresCercanosLibre] = useState([]);
  const [resultadosTransmisionesCercanosLibre, setResultadosTransmisionesCercanosLibre] = useState([]);

  useEffect(() => {
    async function cargarCatalogo() {
      try {
        const snap = await getDoc(doc(db, 'config', 'catalogoVehiculos'));
        if (snap.exists()) setCatalogoVehiculos(snap.data().catalogo || {});
      } catch (e) { console.error('No se pudo cargar el catálogo', e); }
    }
    cargarCatalogo();
  }, []);

  async function obtenerCalificacion(yonkeId) {
    try {
      const califRef = collection(db, 'calificaciones');
      const q = query(califRef, where('yonkeId', '==', yonkeId));
      const snap = await getDocs(q);
      if (snap.empty) return { promedio: null, total: 0 };
      let suma = 0;
      snap.forEach((doc) => { suma += doc.data().estrellas || 0; });
      return { promedio: (suma / snap.size).toFixed(1), total: snap.size };
    } catch (error) {
      return { promedio: null, total: 0 };
    }
  }

  useEffect(() => {
    async function cargarLogos() {
      try {
        const yonkesSnap = await getDocs(collection(db, 'yonkes'));
        const conLogo = yonkesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(y => y.activo && y.logoUrl);
        setYonkesConLogo(conLogo);
      } catch (error) { console.error(error); }
    }
    cargarLogos();
  }, []);

  function filtrarPorCiudad(yonkesSnap) {
    if (!ciudad) return yonkesSnap.docs;
    return yonkesSnap.docs.filter(d => {
      const c = d.data().ciudad || '';
      return c.toLowerCase() === ciudad.toLowerCase();
    });
  }

  async function buscarMotoresOTransmisiones(yonkesDocs) {
    const encontrados = [];
    const tipoFiltro = tipoBusqueda === 'motor' ? 'Motor' : 'Transmisión';
    for (const yonkeDoc of yonkesDocs) {
      const yonkeData = yonkeDoc.data();
      if (!yonkeData.activo) continue;
      const motoresRef = collection(db, 'yonkes', yonkeDoc.id, 'motores');
      const motoresSnap = await getDocs(motoresRef);
      const coincidentes = motoresSnap.docs.filter(mDoc => {
        const data = mDoc.data();
        if (data.disponible === false) return false;
        if (data.tipo !== tipoFiltro) return false;
        if (marca && data.marca?.toLowerCase() !== marca.trim().toLowerCase()) return false;
        if (modelo && data.modelo?.toLowerCase() !== modelo.trim().toLowerCase()) return false;
        if (ano && data.ano !== parseInt(ano)) return false;
        return true;
      });
      for (const mDoc of coincidentes) {
        const calificacion = await obtenerCalificacion(yonkeDoc.id);
        encontrados.push({
          yonkeId: yonkeDoc.id,
          esMotor: true,
          motorId: mDoc.id,
          motor: mDoc.data(),
          yonkeNombre: yonkeData.nombre,
          logoUrl: yonkeData.logoUrl || null,
          verificado: yonkeData.verificado === true,
          entregaInmediata: yonkeData.entregaInmediata === true,
          direccion: yonkeData.direccion,
          telefono: yonkeData.telefono,
          whatsapp: yonkeData.whatsapp || '',
          metodosPago: yonkeData.metodosPago || [],
          plan: yonkeData.plan,
          ciudad: yonkeData.ciudad || '',
          horario: yonkeData.horario || null,
          calificacion,
        });
      }
    }
    return encontrados;
  }

  // Los años se consultan EN PARALELO (Promise.all), no uno por uno — antes esto disparaba
  // un round-trip secuencial por cada (yonke, año), ~9.7s para ±3 años con 14 yonkes. La
  // consulta+matching en sí vive en lib/buscarVehiculosPorAnio.js (compartido con
  // lib/busqueda/consultarInventario.js, el buscador inteligente) — si cambia cómo se
  // compara marca/modelo, cambia para los dos. El orden final no cambia: se reordena a
  // "yonke primero, año después", igual que el loop secuencial que reemplaza.
  async function buscarEnAnos(yonkesDocs, marcaBuscar, modeloBuscar, anos) {
    const pares = await buscarVehiculosEnAniosParalelo(db, yonkesDocs, marcaBuscar, modeloBuscar, anos);
    const encontrados = [];
    for (const { yonkeDoc, vDoc } of pares) {
      const yaExiste = encontrados.some(r => r.yonkeId === yonkeDoc.id && r.vehiculoId === vDoc.id);
      if (yaExiste) continue;
      const yonkeData = yonkeDoc.data();
      const calificacion = await obtenerCalificacion(yonkeDoc.id);
      encontrados.push({
        yonkeId: yonkeDoc.id, vehiculoId: vDoc.id,
        yonkeNombre: yonkeData.nombre, logoUrl: yonkeData.logoUrl || null, verificado: yonkeData.verificado === true, entregaInmediata: yonkeData.entregaInmediata === true, direccion: yonkeData.direccion,
        telefono: yonkeData.telefono, whatsapp: yonkeData.whatsapp || '',
        metodosPago: yonkeData.metodosPago || [], plan: yonkeData.plan,
        ciudad: yonkeData.ciudad || '', horario: yonkeData.horario || null,
        vehiculo: vDoc.data(), calificacion,
      });
    }
    return encontrados;
  }

  async function buscarCualquierAno(yonkesDocs, marcaBuscar, modeloBuscar) {
    const encontrados = [];
    for (const yonkeDoc of yonkesDocs) {
      const yonkeData = yonkeDoc.data();
      if (!yonkeData.activo) continue;
      const vehiculosRef = collection(db, 'yonkes', yonkeDoc.id, 'vehiculos');
      const vehiculosSnap = await getDocs(vehiculosRef);
      // DEUDA TÉCNICA: el filtrado de marca/modelo se hace client-side tras traer por año, lo que
      // desperdicia lecturas de Firestore. Irrelevante con ~14 yonkes; revisar si se acerca a ~100
      // yonkes o si el bot de WhatsApp genera tráfico alto, moviendo el filtro a la query (requiere
      // índices compuestos marca+modelo+ano).
      const vehiculosCoincidentes = vehiculosSnap.docs.filter((vDoc) => {
        const data = vDoc.data();
        return data.marca?.toLowerCase() === marcaBuscar.trim().toLowerCase() &&
          data.modelo?.toLowerCase() === modeloBuscar.trim().toLowerCase();
      });
      for (const vDoc of vehiculosCoincidentes) {
        const yaExiste = encontrados.some(r => r.yonkeId === yonkeDoc.id && r.vehiculoId === vDoc.id);
        if (yaExiste) continue;
        const calificacion = await obtenerCalificacion(yonkeDoc.id);
        encontrados.push({
          yonkeId: yonkeDoc.id, vehiculoId: vDoc.id,
          yonkeNombre: yonkeData.nombre, logoUrl: yonkeData.logoUrl || null, verificado: yonkeData.verificado === true, entregaInmediata: yonkeData.entregaInmediata === true, direccion: yonkeData.direccion,
          telefono: yonkeData.telefono, whatsapp: yonkeData.whatsapp || '',
          metodosPago: yonkeData.metodosPago || [], plan: yonkeData.plan,
          ciudad: yonkeData.ciudad || '', horario: yonkeData.horario || null,
          vehiculo: vDoc.data(), calificacion,
        });
      }
    }
    return encontrados;
  }

  async function buscarPiezas() {
    if (tipoBusqueda === 'vehiculo' && (!marca || !modelo || !ano)) {
      alert('Llena marca, modelo y año'); return;
    }
    if ((tipoBusqueda === 'motor' || tipoBusqueda === 'transmision') && !marca) {
      alert('Llena al menos la marca'); return;
    }
    setBuscando(true); setBusquedaHecha(true); setPiezaNoEncontrada(false); setTipoResultado('exacto');
    try {
      const yonkesSnap = await getDocs(collection(db, 'yonkes'));
      const yonkesFiltrados = filtrarPorCiudad(yonkesSnap);

      // Búsqueda de motor o transmisión
      if (tipoBusqueda === 'motor' || tipoBusqueda === 'transmision') {
        const encontrados = await buscarMotoresOTransmisiones(yonkesFiltrados);
        const ordenar = (lista) => lista.sort((a, b) => {
          if (a.plan === 'premium' && b.plan !== 'premium') return -1;
          if (a.plan !== 'premium' && b.plan === 'premium') return 1;
          return 0;
        });
        ordenar(encontrados);
        setResultados(encontrados);
        registrarEvento('busqueda_pieza', {
          tipo: tipoBusqueda,
          marca: marca.trim().toLowerCase(),
          modelo: modelo.trim().toLowerCase() || '(sin modelo)',
          ano: ano || '(sin año)',
          ciudad: ciudad || 'todas',
          resultados: encontrados.length,
          encontrado: encontrados.length > 0 ? 'si' : 'no',
        });
        setBuscando(false);
        return;
      }

      // Búsqueda de vehículo
      const conPiezaExacta = [], soloVehiculo = [];
      for (const yonkeDoc of yonkesFiltrados) {
        const yonkeData = yonkeDoc.data();
        if (!yonkeData.activo) continue;
        const vehiculosRef = collection(db, 'yonkes', yonkeDoc.id, 'vehiculos');
        const q = query(vehiculosRef, where('ano', '==', parseInt(ano)));
        const vehiculosSnapTodos = await getDocs(q);
        // DEUDA TÉCNICA: el filtrado de marca/modelo se hace client-side tras traer por año, lo que
        // desperdicia lecturas de Firestore. Irrelevante con ~14 yonkes; revisar si se acerca a ~100
        // yonkes o si el bot de WhatsApp genera tráfico alto, moviendo el filtro a la query (requiere
        // índices compuestos marca+modelo+ano).
        const vehiculosCoincidentes = vehiculosSnapTodos.docs.filter((vDoc) => {
          const data = vDoc.data();
          return data.marca?.toLowerCase() === marca.trim().toLowerCase() &&
            data.modelo?.toLowerCase() === modelo.trim().toLowerCase();
        });
        for (const vDoc of vehiculosCoincidentes) {
          const calificacion = await obtenerCalificacion(yonkeDoc.id);
          const resultadoBase = {
            yonkeId: yonkeDoc.id, vehiculoId: vDoc.id,
            yonkeNombre: yonkeData.nombre, logoUrl: yonkeData.logoUrl || null, verificado: yonkeData.verificado === true, entregaInmediata: yonkeData.entregaInmediata === true, direccion: yonkeData.direccion,
            telefono: yonkeData.telefono, whatsapp: yonkeData.whatsapp || '',
            metodosPago: yonkeData.metodosPago || [], plan: yonkeData.plan,
            ciudad: yonkeData.ciudad || '', horario: yonkeData.horario || null,
            vehiculo: vDoc.data(), calificacion,
          };
          const piezaFiltro = (piezaSeleccion && piezaSeleccion !== 'OTRA') ? piezaSeleccion : '';
          if (!piezaFiltro) { soloVehiculo.push(resultadoBase); continue; }
          const piezasRef = collection(db, 'yonkes', yonkeDoc.id, 'vehiculos', vDoc.id, 'piezas');
          const piezasSnap = await getDocs(piezasRef);
          const tienePiezaDisponible = piezasSnap.docs.some((pDoc) => {
            const data = pDoc.data();
            return data.disponible && data.nombre.toLowerCase() === piezaFiltro.toLowerCase();
          });
          if (tienePiezaDisponible) conPiezaExacta.push(resultadoBase);
          else soloVehiculo.push(resultadoBase);
        }
      }
      const ordenar = (lista) => lista.sort((a, b) => {
        if (a.plan === 'premium' && b.plan !== 'premium') return -1;
        if (a.plan !== 'premium' && b.plan === 'premium') return 1;
        return 0;
      });
      ordenar(conPiezaExacta); ordenar(soloVehiculo);
      const hayFiltroPieza = piezaSeleccion && piezaSeleccion !== 'OTRA';
      let resultadosFinales = [];
      if (hayFiltroPieza && conPiezaExacta.length === 0 && soloVehiculo.length > 0) {
        setPiezaNoEncontrada(true); resultadosFinales = soloVehiculo; setTipoResultado('exacto');
      } else {
        setPiezaNoEncontrada(false);
        resultadosFinales = hayFiltroPieza ? conPiezaExacta : soloVehiculo;
      }
      if (resultadosFinales.length === 0) {
        const anosRango = [];
        for (let d = 1; d <= 3; d++) { anosRango.push(parseInt(ano) - d); anosRango.push(parseInt(ano) + d); }
        const cercanos = await buscarEnAnos(yonkesFiltrados, marca, modelo, anosRango);
        ordenar(cercanos);
        if (cercanos.length > 0) { resultadosFinales = cercanos; setTipoResultado('cercano'); }
      }
      if (resultadosFinales.length === 0) {
        const cualquierAno = await buscarCualquierAno(yonkesFiltrados, marca, modelo);
        ordenar(cualquierAno);
        if (cualquierAno.length > 0) { resultadosFinales = cualquierAno; setTipoResultado('cualquierAno'); }
      }
      setResultados(resultadosFinales);
      registrarEvento('busqueda_pieza', {
        tipo: 'vehiculo',
        marca: marca.trim().toLowerCase(),
        modelo: modelo.trim().toLowerCase(),
        ano: ano,
        pieza: piezaSeleccion === 'OTRA'
          ? (piezaBuscada.trim().toLowerCase() || '(otra sin texto)')
          : (piezaSeleccion.toLowerCase() || '(sin pieza)'),
        origen_pieza: piezaSeleccion === 'OTRA' ? 'libre' : (piezaSeleccion ? 'catalogo' : 'ninguna'),
        origen_marca: marcaSel === 'OTRA' ? 'libre' : (marcaSel ? 'catalogo' : 'texto'),
        ciudad: ciudad || 'todas',
        resultados: resultadosFinales.length,
        encontrado: resultadosFinales.length > 0 ? 'si' : 'no',
      });
    } catch (error) {
      console.error(error); alert('Hubo un error al buscar');
    } finally { setBuscando(false); }
  }

  function aplicarRespuestaBusquedaLibre(data) {
    if (data.estado === 'resultados') {
      setMensajeLibre(null);
      setEncabezadoVehiculo(data.encabezadoVehiculo || null);
      setTipoBusqueda('vehiculo');
      setMarca(data.marca || '');
      setModelo(data.modelo || '');
      setAno(data.anio ? String(data.anio) : '');
      setPiezaSeleccion(data.pieza || '');
      setResultados(data.resultados);
      setTipoResultado(data.tipoResultado);
      setPiezaNoEncontrada(Boolean(data.piezaNoEncontrada));
      setResultadosMotoresLibre(data.resultadosMotores || []);
      setResultadosTransmisionesLibre(data.resultadosTransmisiones || []);
      setResultadosCercanosLibre(data.resultadosCercanos || []);
      setResultadosMotoresCercanosLibre(data.resultadosMotoresCercanos || []);
      setResultadosTransmisionesCercanosLibre(data.resultadosTransmisionesCercanos || []);
      setBusquedaHecha(true);
      registrarEvento('busqueda_texto_libre', {
        estado: data.estado,
        resultados: data.resultados.length + (data.resultadosMotores?.length || 0) + (data.resultadosTransmisiones?.length || 0)
          + (data.resultadosCercanos?.length || 0) + (data.resultadosMotoresCercanos?.length || 0) + (data.resultadosTransmisionesCercanos?.length || 0),
      });
    } else if (data.estado === 'confirmar') {
      setResultados([]);
      setResultadosMotoresLibre([]);
      setResultadosTransmisionesLibre([]);
      setResultadosCercanosLibre([]);
      setResultadosMotoresCercanosLibre([]);
      setResultadosTransmisionesCercanosLibre([]);
      setBusquedaHecha(false);
      setEncabezadoVehiculo(null);
      setMensajeLibre({ tipo: 'confirmar', texto: data.mensaje, sugerencia: data.sugerencia });
      registrarEvento('busqueda_texto_libre', { estado: data.estado, resultados: 0 });
    } else {
      setResultados([]);
      setResultadosMotoresLibre([]);
      setResultadosTransmisionesLibre([]);
      setResultadosCercanosLibre([]);
      setResultadosMotoresCercanosLibre([]);
      setResultadosTransmisionesCercanosLibre([]);
      setBusquedaHecha(false);
      setEncabezadoVehiculo(null);
      setMensajeLibre({ tipo: data.estado, texto: data.mensaje });
      registrarEvento('busqueda_texto_libre', { estado: data.estado, resultados: 0 });
    }
  }

  async function buscarConTextoLibre() {
    if (!textoLibre.trim()) return;
    setBuscandoLibre(true);
    setMensajeLibre(null);
    try {
      const res = await fetch('/api/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoLibre.trim(), contacto: contactoLibre.trim() }),
      });
      const data = await res.json();
      aplicarRespuestaBusquedaLibre(data);
    } catch (error) {
      console.error(error);
      setMensajeLibre({ tipo: 'error', texto: 'Hubo un error al buscar, intenta de nuevo.' });
    } finally {
      setBuscandoLibre(false);
    }
  }

  async function confirmarSugerenciaLibre() {
    const sugerencia = mensajeLibre?.sugerencia;
    if (!sugerencia) return;
    setBuscandoLibre(true);
    try {
      const res = await fetch('/api/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoLibre.trim(), contacto: contactoLibre.trim(), confirmado: sugerencia }),
      });
      const data = await res.json();
      aplicarRespuestaBusquedaLibre(data);
    } catch (error) {
      console.error(error);
      setMensajeLibre({ tipo: 'error', texto: 'Hubo un error al buscar, intenta de nuevo.' });
    } finally {
      setBuscandoLibre(false);
    }
  }

  function abrirModalReserva(resultado) {
    setYonkeSeleccionado(resultado);
    setPiezaSolicitada(resultado.esMotor
      ? `${resultado.motor.tipo} ${resultado.motor.marca} ${resultado.motor.modelo} ${resultado.motor.ano}`
      : (piezaSeleccion === 'OTRA' ? piezaBuscada.trim() : piezaSeleccion));
    setNombreCliente(''); setTelefonoCliente(''); setNumeroPedido(null); setInteresaEnvio(false); setModalVisible(true);
  }

  function generarNumeroPedido() {
    const random = Math.floor(1000 + Math.random() * 9000);
    const fecha = new Date();
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `MYV-${mes}${dia}-${random}`;
  }

  async function confirmarReserva() {
    if (!piezaSolicitada || !nombreCliente || !telefonoCliente) { alert('Llena todos los campos'); return; }
    setGuardando(true);
    try {
      const numero = generarNumeroPedido();
      await addDoc(collection(db, 'reservaciones'), {
        numeroPedido: numero, yonkeId: yonkeSeleccionado.yonkeId,
        vehiculoId: yonkeSeleccionado.vehiculoId || null,
        yonkeNombre: yonkeSeleccionado.yonkeNombre,
        vehiculo: yonkeSeleccionado.vehiculo || null,
        motor: yonkeSeleccionado.motor || null,
        piezaSolicitada: piezaSolicitada.trim(),
        nombreCliente: nombreCliente.trim(), telefonoCliente: telefonoCliente.trim(),
        estado: 'pendiente', fecha: new Date(),
        interesaEnvio: interesaEnvio,
      });
      setNumeroPedido(numero);
      registrarEvento('reserva_creada', {
        yonke: yonkeSeleccionado.yonkeNombre,
        yonke_id: yonkeSeleccionado.yonkeId,
        pieza: piezaSolicitada.trim().toLowerCase(),
        orden: numero,
        interesa_envio: interesaEnvio ? 'si' : 'no',
      });
    } catch (error) {
      console.error(error); alert('Hubo un error al generar tu reservación');
    } finally { setGuardando(false); }
  }

  function cerrarModal() { setModalVisible(false); setYonkeSeleccionado(null); setNumeroPedido(null); }

  const metodosPagoLabels = {
    efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
    spei: 'SPEI', codi: 'CoDi', zelle: 'Zelle', paypal: 'PayPal',
  };

  function getHeaderText() {
    const ciudadLabel = ciudad ? CIUDADES_BC.find(c => c.key === ciudad)?.label : null;
    const sufijoCiudad = ciudadLabel ? ` en ${ciudadLabel}` : '';
    if (resultados.length === 0) {
      if (tipoBusqueda === 'motor') return `No encontramos motores disponibles${sufijoCiudad}`;
      if (tipoBusqueda === 'transmision') return `No encontramos transmisiones disponibles${sufijoCiudad}`;
      return `No encontramos ese vehículo en ningún yonke registrado${sufijoCiudad}`;
    }
    if (tipoBusqueda === 'motor') return `${resultados.length} yonke(s) tienen el motor que buscas${sufijoCiudad}`;
    if (tipoBusqueda === 'transmision') return `${resultados.length} yonke(s) tienen la transmisión que buscas${sufijoCiudad}`;
    if (tipoResultado === 'cercano') return `No encontramos el ${marca} ${modelo} ${ano} exacto, pero hay ${resultados.length} yonke(s) con años cercanos${sufijoCiudad}`;
    if (tipoResultado === 'cualquierAno') return `No encontramos años cercanos, pero hay ${resultados.length} yonke(s) con ${marca} ${modelo} en otros años${sufijoCiudad}`;
    if (piezaNoEncontrada) return `No encontramos esa pieza exacta, pero ${resultados.length} yonke(s) tienen este vehículo${sufijoCiudad}`;
    return `${resultados.length} yonke(s) tienen este vehículo${sufijoCiudad}`;
  }

  function getBannerCompatibilidad() {
    if (tipoResultado === 'cercano') return 'Muchas piezas son compatibles entre años. Confirma con el yonke si la pieza aplica para tu ' + marca + ' ' + modelo + ' ' + ano + '.';
    if (tipoResultado === 'cualquierAno') return 'No encontramos años cercanos, pero estos yonkes tienen el mismo modelo. Confirma con el yonke si la pieza es compatible con tu ' + ano + ' antes de reservar.';
    return null;
  }

  const bannerTexto = getBannerCompatibilidad();
  const DIAS_ORDEN = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
  const DIAS_LABELS = { lunes:'Lun', martes:'Mar', miercoles:'Mié', jueves:'Jue', viernes:'Vie', sabado:'Sáb', domingo:'Dom' };

  function formatearHorario(horario) {
    if (!horario) return null;
    const diasAbiertos = DIAS_ORDEN.filter(d => horario[d]?.abierto);
    if (diasAbiertos.length === 0) return null;
    const grupos = [];
    let grupoActual = null;
    for (const dia of diasAbiertos) {
      const h = `${horario[dia].apertura}–${horario[dia].cierre}`;
      if (grupoActual && grupoActual.horario === h) { grupoActual.hasta = dia; }
      else { grupoActual = { desde: dia, hasta: dia, horario: h }; grupos.push(grupoActual); }
    }
    return grupos.map(g =>
      g.desde === g.hasta ? `${DIAS_LABELS[g.desde]} ${g.horario}` : `${DIAS_LABELS[g.desde]}–${DIAS_LABELS[g.hasta]} ${g.horario}`
    ).join('  ·  ');
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
      return { abierto: false, texto: `Abre a las ${diaData.apertura}` };
    }
    return { abierto: false, texto: 'Cerrado por hoy' };
  }

  function construirMensajeWhatsApp(r) {
    const pieza = r.esMotor
      ? (r.motor?.tipo || '')
      : (piezaSeleccion === 'OTRA' ? piezaBuscada.trim() : piezaSeleccion) || '';

    if (!pieza) {
      return 'Hola, los encontré en Mecanix Yonke Virtual. ¿Me pueden ayudar con una pieza?';
    }

    const datosVehiculo = r.esMotor ? r.motor : r.vehiculo;
    const marcaTexto = datosVehiculo?.marca || marca;
    const modeloTexto = datosVehiculo?.modelo || modelo;
    const anoTexto = datosVehiculo?.ano || ano;

    if (marcaTexto && modeloTexto) {
      const anoParte = anoTexto ? ` ${anoTexto}` : '';
      return `Hola, encontré esta pieza en Mecanix Yonke Virtual: ${pieza} para ${marcaTexto} ${modeloTexto}${anoParte}. ¿Sigue disponible?`;
    }

    return `Hola, encontré esta pieza en Mecanix Yonke Virtual: ${pieza}. ¿Sigue disponible?`;
  }

  // "Entrega inmediata": el pedido va a DAVID, no al yonke — por eso arma su propio mensaje
  // (distinto de construirMensajeWhatsApp, que siempre apunta al yonke) y en paralelo dispara
  // el aviso server-side por CallMeBot (mismo mecanismo que busquedas_pendientes) para que
  // David se entere por las dos vías. El número de David en el link de WhatsApp no es
  // sensible (ya aparece hardcodeado en el CTA de "sin resultados" de esta misma página); lo
  // que sí debe quedar server-side es la API key de CallMeBot, y esa nunca sale de /api.
  function pedirEntregaInmediata(r) {
    const datosVehiculo = r.esMotor ? r.motor : r.vehiculo;
    const marcaTexto = datosVehiculo?.marca || marca;
    const modeloTexto = datosVehiculo?.modelo || modelo;
    const anoTexto = datosVehiculo?.ano || ano;
    const piezaTexto = r.esMotor
      ? (r.motor?.tipo || '')
      : (piezaSeleccion === 'OTRA' ? piezaBuscada.trim() : piezaSeleccion) || '';
    const vehiculoTexto = [marcaTexto, modeloTexto, anoTexto].filter(Boolean).join(' ');
    const detalle = [piezaTexto, vehiculoTexto].filter(Boolean).join(' de ');

    const mensajeCliente = `Hola, quiero entrega inmediata de ${detalle || 'una pieza'} que tiene ${r.yonkeNombre}. Mi taller está en `;
    window.open(`https://wa.me/526611034260?text=${encodeURIComponent(mensajeCliente)}`, '_blank', 'noopener,noreferrer');

    fetch('/api/pedido-entrega-inmediata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pieza: piezaTexto, marca: marcaTexto, modelo: modeloTexto, anio: anoTexto, yonkeNombre: r.yonkeNombre }),
    }).catch((e) => console.log('No se pudo enviar el aviso de entrega inmediata', e));

    registrarEvento('pedido_entrega_inmediata', { yonke: r.yonkeNombre, yonke_id: r.yonkeId, ciudad: r.ciudad || 'sin_ciudad' });
  }

  // Bloque de "info del negocio del yonke" — ciudad, calificaciones, abierto/cerrado,
  // dirección, teléfono y horario en texto. Compartido entre la tarjeta de vehículo/pieza y la
  // de motor/transmisión para que nunca se vuelvan a desincronizar (antes vivía duplicado solo
  // en renderTarjetaVehiculo y motores/transmisiones se quedaban sin esta info).
  function renderInfoNegocio(r) {
    return (
      <>
        {r.ciudad && (
          <p style={{ color: '#E8720C', fontSize: '12px', fontWeight: '600', margin: '3px 0 0' }}>
            📌 {CIUDADES_BC.find(c => c.key === r.ciudad)?.label || r.ciudad}
          </p>
        )}

        {r.calificacion.promedio ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <span style={{ color: '#E8720C', fontSize: '14px' }}>
              {'★'.repeat(Math.round(r.calificacion.promedio))}{'☆'.repeat(5 - Math.round(r.calificacion.promedio))}
            </span>
            <span style={{ color: '#888', fontSize: '12px' }}>
              {r.calificacion.promedio} ({r.calificacion.total} {r.calificacion.total === 1 ? 'opinión' : 'opiniones'})
            </span>
          </div>
        ) : (
          <p style={{ color: '#ccc', fontSize: '12px', marginTop: '4px' }}>Sin calificaciones todavía</p>
        )}
        {r.horario && (() => {
          const estado = obtenerEstadoAbierto(r.horario);
          if (!estado) return null;
          return (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              backgroundColor: estado.abierto ? '#E8F5E9' : '#FDECEA',
              color: estado.abierto ? '#2E7D32' : '#C62828',
              fontSize: '12px', fontWeight: '700', padding: '4px 10px',
              borderRadius: '20px', marginTop: '6px', marginBottom: '4px',
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: estado.abierto ? '#2E7D32' : '#C62828', display: 'inline-block' }} />
              {estado.texto}
            </div>
          );
        })()}
        <p style={{ color: '#666', fontSize: '14px', margin: '10px 0 4px' }}>📍 {r.direccion}</p>
        <p style={{ color: '#666', fontSize: '14px', margin: '4px 0' }}>📞 {r.telefono}</p>

        {formatearHorario(r.horario) && (
          <p style={{ color: '#555', fontSize: '13px', margin: '4px 0' }}>🕐 {formatearHorario(r.horario)}</p>
        )}
      </>
    );
  }

  // Tarjeta de un resultado de vehículo — compartida entre el grupo "exacto" y el grupo
  // "años cercanos" para no mantener dos copias del mismo bloque. El aviso de compatibilidad
  // se decide solo por si el año difiere del buscado (nunca por tipoResultado global), así
  // funciona igual sin importar en qué grupo aparezca la tarjeta.
  function renderTarjetaVehiculo(r, key) {
    return (
      <div key={key} style={resultCardStyle}>
        {r.verificado && <SelloMarcaAgua />}
        <div style={{ position: 'relative', zIndex: 1 }}>
        {r.plan === 'premium' && <div style={premiumBadgeStyle}>⭐ Premium</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingRight: r.plan === 'premium' ? '90px' : 0 }}>
          {r.logoUrl && (
            <img
              src={r.logoUrl}
              alt={r.yonkeNombre}
              style={{ width: '160px', height: '160px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }}
            />
          )}
          <p style={{ fontWeight: '700', color: '#1A3C5E', fontSize: '17px', margin: 0 }}>{r.yonkeNombre}</p>
          {r.verificado && <BadgeVerificado />}
        </div>

        {r.entregaInmediata && (
          <p style={{ color: '#E8720C', fontSize: '13px', fontWeight: '700', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ⚡ Entrega inmediata
          </p>
        )}

        {renderInfoNegocio(r)}

        {/* Resultado de motor/transmisión */}
        {r.esMotor && (
          <div style={{ backgroundColor: '#F0F4F8', borderRadius: '10px', padding: '12px', margin: '10px 0' }}>
            <span style={{ backgroundColor: r.motor.tipo === 'Motor' ? '#E8720C' : '#1A3C5E', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '12px' }}>
              {r.motor.tipo === 'Motor' ? '🔧 Motor' : '⚙️ Transmisión'}
            </span>
            <p style={{ fontWeight: '700', color: '#1A3C5E', fontSize: '15px', margin: '8px 0 2px' }}>
              {r.motor.marca} {r.motor.modelo} {r.motor.ano}
            </p>
            {r.motor.cilindrada && (
              <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>{r.motor.cilindrada}</p>
            )}
          </div>
        )}

        {/* Resultado de vehículo */}
        {!r.esMotor && (
          <p style={{ color: '#1A3C5E', fontSize: '14px', margin: '10px 0 6px', fontWeight: '600' }}>
            🚗 {r.vehiculo.marca} {r.vehiculo.modelo} {r.vehiculo.ano}
            {r.vehiculo.ano !== parseInt(ano) && (
              <span style={{ fontSize: '11px', color: '#E8720C', fontWeight: 'normal', marginLeft: '6px' }}>
                (confirma compatibilidad con tu {ano})
              </span>
            )}
          </p>
        )}

        {r.metodosPago.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', marginBottom: '14px' }}>
            {r.metodosPago.map((m) => <span key={m} style={pagoTagStyle}>{metodosPagoLabels[m] || m}</span>)}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          {r.whatsapp && (
            <a
              href={`https://wa.me/52${r.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(construirMensajeWhatsApp(r))}`}
              target="_blank"
              rel="noopener noreferrer"
              style={whatsappButtonStyle}
              onClick={() => registrarEvento('contacto_yonke', {
                yonke: r.yonkeNombre,
                yonke_id: r.yonkeId,
                medio: 'whatsapp',
                ciudad: r.ciudad || 'sin_ciudad',
              })}
            >
              💬 WhatsApp
            </a>
          )}
          <button onClick={() => abrirModalReserva(r)} className="mecanix-btn-secondary" style={{ flex: 1 }}>
            Reservar
          </button>
        </div>

        {r.entregaInmediata && (
          <button onClick={() => pedirEntregaInmediata(r)} style={entregaButtonStyle}>
            ⚡ Pedir entrega a mi taller
          </button>
        )}
        </div>
      </div>
    );
  }

  // Tarjeta de un motor/transmisión suelto — solo del buscador inteligente. Compartida entre
  // el grupo "exacto" y el de "años cercanos" por la misma razón que renderTarjetaVehiculo.
  function renderTarjetaMotor(r, key, icono) {
    return (
      <div key={key} style={resultCardStyle}>
        {r.verificado && <SelloMarcaAgua />}
        <div style={{ position: 'relative', zIndex: 1 }}>
        {r.plan === 'premium' && <div style={premiumBadgeStyle}>⭐ Premium</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingRight: r.plan === 'premium' ? '90px' : 0 }}>
          {r.logoUrl && (
            <img src={r.logoUrl} alt={r.yonkeNombre} style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }} />
          )}
          <p style={{ fontWeight: '700', color: '#1A3C5E', fontSize: '17px', margin: 0 }}>{r.yonkeNombre}</p>
          {r.verificado && <BadgeVerificado />}
        </div>
        {r.entregaInmediata && (
          <p style={{ color: '#E8720C', fontSize: '13px', fontWeight: '700', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ⚡ Entrega inmediata
          </p>
        )}

        {renderInfoNegocio(r)}

        <p style={{ color: '#1A3C5E', fontSize: '14px', margin: '10px 0 2px', fontWeight: '600' }}>
          {icono} {r.motor.marca} {r.motor.modelo} {r.motor.ano}
        </p>
        {r.motor.cilindrada && (
          <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>{r.motor.cilindrada}</p>
        )}
        {r.whatsapp && (
          <a
            href={`https://wa.me/52${r.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(construirMensajeWhatsApp({ ...r, esMotor: true }))}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...whatsappButtonStyle, marginTop: '12px' }}
            onClick={() => registrarEvento('contacto_yonke', { yonke: r.yonkeNombre, yonke_id: r.yonkeId, medio: 'whatsapp', ciudad: r.ciudad || 'sin_ciudad' })}
          >
            💬 WhatsApp
          </a>
        )}
        {r.entregaInmediata && (
          <button onClick={() => pedirEntregaInmediata(r)} style={{ ...entregaButtonStyle, marginTop: '8px' }}>
            ⚡ Pedir entrega a mi taller
          </button>
        )}
        </div>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', padding: '32px 16px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <img src="/mecanix-logo.webp" alt="Mecanix" style={{ width: '260px', maxWidth: '100%', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: '13px', color: '#E8720C', letterSpacing: '3px', marginTop: '8px', fontWeight: '700' }}>
            YONKE VIRTUAL
          </p>
          <p style={{ fontSize: '17px', color: '#1A3C5E', marginTop: '12px', fontWeight: '600', lineHeight: '1.4', maxWidth: '340px', margin: '12px auto 0' }}>
            Encuentra la pieza exacta para tu auto en minutos
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
            {[
              { href: 'https://wa.me/526611034260', label: '💬 WhatsApp', ext: true },
              { href: 'mailto:powerpctijuana@gmail.com', label: '✉️ Correo', ext: false },
              { href: '#planes', label: '💳 Planes', ext: false },
              { href: '/privacidad', label: '🔒 Privacidad', ext: false },
              { href: '/terminos', label: '📋 Términos', ext: false },
            ].map(link => (
              <a key={link.href} href={link.href} target={link.ext ? '_blank' : undefined}
                rel={link.ext ? 'noopener noreferrer' : undefined} style={contactLinkStyle}>
                {link.label}
              </a>
            ))}
          </div>
          <div style={{ marginTop: '14px' }}>
            <a href="/panel" style={{
              display: 'inline-block',
              backgroundColor: '#1A3C5E',
              color: '#fff',
              fontWeight: '700',
              fontSize: '14px',
              padding: '11px 28px',
              borderRadius: '24px',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(26,60,94,0.3)',
              letterSpacing: '0.3px',
            }}>
              🔑 Acceso yonkes registrados
            </a>
          </div>
        </div>

        <LeyendaVerificados />

        {/* Buscador inteligente (texto libre) */}
        <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 8px 32px rgba(26,60,94,0.10)', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', color: '#1A3C5E', marginBottom: '6px', fontWeight: '700', letterSpacing: '-0.3px' }}>
            ✨ Buscador inteligente
          </h2>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
            Descríbelo con tus palabras, ej. "defensa delantera para un tsuru 2010"
          </p>
          <input
            className="mecanix-input"
            type="text"
            placeholder="¿Qué pieza necesitas?"
            value={textoLibre}
            onChange={(e) => setTextoLibre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') buscarConTextoLibre(); }}
          />
          <input
            className="mecanix-input"
            type="text"
            placeholder="Tu WhatsApp (opcional, para avisarte si no hay stock)"
            value={contactoLibre}
            onChange={(e) => setContactoLibre(e.target.value)}
          />
          <button onClick={buscarConTextoLibre} disabled={buscandoLibre} className="mecanix-btn-primary">
            {buscandoLibre ? 'Buscando...' : '✨ Buscar con IA'}
          </button>

          {mensajeLibre && (
            <div style={{
              marginTop: '14px', padding: '12px 14px', borderRadius: '10px',
              backgroundColor: mensajeLibre.tipo === 'sin_inventario' ? '#EEF4FA' : '#FFF8E1',
              border: `1px solid ${mensajeLibre.tipo === 'sin_inventario' ? '#C5D8EC' : '#FFD54F'}`,
            }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#1A3C5E', lineHeight: '1.5' }}>
                {mensajeLibre.texto}
              </p>
              {mensajeLibre.tipo === 'confirmar' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    onClick={confirmarSugerenciaLibre}
                    disabled={buscandoLibre}
                    className="mecanix-btn-primary"
                    style={{ flex: 1, width: 'auto' }}
                  >
                    Sí, buscar así
                  </button>
                  <button
                    onClick={() => setMensajeLibre(null)}
                    style={{
                      flex: 1, padding: '13px', borderRadius: '50px', border: '1.5px solid #ddd',
                      backgroundColor: '#fff', color: '#888', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                    }}
                  >
                    No, corregir
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Buscador */}
        <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '28px', boxShadow: '0 8px 32px rgba(26,60,94,0.10)', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '20px', color: '#1A3C5E', marginBottom: '20px', fontWeight: '700', letterSpacing: '-0.3px' }}>
            🔍 Busca tu pieza
          </h2>

          {/* Selector tipo de búsqueda */}
          <p style={{ fontSize: '13px', fontWeight: '700', color: '#1A3C5E', marginBottom: '10px' }}>¿Qué estás buscando?</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {TIPO_BUSQUEDA.map(t => (
              <button
                key={t.key}
                onClick={() => { setTipoBusqueda(t.key); setResultados([]); setBusquedaHecha(false); }}
                style={{
                  flex: 1, padding: '10px 6px', borderRadius: '10px', border: '2px solid',
                  borderColor: tipoBusqueda === t.key ? '#1A3C5E' : '#ddd',
                  backgroundColor: tipoBusqueda === t.key ? '#1A3C5E' : '#F8F9FA',
                  color: tipoBusqueda === t.key ? '#fff' : '#888',
                  fontWeight: '700', fontSize: '12px', cursor: 'pointer', textAlign: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: '18px', marginBottom: '2px' }}>{t.label.split(' ')[0]}</div>
                <div>{t.label.split(' ').slice(1).join(' ')}</div>
                <div style={{ fontSize: '10px', fontWeight: '400', marginTop: '2px', opacity: 0.8 }}>{t.desc}</div>
              </button>
            ))}
          </div>

          <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} className="mecanix-select">
            <option value="">🌎 Todas las ciudades</option>
            {CIUDADES_BC.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>

         {Object.keys(catalogoVehiculos).length > 0 ? (
            <>
              <select
                className="mecanix-select"
                value={marcaSel}
                onChange={(e) => {
                  const v = e.target.value;
                  setMarcaSel(v); setModeloSel(''); setModelo('');
                  setMarca(v === 'OTRA' ? '' : v);
                }}
              >
                <option value="">Marca</option>
                {Object.keys(catalogoVehiculos).sort((a, b) => a.localeCompare(b, 'es')).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="OTRA">✏️ Otra marca (escribir)</option>
              </select>

              {marcaSel === 'OTRA' && (
                <input className="mecanix-input" type="text" placeholder="Escribe la marca" value={marca} onChange={(e) => setMarca(e.target.value)} />
              )}

              {marcaSel && marcaSel !== 'OTRA' ? (
                <select
                  className="mecanix-select"
                  value={modeloSel}
                  onChange={(e) => {
                    const v = e.target.value;
                    setModeloSel(v);
                    setModelo(v === 'OTRA' ? '' : v);
                  }}
                >
                  <option value="">Modelo</option>
                  {[...(catalogoVehiculos[marcaSel] || [])].sort((a, b) => a.localeCompare(b, 'es')).map(mo => (
                    <option key={mo} value={mo}>{mo}</option>
                  ))}
                  <option value="OTRA">✏️ Otro modelo (escribir)</option>
                </select>
              ) : null}

              {(marcaSel === 'OTRA' || modeloSel === 'OTRA') && (
                <input className="mecanix-input" type="text" placeholder="Escribe el modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} />
              )}
            </>
          ) : (
            <>
              <input className="mecanix-input" type="text" placeholder="Marca (ej. Nissan)" value={marca} onChange={(e) => setMarca(e.target.value)} />
              <input className="mecanix-input" type="text" placeholder="Modelo (ej. Sentra)" value={modelo} onChange={(e) => setModelo(e.target.value)} />
            </>
          )}
          <input className="mecanix-input" type="number" placeholder="Año (ej. 2015)" value={ano} onChange={(e) => setAno(e.target.value)} />

          {tipoBusqueda === 'vehiculo' && (
            <>
              <select
                value={piezaSeleccion}
                onChange={(e) => { setPiezaSeleccion(e.target.value); if (e.target.value !== 'OTRA') setPiezaBuscada(''); }}
                className="mecanix-select"
              >
                <option value="">🔧 Sin parte específica</option>
                {[...PIEZAS_CATALOGO].sort((a, b) => a.localeCompare(b, 'es')).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value="OTRA">✏️ Otra pieza (escribir)</option>
              </select>

              {piezaSeleccion === 'OTRA' && (
                <>
                  <input className="mecanix-input" type="text" placeholder="Escribe la pieza que buscas" value={piezaBuscada} onChange={(e) => setPiezaBuscada(e.target.value)} />
                  <p style={{ fontSize: '12px', color: '#bbb', marginTop: '-6px', marginBottom: '18px' }}>
                    Te mostraremos los vehículos disponibles — pregunta por tu pieza al reservar
                  </p>
                </>
              )}
            </>
          )}

          {(tipoBusqueda === 'motor' || tipoBusqueda === 'transmision') && (
            <p style={{ fontSize: '12px', color: '#bbb', marginTop: '-6px', marginBottom: '18px' }}>
              Modelo y año son opcionales — puedes buscar solo por marca
            </p>
          )}

          <button onClick={() => { setEncabezadoVehiculo(null); setResultadosMotoresLibre([]); setResultadosTransmisionesLibre([]); setResultadosCercanosLibre([]); setResultadosMotoresCercanosLibre([]); setResultadosTransmisionesCercanosLibre([]); buscarPiezas(); }} disabled={buscando} className="mecanix-btn-primary">
            {buscando ? 'Buscando...' : `🔍 Buscar ${tipoBusqueda === 'motor' ? 'motor' : tipoBusqueda === 'transmision' ? 'transmisión' : 'refacción'}`}
          </button>
        </div>

        {/* Sección 3 pasos */}
        <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 4px 16px rgba(26,60,94,0.07)', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '14px', color: '#1A3C5E', fontWeight: '700', letterSpacing: '1px', marginBottom: '16px', textAlign: 'center' }}>
            ¿CÓMO FUNCIONA?
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            {[
              { emoji: '🔍', titulo: 'Busca', desc: 'Ingresa tu vehículo y la pieza que necesitas' },
              { emoji: '📞', titulo: 'Conecta', desc: 'Contacta al yonke que tiene tu pieza' },
              { emoji: '🔧', titulo: 'Repara', desc: 'Obtén tu refacción y vuelve al camino' },
            ].map((paso, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{paso.emoji}</div>
                <p style={{ fontSize: '13px', fontWeight: '700', color: '#1A3C5E', margin: '0 0 4px' }}>{paso.titulo}</p>
                <p style={{ fontSize: '11px', color: '#888', margin: 0, lineHeight: '1.4' }}>{paso.desc}</p>
              </div>
            ))}
          </div>
        </div>
{/* Banner publicitario RH Diagnóstico */}
        {busquedaHecha && !buscando && resultados.length > 0 && (
          <BannerRH />
        )}

        {/* Leyenda del sello Mecanix Verificado */}
        {busquedaHecha && !buscando && resultados.length > 0 && <LeyendaVerificados />}

        {/* Resultados */}
        {busquedaHecha && !buscando && (

          <div style={{ marginTop: '20px' }}>
            {encabezadoVehiculo && (
              <p style={{ color: '#1A3C5E', fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>
                {encabezadoVehiculo}
              </p>
            )}
            <h3 style={{ color: '#1A3C5E', fontSize: '15px', marginBottom: '12px', fontWeight: '600' }}>
              {getHeaderText()}
            </h3>

            {resultados.length === 0 && resultadosCercanosLibre.length === 0 && resultadosMotoresLibre.length === 0 && resultadosMotoresCercanosLibre.length === 0 && resultadosTransmisionesLibre.length === 0 && resultadosTransmisionesCercanosLibre.length === 0 && (
              <div style={avisoActualizacionStyle}>
                <p style={{ margin: 0, fontSize: '13px', color: '#1A3C5E', lineHeight: '1.6' }}>
                  📦 No te desanimes — seguimos actualizando el inventario día con día. Vuelve a intentar más tarde o{' '}
                  <a href="https://wa.me/526611034260" target="_blank" rel="noopener noreferrer" style={{ color: '#E8720C', fontWeight: 'bold' }}>
                    escríbenos por WhatsApp
                  </a>.
                </p>
              </div>
            )}

            {(resultadosMotoresLibre.length > 0 || resultadosMotoresCercanosLibre.length > 0 || resultadosTransmisionesLibre.length > 0 || resultadosTransmisionesCercanosLibre.length > 0) && (resultados.length > 0 || resultadosCercanosLibre.length > 0) && (
              <p style={{ color: '#1A3C5E', fontSize: '13px', fontWeight: '700', margin: '4px 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Partes
              </p>
            )}

            {bannerTexto && tipoBusqueda === 'vehiculo' && resultados.length > 0 && (
              <div style={compatibilidadBannerStyle}>
                <p style={{ margin: 0, fontSize: '13px', color: '#7A4F00', fontWeight: 'bold' }}>
                  ⚠️ Resultados de años {tipoResultado === 'cercano' ? 'similares' : 'distintos'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#7A4F00' }}>{bannerTexto}</p>
              </div>
            )}

            {piezaNoEncontrada && (
              <p style={{ color: '#aaa', fontSize: '13px', marginTop: '-6px', marginBottom: '14px' }}>
                Puedes preguntar directamente por tu pieza al reservar — el yonke te confirma si la tiene.
              </p>
            )}

            {/* "Coincidencia exacta" solo se rotula cuando también hay un grupo de cercanos con el
                que contrastar — si no hay cercanos, resultados ya es el único grupo (comportamiento
                previo sin cambios). */}
            {resultados.length > 0 && resultadosCercanosLibre.length > 0 && (
              <p style={groupHeaderStyle}>✅ Coincidencia exacta</p>
            )}
            {resultados.map((r, i) => renderTarjetaVehiculo(r, i))}

            {resultadosCercanosLibre.length > 0 && (
              <>
                <p style={groupHeaderStyle}>🔄 Años cercanos (±3)</p>
                <p style={groupSubtextStyle}>
                  Estas son alternativas de años próximos a tu búsqueda, no el año exacto — muchas piezas son compatibles entre años cercanos, confirma con el yonke.
                </p>
                {resultadosCercanosLibre.map((r, i) => renderTarjetaVehiculo(r, `cercano-${i}`))}
              </>
            )}

            {/* Motores y transmisiones sueltos — solo del buscador inteligente; el buscador
                estructurado ya tiene su propia pestaña Motor/Transmisión y no llena estos arreglos. */}
            {(resultadosMotoresLibre.length > 0 || resultadosMotoresCercanosLibre.length > 0) && (
              <>
                <p style={{ color: '#1A3C5E', fontSize: '13px', fontWeight: '700', margin: '20px 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🔧 Motores
                </p>
                {resultadosMotoresLibre.length > 0 && resultadosMotoresCercanosLibre.length > 0 && (
                  <p style={groupHeaderStyle}>✅ Coincidencia exacta</p>
                )}
                {resultadosMotoresLibre.map((r, i) => renderTarjetaMotor(r, `motor-${i}`, '🔧'))}
                {resultadosMotoresCercanosLibre.length > 0 && (
                  <>
                    <p style={groupHeaderStyle}>🔄 Años cercanos (±3)</p>
                    {resultadosMotoresCercanosLibre.map((r, i) => renderTarjetaMotor(r, `motor-cercano-${i}`, '🔧'))}
                  </>
                )}
              </>
            )}

            {(resultadosTransmisionesLibre.length > 0 || resultadosTransmisionesCercanosLibre.length > 0) && (
              <>
                <p style={{ color: '#1A3C5E', fontSize: '13px', fontWeight: '700', margin: '20px 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ⚙️ Transmisiones
                </p>
                {resultadosTransmisionesLibre.length > 0 && resultadosTransmisionesCercanosLibre.length > 0 && (
                  <p style={groupHeaderStyle}>✅ Coincidencia exacta</p>
                )}
                {resultadosTransmisionesLibre.map((r, i) => renderTarjetaMotor(r, `transmision-${i}`, '⚙️'))}
                {resultadosTransmisionesCercanosLibre.length > 0 && (
                  <>
                    <p style={groupHeaderStyle}>🔄 Años cercanos (±3)</p>
                    {resultadosTransmisionesCercanosLibre.map((r, i) => renderTarjetaMotor(r, `transmision-cercano-${i}`, '⚙️'))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <a href="/calificar" style={{ color: '#bbb', fontSize: '13px', textDecoration: 'underline' }}>
            ¿Ya compraste? Califica tu experiencia
          </a>
        </div>

        {/* CTA yonkeros */}
        {/* Sección SEO */}
        <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 4px 16px rgba(26,60,94,0.07)', marginTop: '12px', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1A3C5E', marginBottom: '12px' }}>
            Refacciones usadas en Baja California
          </h2>
          <p style={{ fontSize: '13px', color: '#666', lineHeight: '1.8', margin: 0 }}>
            Mecanix Yonke Virtual conecta compradores de <strong>refacciones usadas en Tijuana</strong>, Mexicali, Ensenada, Tecate y Playas de Rosarito con los mejores <strong>yonkes de Baja California</strong>. Encuentra <strong>autopartes usadas</strong> como motores, transmisiones, puertas, faroles, defensas y más piezas de carro a precios accesibles. Busca por marca, modelo y año — tenemos inventario de Nissan, Toyota, Chevrolet, Honda, Ford y muchas marcas más. El <strong>deshuesadero virtual</strong> más completo de Baja California.
          </p>
        </div>
        <div style={yonkeCtaStyle}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🏪</div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1A3C5E', margin: '0 0 10px' }}>
            ¿Administras un yonke?
          </h3>
          <p style={{ fontSize: '14px', color: '#555', margin: '0 0 6px', lineHeight: '1.6' }}>
            Únete a nuestra red y conecta con miles de compradores en Baja California.
          </p>
          <p style={{ fontSize: '12px', color: '#aaa', margin: '0 0 20px', lineHeight: '1.6' }}>
            ⚠️ Tu perfil será verificado por nuestro equipo en un plazo de 24 horas antes de aparecer en la plataforma.
          </p>
          <a href="/panel/registro" style={yonkeCtaButtonStyle}>
            🆓 Registra tu yonke gratis
          </a>
        </div>

        {/* Planes de suscripción */}
        <div id="planes" style={{ marginTop: '32px' }}>

          {/* Banner de bienvenida — oferta de una sola vez al registrarse por primera vez
              (NO permanente, no es un plan). Va arriba de todo para que sea lo primero que
              vea un yonke nuevo que llega a esta sección. */}
          <div style={{
            background: 'linear-gradient(135deg, #1A3C5E 0%, #234b73 100%)',
            borderRadius: '20px', padding: '28px 24px', marginBottom: '28px',
            textAlign: 'center', boxShadow: '0 8px 24px rgba(26,60,94,0.25)',
            border: '2px solid #E8720C',
          }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#FFC98C', letterSpacing: '1px', margin: '0 0 8px', textTransform: 'uppercase' }}>
              Oferta de bienvenida — solo la primera vez
            </p>
            <h2 style={{ fontSize: '21px', fontWeight: '700', color: '#fff', margin: '0 0 16px' }}>
              🎁 Bienvenida para yonkes nuevos
            </h2>
            <div style={{ textAlign: 'left', maxWidth: '420px', margin: '0 auto 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ color: '#fff', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                ✅ Tu primera captura de inventario corre por nuestra cuenta — vamos a tu yonke
                y cargamos todos tus vehículos <strong style={{ color: '#E8720C' }}>GRATIS</strong>.
              </p>
              <p style={{ color: '#fff', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                ✅ Un mes de Premium <strong style={{ color: '#E8720C' }}>GRATIS</strong> — tu
                página con tu marca, tu inventario y clientes buscándote.
              </p>
            </div>
            <p style={{ color: '#C5D4E8', fontSize: '12.5px', lineHeight: '1.6', margin: '0 auto 22px', maxWidth: '420px' }}>
              Después tú decides: te quedas en Premium, pasas a Básico, o contratas Captura a
              Domicilio para que sigamos actualizando tu inventario por ti. Sin compromiso.
            </p>
            <a
              href="https://wa.me/5216611034260?text=Hola%2C%20quiero%20aprovechar%20la%20bienvenida%20para%20yonkes%20nuevos%20de%20Mecanix%20Yonke%20Virtual%20(primera%20captura%20gratis%20%2B%20mes%20Premium%20gratis)"
              target="_blank"
              rel="noopener noreferrer"
              style={yonkeCtaButtonStyle}
              onClick={() => registrarEvento('clic_bienvenida_yonke_nuevo', {
                ubicacion: 'seccion_planes',
                plan_actual: 'visitante',
              })}
            >
              🎁 Empezar gratis
            </a>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1A3C5E', margin: '0 0 8px' }}>
              Planes para tu yonke
            </h2>
            <p style={{ fontSize: '14px', color: '#666', margin: 0, lineHeight: '1.5' }}>
              Pon tu inventario en línea y recibe clientes listos para comprar.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>

            {/* Plan Básico */}
            <div style={planCardStyle}>
              <p style={planNombreStyle}>Plan Básico</p>
              <p style={planPrecioStyle}>Gratis</p>
              <p style={planDescStyle}>
                Todo lo necesario para que los clientes te encuentren y aparten piezas contigo.
              </p>
              <ul style={planListaStyle}>
                {[
                  'Sube y administra tu inventario de vehículos y piezas',
                  'Tu yonke aparece en los resultados cuando tienes la pieza que buscan',
                  'Nombre, dirección y teléfono de tu yonke visibles para el cliente',
                  'Botón de WhatsApp para que el cliente te contacte directo',
                  'Botón de "Reservar" para apartar piezas',
                  'Control de reservaciones desde tu panel',
                ].map((item) => (
                  <li key={item} style={planItemStyle}>
                    <span style={{ color: '#1A3C5E', fontWeight: '700', marginRight: '8px' }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div style={planNotaAzulStyle}>
                Sin caducidad: gratis para siempre. Solo dejas la plataforma si tú decides darte de baja.
              </div>
              <a
                href="/panel/registro"
                className="mecanix-btn-primary"
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '18px' }}
              >
                Registra tu yonke gratis
              </a>
            </div>

            {/* Plan Premium */}
            <div style={planPremiumCardStyle}>
              <div style={premiumBadgeStyle}>Recomendado</div>
              <p style={planNombreStyle}>Plan Premium</p>
              <p style={planPrecioStyle}>$500/mes</p>
              <p style={planDescStyle}>
                Para yonkes que quieren vender más y llevar el control completo de su negocio.
              </p>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#1A3C5E', margin: '0 0 10px' }}>
                ✓ Todo lo del Plan Básico, más:
              </p>
              <ul style={planListaStyle}>
                {[
                  'Tu propio buscador con tu marca: tuyonke.mecanixyonkevirtual.com — tu logo, tus colores, tu nombre',
                  'Registro de ventas y venta manual',
                  'Notificaciones push al recibir una reservación',
                  'Botón de WhatsApp para contactar al cliente que reservó',
                  'Indicador de piezas agotadas en tu inventario',
                  'Control de disponibilidad de piezas desde tu propio panel',
                ].map((item) => (
                  <li key={item} style={planItemStyle}>
                    <span style={{ color: '#E8720C', fontWeight: '700', marginRight: '8px' }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div style={planNotaNaranjaStyle}>
                Incluye periodo de prueba sin costo
              </div>
              <a
                href="https://wa.me/5216611034260?text=Hola%2C%20me%20interesa%20el%20Plan%20Premium%20de%20Mecanix%20Yonke%20Virtual"
                target="_blank"
                rel="noopener noreferrer"
                className="mecanix-btn-primary"
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '18px' }}
                onClick={() => registrarEvento('clic_premium', {
                  ubicacion: 'seccion_planes',
                  plan_actual: 'visitante',
                })}
              >
                Quiero Premium
              </a>
            </div>

            {/* Plan Marca Propia */}
            <div style={planCardStyle}>
              <p style={planNombreStyle}>Plan Marca Propia</p>
              <p style={planPrecioStyle}>$900/mes</p>
              <p style={planDescStyle}>
                Para el yonke que quiere su propia página web, con su dominio, sin que aparezca nadie más.
              </p>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#1A3C5E', margin: '0 0 10px' }}>
                ✓ Todo lo del Plan Premium, más:
              </p>
              <ul style={planListaStyle}>
                {[
                  'Tu propio dominio (tunegocio.com), no un subdominio compartido',
                  'Nosotros configuramos todo el DNS y el certificado de seguridad',
                  'Tu dominio siempre es tuyo — nosotros solo rentamos el motor de búsqueda que corre detrás',
                ].map((item) => (
                  <li key={item} style={planItemStyle}>
                    <span style={{ color: '#1A3C5E', fontWeight: '700', marginRight: '8px' }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="https://wa.me/5216611034260?text=Hola%2C%20me%20interesa%20el%20Plan%20Marca%20Propia%20de%20Mecanix%20Yonke%20Virtual"
                target="_blank"
                rel="noopener noreferrer"
                className="mecanix-btn-primary"
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '18px' }}
                onClick={() => registrarEvento('clic_marca_propia', {
                  ubicacion: 'seccion_planes',
                  plan_actual: 'visitante',
                })}
              >
                Quiero Marca Propia
              </a>
            </div>

          </div>

          {/* Complemento — NO es un 4º plan, se suma a cualquier plan de arriba (Básico,
              Premium o Marca Propia). Por eso vive fuera del grid de 3 columnas, con su
              propio marco punteado que lo distingue visualmente. */}
          <div style={{
            marginTop: '24px', backgroundColor: '#fff', borderRadius: '18px', padding: '22px 24px',
            boxShadow: '0 4px 16px rgba(26,60,94,0.08)', border: '1.5px dashed #E8720C',
          }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#E8720C', letterSpacing: '0.5px', margin: '0 0 8px', textTransform: 'uppercase' }}>
              Complemento — se suma a cualquier plan
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
              <p style={{ fontSize: '18px', fontWeight: '700', color: '#1A3C5E', margin: 0 }}>
                🚗 Captura a Domicilio
              </p>
              <p style={{ fontSize: '18px', fontWeight: '700', color: '#E8720C', margin: 0 }}>
                $800/mes
              </p>
            </div>
            <p style={{ fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 0 18px' }}>
              ¿No tienes tiempo de subir tus carros? Nosotros vamos a tu yonke una vez al mes y
              cargamos todo tu inventario nuevo por ti. Tú no haces nada.
            </p>
            <a
              href="https://wa.me/5216611034260?text=Hola%2C%20me%20interesa%20el%20complemento%20Captura%20a%20Domicilio%20de%20Mecanix%20Yonke%20Virtual"
              target="_blank"
              rel="noopener noreferrer"
              className="mecanix-btn-secondary"
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
              onClick={() => registrarEvento('clic_captura_domicilio', {
                ubicacion: 'seccion_planes',
                plan_actual: 'visitante',
              })}
            >
              Contratar / Más información
            </a>
          </div>
        </div>

      </div>

      {false && yonkesConLogo.length > 0 && (
        <div style={{ marginTop: '48px', overflow: 'hidden', padding: '20px 0', backgroundColor: '#fff', borderTop: '1px solid #eee' }}>
          <p style={{ textAlign: 'center', color: '#ccc', fontSize: '11px', marginBottom: '16px', letterSpacing: '2px', fontWeight: '600' }}>
            YONKES REGISTRADOS EN LA PLATAFORMA
          </p>
          <div className="banner-track">
            {[...yonkesConLogo, ...yonkesConLogo].map((y, i) => (
              <div key={i} style={{ flexShrink: 0, padding: '0 32px', display: 'flex', alignItems: 'center' }}>
                <img src={y.logoUrl} alt={y.nombre} style={{ height: '60px', objectFit: 'contain' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {modalVisible && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            {numeroPedido ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '48px', margin: '0 0 12px' }}>✅</p>
                <h3 style={{ color: '#1A3C5E', fontSize: '20px', marginBottom: '8px', fontWeight: '700' }}>¡Reservación confirmada!</h3>
                <p style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>Presenta este número en el yonke:</p>
                <div style={numeroPedidoBox}>{numeroPedido}</div>
                <button onClick={cerrarModal} className="mecanix-btn-primary" style={{ marginTop: '20px' }}>Cerrar</button>
              </div>
            ) : (
              <>
                <h3 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '4px', fontWeight: '700' }}>Reservar pieza</h3>
                <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>en {yonkeSeleccionado?.yonkeNombre}</p>
                <input className="mecanix-input" type="text" placeholder="¿Qué pieza necesitas?" value={piezaSolicitada} onChange={(e) => setPiezaSolicitada(e.target.value)} />
                <input className="mecanix-input" type="text" placeholder="Tu nombre" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} />
                <input className="mecanix-input" type="tel" placeholder="Tu teléfono" value={telefonoCliente} onChange={(e) => setTelefonoCliente(e.target.value)} />
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  backgroundColor: '#F0F4F8', borderRadius: '10px', padding: '12px',
                  marginBottom: '12px', cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={interesaEnvio}
                    onChange={(e) => setInteresaEnvio(e.target.checked)}
                    style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: '#E8720C', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', color: '#1A3C5E', lineHeight: '1.4' }}>
                    🚚 <strong>¿Te interesaría entrega a domicilio con costo?</strong>
                    <span style={{ display: 'block', fontSize: '11px', color: '#888', marginTop: '2px' }}>
                      Próximamente — tu respuesta nos ayuda a saber si ofrecerlo
                    </span>
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button onClick={cerrarModal} style={cancelButtonStyle}>Cancelar</button>
                  <button onClick={confirmarReserva} disabled={guardando} className="mecanix-btn-primary" style={{ flex: 1, width: 'auto', marginTop: 0 }}>
                    {guardando ? 'Generando...' : 'Confirmar'}
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

const contactLinkStyle = { fontSize: '12px', color: '#1A3C5E', textDecoration: 'none', fontWeight: '600', backgroundColor: '#fff', padding: '7px 14px', borderRadius: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' };
const resultCardStyle = { backgroundColor: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '14px', boxShadow: '0 4px 16px rgba(26,60,94,0.08)', position: 'relative', overflow: 'hidden' };
const groupHeaderStyle = { color: '#1A3C5E', fontSize: '13px', fontWeight: '700', margin: '18px 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' };
const groupSubtextStyle = { color: '#888', fontSize: '12px', margin: '0 0 12px', lineHeight: '1.5' };
const premiumBadgeStyle = { position: 'absolute', top: '14px', right: '14px', backgroundColor: '#FAEEDA', color: '#854F0B', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' };
const pagoTagStyle = { backgroundColor: '#F0F4F8', color: '#1A3C5E', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' };
const whatsappButtonStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', borderRadius: '50px', backgroundColor: '#25D366', color: '#fff', fontWeight: '700', fontSize: '13px', textDecoration: 'none', whiteSpace: 'nowrap' };
const entregaButtonStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '12px 16px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontWeight: '700', fontSize: '13px', marginTop: '8px', cursor: 'pointer', fontFamily: "'Inter', sans-serif" };
const cancelButtonStyle = { flex: 1, padding: '14px', borderRadius: '50px', border: 'none', backgroundColor: '#F4F5F5', color: '#888', fontWeight: '700', fontSize: '15px', cursor: 'pointer' };
const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000, backdropFilter: 'blur(4px)' };
const modalStyle = { backgroundColor: '#fff', borderRadius: '20px', padding: '28px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const numeroPedidoBox = { backgroundColor: '#1A3C5E', color: '#fff', fontSize: '22px', fontWeight: '700', padding: '16px', borderRadius: '12px', letterSpacing: '2px' };
const compatibilidadBannerStyle = { backgroundColor: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' };
const avisoActualizacionStyle = { backgroundColor: '#EEF4FA', border: '1px solid #C5D8EC', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' };
const yonkeCtaStyle = { background: 'linear-gradient(135deg, #EEF2F7 0%, #E8EFF7 100%)', borderRadius: '20px', padding: '28px', marginTop: '24px', textAlign: 'center', border: '1.5px solid #C5D4E8' };
const yonkeCtaButtonStyle = { display: 'inline-block', background: 'linear-gradient(135deg, #E8720C 0%, #cf6209 100%)', color: '#fff', fontWeight: '700', fontSize: '14px', padding: '14px 28px', borderRadius: '50px', textDecoration: 'none', boxShadow: '0 4px 14px rgba(232,114,12,0.4)' };
const planCardStyle = { backgroundColor: '#fff', borderRadius: '20px', padding: '28px 24px', boxShadow: '0 4px 16px rgba(26,60,94,0.08)', position: 'relative' };
const planPremiumCardStyle = { ...planCardStyle, border: '2px solid #E8720C' };
const planNombreStyle = { fontSize: '15px', fontWeight: '700', color: '#1A3C5E', margin: '0 0 4px', letterSpacing: '0.3px', textTransform: 'uppercase' };
const planPrecioStyle = { fontSize: '22px', fontWeight: '700', color: '#1A3C5E', margin: '0 0 10px' };
const planDescStyle = { fontSize: '13px', color: '#666', lineHeight: '1.6', margin: '0 0 16px' };
const planListaStyle = { listStyle: 'none', padding: 0, margin: '0 0 4px' };
const planItemStyle = { display: 'flex', alignItems: 'flex-start', fontSize: '13px', color: '#444', lineHeight: '1.5', marginBottom: '10px' };
const planNotaAzulStyle = { backgroundColor: '#EEF2F7', border: '1.5px dashed #1A3C5E', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#1A3C5E', lineHeight: '1.5', fontWeight: '600', marginTop: '16px' };
const planNotaNaranjaStyle = { backgroundColor: '#FEF3EC', border: '1.5px dashed #E8720C', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#7A3C0C', lineHeight: '1.5', fontWeight: '600', marginTop: '16px' };