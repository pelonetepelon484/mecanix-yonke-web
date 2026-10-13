import { describe, expect, it } from 'vitest';
import {
  colorTextoSobre, descripcionVistaPrevia, esLogoPermitido, esSubdominioValido, huellaVistaPrevia, lugarDeYonke, metadataVistaPrevia, tituloVistaPrevia,
} from './vistaPreviaYonke';

describe('formato del subdominio (se revisa antes de leer Firestore)', () => {
  it('acepta lo que genera generarSubdominio.js', () => {
    for (const s of ['yonkeelpatos', 'autopartespacifico-hermosillo', 'yonke-abc123', 'a1']) expect(esSubdominioValido(s)).toBe(true);
  });
  it('rechaza mayúsculas, puntos, guion al inicio o final, vacío, www o muy largo', () => {
    for (const s of ['', 'www', 'Yonke', 'yonke.x', '-yonke', 'yonke-', 'yonke_x', '../etc', 'a'.repeat(64), null, 3]) expect(esSubdominioValido(s)).toBe(false);
  });
});

describe('textos', () => {
  const estados = [{ id: 'sonora', nombre: 'Sonora' }];
  it('lugar: ciudad de BC, si no el estado, si no nada', () => {
    expect(lugarDeYonke({ ciudad: 'tijuana', estado: 'baja-california' }, estados)).toBe('Tijuana');
    expect(lugarDeYonke({ ciudad: 'hermosillo', estado: 'sonora' }, estados)).toBe('Sonora');
    expect(lugarDeYonke({ estado: 'jalisco' }, estados)).toBe('');
  });
  it('título y descripción', () => {
    expect(tituloVistaPrevia('Yonke El Patos', 'Tijuana')).toBe('Yonke El Patos · Autopartes usadas en Tijuana');
    expect(tituloVistaPrevia('Yonke El Patos', '')).toBe('Yonke El Patos');
    expect(descripcionVistaPrevia('Tijuana')).toBe('Refacciones y autopartes usadas en Tijuana. Consulta su inventario y contáctalo directo por WhatsApp. Con tecnología Mecanix.');
    expect(descripcionVistaPrevia('')).toBe('Refacciones y autopartes usadas. Consulta su inventario y contáctalo directo por WhatsApp. Con tecnología Mecanix.');
  });
});

describe('color del texto por contraste', () => {
  it('blanco sobre colores oscuros, oscuro sobre claros', () => {
    expect(colorTextoSobre('#1A3C5E')).toBe('#FFFFFF');
    expect(colorTextoSobre('#000000')).toBe('#FFFFFF');
    expect(colorTextoSobre('#FFD54F')).toBe('#1A1A1A');
    expect(colorTextoSobre('#FFFFFF')).toBe('#1A1A1A');
    expect(colorTextoSobre('#fff')).toBe('#1A1A1A');
    expect(colorTextoSobre('rojo')).toBe('#FFFFFF');
  });
});

describe('etiquetas de la vista previa', () => {
  it('solo logos de Firebase Storage', () => {
    expect(esLogoPermitido('https://firebasestorage.googleapis.com/v0/b/x/o/logos%2FY1.png?alt=media')).toBe(true);
    expect(esLogoPermitido('https://otro-sitio.com/logo.png')).toBe(false);
    expect(esLogoPermitido(null)).toBe(false);
  });
  it('dirección del subdominio, imagen de 1200 × 630 en el sitio principal con huella', () => {
    const m = metadataVistaPrevia({ sub: 'yonkeelpatos', nombre: 'Yonke El Patos', lugar: 'Tijuana', logoUrl: 'L', colorPrimario: '#1A3C5E' });
    expect(m.alternates.canonical).toBe('https://yonkeelpatos.mecanixyonkevirtual.com');
    expect(m.openGraph).toMatchObject({ title: 'Yonke El Patos · Autopartes usadas en Tijuana', url: 'https://yonkeelpatos.mecanixyonkevirtual.com', siteName: 'Yonke El Patos' });
    expect(m.openGraph.images[0]).toMatchObject({ width: 1200, height: 630, type: 'image/png' });
    expect(m.openGraph.images[0].url).toMatch(/^https:\/\/mecanixyonkevirtual\.com\/api\/vista-previa\/yonkeelpatos\?v=[0-9a-z]+$/);
    expect(m.twitter.card).toBe('summary_large_image');
    expect(m.description).toContain('Con tecnología Mecanix');
    const pol = metadataVistaPrevia({ sub: 'yonkeelpatos', nombre: 'Yonke El Patos', lugar: 'Tijuana', ruta: '/politicas', titulo: 'Políticas y garantía · Yonke El Patos' });
    expect(pol.openGraph.url).toBe('https://yonkeelpatos.mecanixyonkevirtual.com/politicas');
    expect(pol.openGraph.title).toBe('Políticas y garantía · Yonke El Patos');
  });
  it('la huella cambia si cambia el logo, el nombre o el color', () => {
    const base = { nombre: 'A', logoUrl: 'x', colorPrimario: '#111111', lugar: 'Tijuana' };
    expect(huellaVistaPrevia(base)).toBe(huellaVistaPrevia({ ...base }));
    expect(huellaVistaPrevia(base)).not.toBe(huellaVistaPrevia({ ...base, logoUrl: 'y' }));
    expect(huellaVistaPrevia(base)).not.toBe(huellaVistaPrevia({ ...base, colorPrimario: '#222222' }));
  });
});
