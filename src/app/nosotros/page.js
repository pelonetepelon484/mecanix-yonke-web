import fs from 'fs';
import path from 'path';

export const metadata = {
  title: 'Nuestra Historia — Mecanix Yonke Virtual',
  description: 'Conoce a David, mecánico de Tijuana y fundador de Mecanix Yonke Virtual, y la historia detrás de la plataforma.',
};

// Foto del fundador — David la debe colocar en public/david-fundador.jpg. Mientras ese archivo
// no exista, se muestra un placeholder para que la página nunca se vea rota ni con un ícono de
// imagen caída (fs.existsSync corre en el servidor, antes de armar el HTML).
const FOTO_FUNDADOR = 'david-fundador.jpg';
function tieneFotoFundador() {
  try {
    return fs.existsSync(path.join(process.cwd(), 'public', FOTO_FUNDADOR));
  } catch {
    return false;
  }
}

export default function Nosotros() {
  const hayFoto = tieneFotoFundador();

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '40px 20px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>
        <a href="/" style={{ color: '#1A3C5E', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>
          ← Volver al buscador
        </a>

        <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '32px 28px', marginTop: '20px', boxShadow: '0 4px 16px rgba(26,60,94,0.08)' }}>
          <h1 style={{ color: '#1A3C5E', fontSize: '24px', fontWeight: '700', textAlign: 'center', margin: '0 0 24px' }}>
            Nuestra Historia
          </h1>

          {/* Foto del fundador — 200x200, redonda, con borde de marca. Si public/david-fundador.jpg
              todavía no existe, se muestra un placeholder en su lugar (mismo tamaño y posición,
              para que subir la foto después no mueva nada del diseño). */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            {hayFoto ? (
              <img
                src={`/${FOTO_FUNDADOR}`}
                alt="David, fundador de Mecanix Yonke Virtual"
                style={{
                  width: '200px', height: '200px', borderRadius: '50%', objectFit: 'cover',
                  border: '4px solid #1A3C5E', boxShadow: '0 4px 16px rgba(26,60,94,0.15)',
                }}
              />
            ) : (
              <div style={{
                width: '200px', height: '200px', borderRadius: '50%', margin: '0 auto',
                backgroundColor: '#EEF2F7', border: '4px dashed #C5D4E8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
              }}>
                <span style={{ fontSize: '48px' }}>🔧</span>
                <span style={{ fontSize: '11px', color: '#888', marginTop: '6px', padding: '0 12px', textAlign: 'center', lineHeight: '1.3' }}>
                  Foto de David
                  <br />próximamente
                </span>
              </div>
            )}
          </div>

          <div style={{ color: '#444', fontSize: '15px', lineHeight: '1.8' }}>
            <p style={parrafoStyle}>
              Hola, soy David, mecánico de Tijuana y fundador de Mecanix Yonke Virtual.
            </p>
            <p style={parrafoStyle}>
              Antes de la mecánica, trabajé quitando partes en un yonke. Ahí veía todos los días
              la misma escena: gente que necesitaba una pieza y no sabía dónde encontrarla, dando
              vueltas de yonke en yonke, perdiendo tiempo y dinero. El que tenía contactos la
              encontraba rápido; el que no, batallaba.
            </p>
            <p style={parrafoStyle}>
              Cuando me hice mecánico, seguí viendo el mismo problema desde el otro lado. Al dar
              presupuestos, siempre buscaba darle opciones a mis clientes —pieza nueva o de
              yonke— porque entendía que cada quien tiene su presupuesto. Yo tenía mis contactos y
              podía conseguir piezas, pero un día me pregunté: ¿y los que no tienen los contactos
              que yo tengo?
            </p>
            <p style={parrafoStyle}>
              Intenté ayudar buscando en los grupos de Facebook, pero era un caos: mensajes por
              todos lados, números sueltos, sin saber a quién marcarle. Tenía que haber una mejor
              forma.
            </p>
            <p style={parrafoStyle}>
              Así nació Mecanix Yonke Virtual: un buscador donde cualquier persona puede encontrar
              su autoparte usada entre los yonkes de la región y contactarlos directo, sin vueltas
              ni complicaciones. Lo construí con mis propias manos, junto a mi hijo, empezando con
              unos cuantos yonkeros que confiaron en la idea.
            </p>
            <p style={parrafoStyle}>
              Mecanix no vende piezas. Conecta a la gente que las busca con los yonkes que las
              tienen. Y detrás de esta plataforma no hay una empresa sin rostro: hay un mecánico
              que vivió el problema y decidió resolverlo, para clientes y para yonkeros por igual.
            </p>
            <p style={{ ...parrafoStyle, marginBottom: 0 }}>
              Gracias por confiar en nosotros.
            </p>
          </div>

          <div style={{
            marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #eee',
            textAlign: 'center',
          }}>
            <p style={{ color: '#1A3C5E', fontSize: '15px', fontWeight: '700', margin: '0 0 6px' }}>
              — David, fundador de Mecanix Yonke Virtual
            </p>
            <a href="mailto:contacto@mecanixyonkevirtual.com" style={{ color: '#E8720C', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>
              📧 contacto@mecanixyonkevirtual.com
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

const parrafoStyle = {
  margin: '0 0 18px',
};
