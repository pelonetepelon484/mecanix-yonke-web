'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import BottomNav from '../BottomNav';

function registrarEvento(nombre, params = {}) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', nombre, params);
  }
}

export default function VentasPanel() {
  const router = useRouter();
  const { user, yonkeId, yonkePlan, loading } = useAuth();

  const [ventas, setVentas] = useState([]);
  const [loadingVentas, setLoadingVentas] = useState(true);
  const [periodoActivo, setPeriodoActivo] = useState('semana');
  const [generandoPDF, setGenerandoPDF] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => router.push('/panel'), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  useEffect(() => {
    if (!yonkeId) return;
    const ref = collection(db, 'ventas');
    const q = query(ref, where('yonkeId', '==', yonkeId), orderBy('fecha', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setVentas(lista);
      setLoadingVentas(false);
    });
    return unsubscribe;
  }, [yonkeId, yonkePlan]);

  function getFechaInicio(periodo) {
    const hoy = new Date();
    if (periodo === 'hoy') {
      const inicio = new Date(hoy);
      inicio.setHours(0, 0, 0, 0);
      return inicio;
    }
    if (periodo === 'semana') {
      const inicio = new Date(hoy);
      inicio.setDate(hoy.getDate() - 7);
      inicio.setHours(0, 0, 0, 0);
      return inicio;
    }
    if (periodo === 'mes') {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return inicio;
    }
    return new Date(0);
  }

  function getFecha(v) {
    return v.fecha?.toDate ? v.fecha.toDate() : new Date(v.fecha);
  }

  const ventasFiltradas = ventas.filter(v => getFecha(v) >= getFechaInicio(periodoActivo));

  const totalPeriodo = ventasFiltradas.reduce((sum, v) => sum + (v.monto || 0), 0);
  const totalGeneral = ventas.reduce((sum, v) => sum + (v.monto || 0), 0);

  // Piezas más vendidas
  const piezasConteo = {};
  ventasFiltradas.forEach(v => {
    const pieza = v.piezaVendida || 'Sin nombre';
    piezasConteo[pieza] = (piezasConteo[pieza] || 0) + 1;
  });
  const piezasRanking = Object.entries(piezasConteo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Datos para gráfica — ventas por día de la semana
  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const ventasPorDia = [0, 0, 0, 0, 0, 0, 0];
  ventasFiltradas.forEach(v => {
    const dia = getFecha(v).getDay();
    ventasPorDia[dia] += v.monto || 0;
  });
  const maxVentaDia = Math.max(...ventasPorDia, 1);

  function formatearFecha(fecha) {
    const f = fecha?.toDate ? fecha.toDate() : new Date(fecha);
    return f.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function exportarPDF() {
    setGenerandoPDF(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();

      const azul = [26, 60, 94];
      const naranja = [232, 114, 12];
      const gris = [120, 120, 120];

      // Header
      doc.setFillColor(...azul);
      doc.rect(0, 0, 210, 32, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Mecanix Yonke Virtual', 14, 14);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Reporte de Ventas', 14, 22);
      doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 29);

      let y = 42;

      // Período
      const periodoLabel = periodoActivo === 'hoy' ? 'Hoy' : periodoActivo === 'semana' ? 'Últimos 7 días' : 'Este mes';
      doc.setTextColor(...azul);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`Período: ${periodoLabel}`, 14, y);
      y += 10;

      // Resumen
      doc.setFillColor(245, 245, 245);
      doc.rect(14, y, 85, 22, 'F');
      doc.rect(111, y, 85, 22, 'F');

      doc.setTextColor(...gris);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Total del período', 18, y + 7);
      doc.text('Total acumulado', 115, y + 7);

      doc.setTextColor(...naranja);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${totalPeriodo.toLocaleString('es-MX')}`, 18, y + 17);
      doc.text(`$${totalGeneral.toLocaleString('es-MX')}`, 115, y + 17);
      y += 30;

      // Piezas más vendidas
      if (piezasRanking.length > 0) {
        doc.setTextColor(...azul);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Piezas más vendidas', 14, y);
        y += 8;

        piezasRanking.forEach(([pieza, cantidad], i) => {
          doc.setFillColor(i === 0 ? 232 : 240, i === 0 ? 114 : 240, i === 0 ? 12 : 240);
          doc.rect(14, y, 182, 10, 'F');
          doc.setTextColor(i === 0 ? 255 : 50, i === 0 ? 255 : 50, i === 0 ? 255 : 50);
          doc.setFontSize(10);
          doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
          doc.text(`${i + 1}. ${pieza}`, 18, y + 7);
          doc.text(`${cantidad} venta${cantidad > 1 ? 's' : ''}`, 170, y + 7, { align: 'right' });
          y += 12;
        });
        y += 6;
      }

      // Lista de ventas
      doc.setTextColor(...azul);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Detalle de ventas', 14, y);
      y += 8;

      // Encabezado tabla
      doc.setFillColor(...azul);
      doc.rect(14, y, 182, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Fecha', 18, y + 6);
      doc.text('Pieza', 50, y + 6);
      doc.text('Vehículo', 110, y + 6);
      doc.text('Monto', 185, y + 6, { align: 'right' });
      y += 11;

      ventasFiltradas.forEach((v, i) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFillColor(i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 250 : 255);
        doc.rect(14, y, 182, 9, 'F');
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(formatearFecha(v.fecha), 18, y + 6);
        doc.text((v.piezaVendida || '').substring(0, 28), 50, y + 6);
        const vehiculo = `${v.vehiculo?.marca || ''} ${v.vehiculo?.modelo || ''} ${v.vehiculo?.ano || ''}`.trim();
        doc.text(vehiculo.substring(0, 24), 110, y + 6);
        doc.setTextColor(...naranja);
        doc.setFont('helvetica', 'bold');
        doc.text(`$${(v.monto || 0).toLocaleString('es-MX')}`, 185, y + 6, { align: 'right' });
        y += 10;
      });

      // Total final
      y += 4;
      doc.setFillColor(...azul);
      doc.rect(14, y, 182, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('TOTAL', 18, y + 7);
      doc.text(`$${totalPeriodo.toLocaleString('es-MX')}`, 185, y + 7, { align: 'right' });

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setTextColor(...gris);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('mecanixyonkevirtual.com', 14, 290);
        doc.text(`Página ${i} de ${pageCount}`, 196, 290, { align: 'right' });
      }

      doc.save(`reporte-ventas-${periodoActivo}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error(error);
      alert('No se pudo generar el PDF');
    } finally {
      setGenerandoPDF(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    router.push('/panel');
  }

  if (loading || !user) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3C5E' }}>
        <p style={{ color: '#fff' }}>Cargando...</p>
      </main>
    );
  }

  if (yonkePlan !== 'premium' && loadingVentas) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3C5E' }}>
        <p style={{ color: '#fff' }}>Cargando...</p>
      </main>
    );
  }

  if (yonkePlan !== 'premium' && ventas.length === 0) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
        <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Mis ventas</h1>
          </div>
        </div>
        <div style={lockContainerStyle}>
          <p style={{ fontSize: '64px', margin: '0 0 16px' }}>🧾</p>
          <h2 style={lockTituloStyle}>Aún no tienes ventas registradas</h2>
          <p style={lockMensajeStyle}>Las ventas generadas por tus reservaciones entregadas aparecerán aquí automáticamente.</p>
          <p style={lockContactoStyle}>Con el Plan Premium además puedes registrar tus ventas de mostrador con Venta Manual.</p>
          <a
            href="https://wa.me/5216611034260?text=Hola%2C%20me%20interesa%20el%20Plan%20Premium%20de%20Mecanix%20Yonke%20Virtual"
            target="_blank"
            rel="noopener noreferrer"
            style={lockBotonStyle}
            onClick={() => registrarEvento('clic_premium', {
              ubicacion: 'ventas_sin_ventas',
              plan_actual: yonkePlan,
            })}
          >
            Quiero Premium
          </a>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Mis ventas</h1>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>

        {yonkePlan !== 'premium' && (
          <div style={avisoBasicoStyle}>
            <p style={{ margin: 0, fontSize: '13px', color: '#1A3C5E', fontWeight: '600' }}>
              🔒 Estas son tus ventas generadas por reservaciones de la plataforma. Con el Plan Premium también puedes registrar tus ventas de mostrador con Venta Manual.
            </p>
            <a
              href="https://wa.me/5216611034260?text=Hola%2C%20me%20interesa%20el%20Plan%20Premium%20de%20Mecanix%20Yonke%20Virtual"
              target="_blank"
              rel="noopener noreferrer"
              style={avisoBasicoBotonStyle}
              onClick={() => registrarEvento('clic_premium', {
                ubicacion: 'ventas_aviso_historial',
                plan_actual: yonkePlan,
              })}
            >
              Quiero Premium
            </a>
          </div>
        )}

        {/* Selector de período */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[
            { key: 'hoy', label: 'Hoy' },
            { key: 'semana', label: 'Esta semana' },
            { key: 'mes', label: 'Este mes' },
          ].map(p => (
            <button key={p.key} onClick={() => setPeriodoActivo(p.key)} style={{
              flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid',
              borderColor: periodoActivo === p.key ? '#1A3C5E' : '#ddd',
              backgroundColor: periodoActivo === p.key ? '#1A3C5E' : '#fff',
              color: periodoActivo === p.key ? '#fff' : '#888',
              fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
            }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Resumen */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={resumenCardStyle}>
            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
              {periodoActivo === 'hoy' ? 'Hoy' : periodoActivo === 'semana' ? 'Esta semana' : 'Este mes'}
            </p>
            <p style={{ fontSize: '22px', fontWeight: 'bold', color: '#E8720C', margin: '4px 0 0' }}>
              ${totalPeriodo.toLocaleString('es-MX')}
            </p>
            <p style={{ fontSize: '12px', color: '#888', margin: '2px 0 0' }}>
              {ventasFiltradas.length} venta{ventasFiltradas.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={resumenCardStyle}>
            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Total acumulado</p>
            <p style={{ fontSize: '22px', fontWeight: 'bold', color: '#1A3C5E', margin: '4px 0 0' }}>
              ${totalGeneral.toLocaleString('es-MX')}
            </p>
            <p style={{ fontSize: '12px', color: '#888', margin: '2px 0 0' }}>
              {ventas.length} venta{ventas.length !== 1 ? 's' : ''} totales
            </p>
          </div>
        </div>

        {/* Gráfica de barras por día */}
        {ventasFiltradas.length > 0 && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#1A3C5E', margin: '0 0 16px' }}>
              📊 Ingresos por día
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
              {diasSemana.map((dia, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{
                    width: '100%', borderRadius: '4px 4px 0 0',
                    height: `${Math.max((ventasPorDia[i] / maxVentaDia) * 64, ventasPorDia[i] > 0 ? 4 : 0)}px`,
                    backgroundColor: ventasPorDia[i] > 0 ? '#E8720C' : '#F0F0F0',
                    transition: 'height 0.3s ease',
                  }} />
                  <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>{dia}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Piezas más vendidas */}
        {piezasRanking.length > 0 && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#1A3C5E', margin: '0 0 12px' }}>
              🏆 Piezas más vendidas
            </p>
            {piezasRanking.map(([pieza, cantidad], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < piezasRanking.length - 1 ? '1px solid #F4F5F5' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: i === 0 ? '#E8720C' : '#F4F5F5',
                    color: i === 0 ? '#fff' : '#888', fontSize: '12px', fontWeight: 'bold', flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  <p style={{ fontSize: '14px', color: '#333', margin: 0 }}>{pieza}</p>
                </div>
                <span style={{ fontSize: '13px', color: '#888', fontWeight: 'bold' }}>
                  {cantidad} venta{cantidad > 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Botón exportar PDF */}
        {ventasFiltradas.length > 0 && (
          <button onClick={exportarPDF} disabled={generandoPDF} style={pdfButtonStyle}>
            {generandoPDF ? '⏳ Generando PDF...' : '📄 Exportar reporte PDF'}
          </button>
        )}

        {/* Lista de ventas */}
        <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#1A3C5E', margin: '16px 0 10px' }}>
          Detalle de ventas
        </p>

        {loadingVentas ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Cargando...</p>
        ) : ventasFiltradas.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>No hay ventas en este período</p>
        ) : (
          ventasFiltradas.map((v) => (
            <div key={v.id} style={ventaCardStyle}>
              <div>
                <p style={{ fontWeight: 'bold', color: '#1A3C5E', fontSize: '15px', margin: 0 }}>
                  {v.piezaVendida}
                </p>
                <p style={{ color: '#888', fontSize: '13px', margin: '2px 0 0' }}>
                  {v.vehiculo?.marca} {v.vehiculo?.modelo} {v.vehiculo?.ano}
                </p>
                <p style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>{formatearFecha(v.fecha)}</p>
              </div>
              <p style={{ fontSize: '17px', fontWeight: 'bold', color: '#1A3C5E' }}>
                ${v.monto?.toLocaleString('es-MX')}
              </p>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </main>
  );
}

const resumenCardStyle = {
  flex: 1, backgroundColor: '#fff', borderRadius: '12px', padding: '16px',
  textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};
const ventaCardStyle = {
  backgroundColor: '#fff', borderRadius: '10px', padding: '16px', marginBottom: '12px',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};
const pdfButtonStyle = {
  width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
  backgroundColor: '#1A3C5E', color: '#fff', fontWeight: 'bold', fontSize: '15px',
  cursor: 'pointer', marginBottom: '8px',
};
const lockContainerStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: '48px 32px', textAlign: 'center', maxWidth: '400px', margin: '0 auto',
};
const lockTituloStyle = { fontSize: '22px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '12px' };
const lockMensajeStyle = { fontSize: '15px', color: '#555', lineHeight: '1.6', marginBottom: '12px' };
const lockContactoStyle = { fontSize: '13px', color: '#888', lineHeight: '1.6', marginBottom: '24px' };
const lockBotonStyle = {
  backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold', fontSize: '14px',
  padding: '12px 24px', borderRadius: '24px', textDecoration: 'none', display: 'inline-block',
};
const avisoBasicoStyle = {
  backgroundColor: '#EEF2F7', border: '1.5px dashed #1A3C5E', borderRadius: '12px',
  padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center',
  justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
};
const avisoBasicoBotonStyle = {
  backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold', fontSize: '13px',
  padding: '8px 16px', borderRadius: '20px', textDecoration: 'none', whiteSpace: 'nowrap',
};