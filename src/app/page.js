'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from './lib/firebase';

export default function Home() {
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
      } catch (error) {
        console.error(error);
      }
    }
    cargarLogos();
  }, []);

  async function buscarEnAnos(yonkesSnap, marcaBuscar, modeloBuscar, anos) {
    const encontrados = [];
    for (const yonkeDoc of yonkesSnap.docs) {
      const yonkeData = yonkeDoc.data();
      if (!yonkeData.activo) continue;

      for (const anoRango of anos) {
        const vehiculosRef = collection(db, 'yonkes', yonkeDoc.id, 'vehiculos');
        const q = query(vehiculosRef, where('ano', '==', anoRango));
        const vehiculosSnap = await getDocs(q);

        const vehiculosCoincidentes = vehiculosSnap.docs.filter((vDoc) => {
          const data = vDoc.data();
          return data.marca?.toLowerCase() === marcaBuscar.trim().toLowerCase() &&
            data.modelo?.toLowerCase() === modeloBuscar.trim().toLowerCase();
        });

        for (const vDoc of vehiculosCoincidentes) {
          const yaExiste = encontrados.some(
            r => r.yonkeId === yonkeDoc.id && r.vehiculoId === vDoc.id
          );
          if (yaExiste) continue;

          const calificacion = await obtenerCalificacion(yonkeDoc.id);
          encontrados.push({
            yonkeId: yonkeDoc.id,
            vehiculoId: vDoc.id,
            yonkeNombre: yonkeData.nombre,
            direccion: yonkeData.direccion,
            telefono: yonkeData.telefono,
            metodosPago: yonkeData.metodosPago || [],
            plan: yonkeData.plan,
            vehiculo: vDoc.data(),
            calificacion,
          });
        }
      }
    }
    return encontrados;
  }

  async function buscarCualquierAno(yonkesSnap, marcaBuscar, modeloBuscar) {
    const encontrados = [];
    for (const yonkeDoc of yonkesSnap.docs) {
      const yonkeData = yonkeDoc.data();
      if (!yonkeData.activo) continue;

      const vehiculosRef = collection(db, 'yonkes', yonkeDoc.id, 'vehiculos');
      const vehiculosSnap = await getDocs(vehiculosRef);

      const vehiculosCoincidentes = vehiculosSnap.docs.filter((vDoc) => {
        const data = vDoc.data();
        return data.marca?.toLowerCase() === marcaBuscar.trim().toLowerCase() &&
          data.modelo?.toLowerCase() === modeloBuscar.trim().toLowerCase();
      });

      for (const vDoc of vehiculosCoincidentes) {
        const yaExiste = encontrados.some(
          r => r.yonkeId === yonkeDoc.id && r.vehiculoId === vDoc.id
        );
        if (yaExiste) continue;

        const calificacion = await obtenerCalificacion(yonkeDoc.id);
        encontrados.push({
          yonkeId: yonkeDoc.id,
          vehiculoId: vDoc.id,
          yonkeNombre: yonkeData.nombre,
          direccion: yonkeData.direccion,
          telefono: yonkeData.telefono,
          metodosPago: yonkeData.metodosPago || [],
          plan: yonkeData.plan,
          vehiculo: vDoc.data(),
          calificacion,
        });
      }
    }
    return encontrados;
  }

  async function buscarPiezas() {
    if (!marca || !modelo || !ano) {
      alert('Llena marca, modelo y año');
      return;
    }
    setBuscando(true);
    setBusquedaHecha(true);
    setPiezaNoEncontrada(false);
    setTipoResultado('exacto');

    try {
      const yonkesSnap = await getDocs(collection(db, 'yonkes'));
      const conPiezaExacta = [];
      const soloVehiculo = [];

      for (const yonkeDoc of yonkesSnap.docs) {
        const yonkeData = yonkeDoc.data();
        if (!yonkeData.activo) continue;

        const vehiculosRef = collection(db, 'yonkes', yonkeDoc.id, 'vehiculos');
        const q = query(vehiculosRef, where('ano', '==', parseInt(ano)));
        const vehiculosSnapTodos = await getDocs(q);

        const vehiculosCoincidentes = vehiculosSnapTodos.docs.filter((vDoc) => {
          const data = vDoc.data();
          return data.marca?.toLowerCase() === marca.trim().toLowerCase() &&
            data.modelo?.toLowerCase() === modelo.trim().toLowerCase();
        });

        for (const vDoc of vehiculosCoincidentes) {
          const calificacion = await obtenerCalificacion(yonkeDoc.id);
          const resultadoBase = {
            yonkeId: yonkeDoc.id,
            vehiculoId: vDoc.id,
            yonkeNombre: yonkeData.nombre,
            direccion: yonkeData.direccion,
            telefono: yonkeData.telefono,
            metodosPago: yonkeData.metodosPago || [],
            plan: yonkeData.plan,
            vehiculo: vDoc.data(),
            calificacion,
          };

          if (!piezaBuscada.trim()) {
            soloVehiculo.push(resultadoBase);
            continue;
          }

          const piezasRef = collection(db, 'yonkes', yonkeDoc.id, 'vehiculos', vDoc.id, 'piezas');
          const piezasSnap = await getDocs(piezasRef);
          const tienePiezaDisponible = piezasSnap.docs.some((pDoc) => {
            const data = pDoc.data();
            return data.disponible &&
              data.nombre.toLowerCase().includes(piezaBuscada.trim().toLowerCase());
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

      ordenar(conPiezaExacta);
      ordenar(soloVehiculo);

      let resultadosFinales = [];

      if (piezaBuscada.trim() && conPiezaExacta.length === 0 && soloVehiculo.length > 0) {
        setPiezaNoEncontrada(true);
        resultadosFinales = soloVehiculo;
        setTipoResultado('exacto');
      } else {
        setPiezaNoEncontrada(false);
        resultadosFinales = piezaBuscada.trim() ? conPiezaExacta : soloVehiculo;
      }

      if (resultadosFinales.length === 0) {
        const anosRango = [];
        for (let d = 1; d <= 3; d++) {
          anosRango.push(parseInt(ano) - d);
          anosRango.push(parseInt(ano) + d);
        }
        const cercanos = await buscarEnAnos(yonkesSnap, marca, modelo, anosRango);
        ordenar(cercanos);
        if (cercanos.length > 0) {
          resultadosFinales = cercanos;
          setTipoResultado('cercano');
        }
      }

      if (resultadosFinales.length === 0) {
        const cualquierAno = await buscarCualquierAno(yonkesSnap, marca, modelo);
        ordenar(cualquierAno);
        if (cualquierAno.length > 0) {
          resultadosFinales = cualquierAno;
          setTipoResultado('cualquierAno');
        }
      }

      setResultados(resultadosFinales);
    } catch (error) {
      console.error(error);
      alert('Hubo un error al buscar');
    } finally {
      setBuscando(false);
    }
  }

  function abrirModalReserva(resultado) {
    setYonkeSeleccionado(resultado);
    setPiezaSolicitada(piezaNoEncontrada ? piezaBuscada.trim() : '');
    setNombreCliente('');
    setTelefonoCliente('');
    setNumeroPedido(null);
    setModalVisible(true);
  }

  function generarNumeroPedido() {
    const random = Math.floor(1000 + Math.random() * 9000);
    const fecha = new Date();
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `MYV-${mes}${dia}-${random}`;
  }

  async function confirmarReserva() {
    if (!piezaSolicitada || !nombreCliente || !telefonoCliente) {
      alert('Llena todos los campos');
      return;
    }
    setGuardando(true);
    try {
      const numero = generarNumeroPedido();
      await addDoc(collection(db, 'reservaciones'), {
        numeroPedido: numero,
        yonkeId: yonkeSeleccionado.yonkeId,
        vehiculoId: yonkeSeleccionado.vehiculoId,
        yonkeNombre: yonkeSeleccionado.yonkeNombre,
        vehiculo: yonkeSeleccionado.vehiculo,
        piezaSolicitada: piezaSolicitada.trim(),
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
      setGuardando(false);
    }
  }

  function cerrarModal() {
    setModalVisible(false);
    setYonkeSeleccionado(null);
    setNumeroPedido(null);
  }

  const metodosPagoLabels = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    spei: 'SPEI',
    codi: 'CoDi',
    zelle: 'Zelle',
    paypal: 'PayPal',
  };

  function getHeaderText() {
    if (resultados.length === 0) return 'No encontramos ese vehículo en ningún yonke registrado';
    if (tipoResultado === 'cercano') return `No encontramos el ${marca} ${modelo} ${ano} exacto, pero hay ${resultados.length} yonke(s) con años cercanos`;
    if (tipoResultado === 'cualquierAno') return `No encontramos años cercanos, pero hay ${resultados.length} yonke(s) con ${marca} ${modelo} en otros años`;
    if (piezaNoEncontrada) return `No encontramos esa pieza exacta, pero ${resultados.length} yonke(s) tienen este vehículo`;
    return `${resultados.length} yonke(s) tienen este vehículo`;
  }

  function getBannerCompatibilidad() {
    if (tipoResultado === 'cercano') {
      return 'Muchas piezas son compatibles entre años. Confirma con el yonke si la pieza aplica para tu ' + marca + ' ' + modelo + ' ' + ano + '.';
    }
    if (tipoResultado === 'cualquierAno') {
      return 'No encontramos años cercanos, pero estos yonkes tienen el mismo modelo. Confirma con el yonke si la pieza es compatible con tu ' + ano + ' antes de reservar.';
    }
    return null;
  }

  const bannerTexto = getBannerCompatibilidad();

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '24px 16px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/mecanix-logo.png"
            alt="Mecanix"
            style={{ width: '280px', maxWidth: '100%', margin: '0 auto', display: 'block' }}
          />
          <p style={{ fontSize: '16px', color: '#E8720C', letterSpacing: '2px', marginTop: '8px', fontWeight: 'bold' }}>
            YONKE VIRTUAL
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '14px', flexWrap: 'wrap' }}>
            <a
              href="https://wa.me/526611034260"
              target="_blank"
              rel="noopener noreferrer"
              style={contactLinkStyle}
            >
              💬 WhatsApp
            </a>

            <a
              href="mailto:powerpctijuana@gmail.com"
              style={contactLinkStyle}
            >
              ✉️ Correo
            </a>

            <a
              href="/privacidad"
              style={contactLinkStyle}
            >
              🔒 Privacidad
            </a>
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '18px', color: '#1A3C5E', marginBottom: '16px', fontWeight: 'bold' }}>
            Busca tu pieza
          </h2>

          <input type="text" placeholder="Marca (ej. Nissan)" value={marca} onChange={(e) => setMarca(e.target.value)} style={inputStyle} />
          <input type="text" placeholder="Modelo (ej. Sentra)" value={modelo} onChange={(e) => setModelo(e.target.value)} style={inputStyle} />
          <input type="number" placeholder="Año (ej. 2015)" value={ano} onChange={(e) => setAno(e.target.value)} style={inputStyle} />
          <input type="text" placeholder="¿Qué pieza buscas? (opcional)" value={piezaBuscada} onChange={(e) => setPiezaBuscada(e.target.value)} style={inputStyle} />
          <p style={{ fontSize: '12px', color: '#999', marginTop: '-6px', marginBottom: '14px' }}>
            Déjalo vacío si solo quieres ver qué vehículos hay disponibles
          </p>

          <button onClick={buscarPiezas} disabled={buscando} style={buttonStyle}>
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {busquedaHecha && !buscando && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ color: '#1A3C5E', fontSize: '15px', marginBottom: '12px' }}>
              {getHeaderText()}
            </h3>

            {bannerTexto && (
              <div style={compatibilidadBannerStyle}>
                <p style={{ margin: 0, fontSize: '13px', color: '#7A4F00', fontWeight: 'bold' }}>
                  ⚠️ Resultados de años {tipoResultado === 'cercano' ? 'similares' : 'distintos'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#7A4F00' }}>
                  {bannerTexto}
                </p>
              </div>
            )}

            {piezaNoEncontrada && (
              <p style={{ color: '#888', fontSize: '13px', marginTop: '-6px', marginBottom: '14px' }}>
                Puedes preguntar directamente por tu pieza al reservar — el yonke te confirma si la tiene.
              </p>
            )}

            {resultados.map((r, i) => (
              <div key={i} style={resultCardStyle}>
                {r.plan === 'premium' && (
                  <div style={premiumBadgeStyle}>⭐ Premium</div>
                )}

                <p style={{ fontWeight: 'bold', color: '#1A3C5E', fontSize: '16px', margin: 0 }}>
                  {r.yonkeNombre}
                </p>

                {r.calificacion.promedio ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <span style={{ color: '#E8720C', fontSize: '14px' }}>
                      {'★'.repeat(Math.round(r.calificacion.promedio))}
                      {'☆'.repeat(5 - Math.round(r.calificacion.promedio))}
                    </span>
                    <span style={{ color: '#888', fontSize: '13px' }}>
                      {r.calificacion.promedio} ({r.calificacion.total} {r.calificacion.total === 1 ? 'opinión' : 'opiniones'})
                    </span>
                  </div>
                ) : (
                  <p style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>Sin calificaciones todavía</p>
                )}

                <p style={{ color: '#666', fontSize: '14px', margin: '8px 0 4px' }}>📍 {r.direccion}</p>
                <p style={{ color: '#666', fontSize: '14px', margin: '4px 0' }}>📞 {r.telefono}</p>
                <p style={{ color: '#1A3C5E', fontSize: '14px', margin: '8px 0 4px', fontWeight: 'bold' }}>
                  🚗 {r.vehiculo.marca} {r.vehiculo.modelo} {r.vehiculo.ano}
                  {(tipoResultado === 'cercano' || tipoResultado === 'cualquierAno') && r.vehiculo.ano !== parseInt(ano) && (
                    <span style={{ fontSize: '11px', color: '#E8720C', fontWeight: 'normal', marginLeft: '6px' }}>
                      (confirma compatibilidad con tu {ano})
                    </span>
                  )}
                </p>

                {r.metodosPago.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', marginBottom: '12px' }}>
                    {r.metodosPago.map((m) => (
                      <span key={m} style={pagoTagStyle}>{metodosPagoLabels[m] || m}</span>
                    ))}
                  </div>
                )}

                <button onClick={() => abrirModalReserva(r)} style={reservarButtonStyle}>
                  Reservar pieza
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <a href="/calificar" style={{ color: '#888', fontSize: '13px', textDecoration: 'underline' }}>
            ¿Ya compraste? Califica tu experiencia
          </a>
        </div>
      </div>

      {yonkesConLogo.length > 0 && (
        <div style={{ marginTop: '48px', overflow: 'hidden', padding: '20px 0', backgroundColor: '#fff', borderTop: '1px solid #eee' }}>
          <p style={{ textAlign: 'center', color: '#888', fontSize: '12px', marginBottom: '16px', letterSpacing: '1px' }}>
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
                <p style={{ fontSize: '40px', margin: '0 0 8px' }}>✅</p>
                <h3 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '8px' }}>¡Reservación confirmada!</h3>
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>Presenta este número en el yonke:</p>
                <div style={numeroPedidoBox}>{numeroPedido}</div>
                <button onClick={cerrarModal} style={{ ...buttonStyle, marginTop: '20px' }}>Cerrar</button>
              </div>
            ) : (
              <>
                <h3 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '4px' }}>Reservar pieza</h3>
                <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>en {yonkeSeleccionado?.yonkeNombre}</p>

                <input type="text" placeholder="¿Qué pieza necesitas? (ej. Espejo lateral izquierdo)" value={piezaSolicitada} onChange={(e) => setPiezaSolicitada(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="Tu nombre" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} style={inputStyle} />
                <input type="tel" placeholder="Tu teléfono" value={telefonoCliente} onChange={(e) => setTelefonoCliente(e.target.value)} style={inputStyle} />

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button onClick={cerrarModal} style={cancelButtonStyle}>Cancelar</button>
                  <button onClick={confirmarReserva} disabled={guardando} style={buttonStyle}>
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

const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px', fontSize: '15px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box' };
const buttonStyle = { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', marginTop: '4px' };
const cancelButtonStyle = { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#F4F5F5', color: '#888', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' };
const reservarButtonStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' };
const resultCardStyle = { backgroundColor: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', position: 'relative' };
const premiumBadgeStyle = { position: 'absolute', top: '12px', right: '12px', backgroundColor: '#FAEEDA', color: '#854F0B', fontSize: '11px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '20px' };
const pagoTagStyle = { backgroundColor: '#F4F5F5', color: '#1A3C5E', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold' };
const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 };
const modalStyle = { backgroundColor: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%' };
const numeroPedidoBox = { backgroundColor: '#1A3C5E', color: '#fff', fontSize: '24px', fontWeight: 'bold', padding: '16px', borderRadius: '10px', letterSpacing: '2px' };
const compatibilidadBannerStyle = { backgroundColor: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' };
const contactLinkStyle = {
  fontSize: '13px',
  color: '#1A3C5E',
  textDecoration: 'none',
  fontWeight: 'bold',
  backgroundColor: '#fff',
  padding: '8px 16px',
  borderRadius: '20px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
};