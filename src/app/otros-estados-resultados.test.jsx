// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import OtrosEstadosResultados from './OtrosEstadosResultados';
import {
  AVISO_ENVIO_SI_LEJOS, AVISO_SIN_ENVIOS, TEXTO_ELIGE_ESTADO_OTROS, leerOtrosEstados, opcionesTarjetaOtroEstado,
  partesCuadroMensaje, cuadroMensajeTieneContenido, TITULO_CON_OTROS_ESTADOS, textoConOtrosEstados, MARGEN_SCROLL_OTROS_ESTADOS,
} from '../lib/otrosEstadosPantalla';
import { CONSEJOS_ENVIO } from '../lib/pedidosClientes';

afterEach(cleanup);

const busqueda = { marca: 'Honda', modelo: 'Civic', anio: 2016, pieza: 'Alternador' };
const grupos = [
  { estado: 'sonora', estadoNombre: 'Sonora', resultados: [{ yonkeId: 'A', vehiculoId: '1', enviosNacionales: true }, { yonkeId: 'B', vehiculoId: '2', enviosNacionales: false }] },
  { estado: 'jalisco', estadoNombre: 'Jalisco', resultados: [{ yonkeId: 'C', motorId: 'm', esMotor: true, enviosNacionales: true }] },
];

describe('leerOtrosEstados (qué caso es)', () => {
  it('sin los campos nuevos (banderas apagadas): null, la pantalla queda igual', () => {
    expect(leerOtrosEstados({ estado: 'sin_inventario', mensaje: 'x' })).toBeNull();
    expect(leerOtrosEstados({ estado: 'resultados', resultados: [] })).toBeNull();
  });
  it('listas vacías: null', () => {
    expect(leerOtrosEstados({ estado: 'sin_inventario', resultadosOtrosEstados: [] })).toBeNull();
    expect(leerOtrosEstados({ estado: 'sin_inventario', resultadosOtrosEstados: [{ estado: 'sonora', resultados: [] }] })).toBeNull();
  });
  it('caso a: sin resultados en el estado elegido', () => {
    expect(leerOtrosEstados({ estado: 'sin_yonkes_estado', resultadosOtrosEstados: grupos, busqueda })).toEqual({ modo: 'a', grupos, busqueda, scroll: false });
  });
  it('scroll: solo en el caso a y solo si el servidor lo pidió (scrollOtrosEstados: true)', () => {
    expect(leerOtrosEstados({ estado: 'sin_inventario', resultadosOtrosEstados: grupos, busqueda, scrollOtrosEstados: true }).scroll).toBe(true);
    expect(leerOtrosEstados({ estado: 'sin_inventario', resultadosOtrosEstados: grupos, busqueda, scrollOtrosEstados: 'true' }).scroll).toBe(false);
    const b = { estado: 'resultados', sinResultadosEnTuEstado: { estado: 'cdmx' }, resultadosOtrosEstados: grupos, busqueda, scrollOtrosEstados: true };
    expect(leerOtrosEstados(b).scroll).toBe(false);
  });
  it('caso b: "Todos los estados" y nada del estado por IP', () => {
    const data = { estado: 'resultados', sinResultadosEnTuEstado: { estado: 'cdmx', estadoNombre: 'CDMX' }, resultadosOtrosEstados: grupos, busqueda };
    expect(leerOtrosEstados(data)).toMatchObject({ modo: 'b' });
    // Con resultados normales pero sin sinResultadosEnTuEstado: nada cambia.
    expect(leerOtrosEstados({ ...data, sinResultadosEnTuEstado: undefined })).toBeNull();
  });
});

describe('opciones de las tarjetas: Reservar', () => {
  it('caso b conserva Reservar y "Pedir entrega"; caso a no', () => {
    expect(opcionesTarjetaOtroEstado('b', busqueda)).toEqual({ conReservar: true, busqueda });
    expect(opcionesTarjetaOtroEstado('a', busqueda)).toEqual({ conReservar: false, busqueda });
  });

  it('el componente pasa esas opciones a cada tarjeta', () => {
    const renderTarjeta = vi.fn((r, key) => <div key={key}>tarjeta {r.yonkeId}</div>);
    render(<OtrosEstadosResultados info={{ modo: 'b', grupos, busqueda }} renderTarjeta={renderTarjeta} />);
    expect(renderTarjeta.mock.calls.every(([, , op]) => op.conReservar === true && op.busqueda === busqueda)).toBe(true);
    cleanup();
    renderTarjeta.mockClear();
    render(<OtrosEstadosResultados info={{ modo: 'a', grupos, busqueda }} nombreEstadoCliente="Chihuahua" renderTarjeta={renderTarjeta} />);
    expect(renderTarjeta).toHaveBeenCalledTimes(3);
    expect(renderTarjeta.mock.calls.every(([, , op]) => op.conReservar === false)).toBe(true);
  });
});

describe('OtrosEstadosResultados', () => {
  const renderTarjeta = (r, key) => <div key={key}>tarjeta {r.yonkeId}</div>;

  it('caso a: título con el estado del cliente, grupos "📍" y aviso de envío; sin "Elige tu estado"', () => {
    render(<OtrosEstadosResultados info={{ modo: 'a', grupos, busqueda }} nombreEstadoCliente="Chihuahua" renderTarjeta={renderTarjeta} onElegirEstado={vi.fn()} />);
    expect(screen.getByRole('heading')).toHaveTextContent('No hay en Chihuahua. Esto es lo que hay en otros estados');
    expect(screen.getByText('📍 Sonora')).toBeInTheDocument();
    expect(screen.getByText('📍 Jalisco')).toBeInTheDocument();
    expect(screen.getAllByText(CONSEJOS_ENVIO)).toHaveLength(2);
    expect(screen.getByText(AVISO_SIN_ENVIOS)).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_ELIGE_ESTADO_OTROS)).not.toBeInTheDocument();
  });

  it('caso b: título suave, aviso condicional y "¿No es tu estado?" que elige estado y repite la búsqueda', () => {
    const onElegirEstado = vi.fn();
    render(<OtrosEstadosResultados
      info={{ modo: 'b', grupos, busqueda }} renderTarjeta={renderTarjeta} onElegirEstado={onElegirEstado}
      estados={[{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }]}
    />);
    expect(screen.getByRole('heading')).toHaveTextContent('No encontramos en tu estado. Esto es lo que hay en otros estados');
    expect(screen.getAllByText(AVISO_ENVIO_SI_LEJOS)).toHaveLength(2);
    expect(AVISO_ENVIO_SI_LEJOS).toBe(CONSEJOS_ENVIO);
    // Igual a la versión aprobada de /mi-pedido: sin "Te la enviaría" ni "cómo se hará el pago".
    expect(document.body.textContent).not.toMatch(/Te la enviaría|cómo se hará el pago/);
    expect(screen.getByText(AVISO_SIN_ENVIOS)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: TEXTO_ELIGE_ESTADO_OTROS }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Elige tu estado' }), { target: { value: 'baja-california' } });
    expect(onElegirEstado).toHaveBeenCalledWith('baja-california');
  });

  it('sin grupos con tarjetas: no dibuja nada', () => {
    const { container } = render(<OtrosEstadosResultados info={{ modo: 'a', grupos: [{ estado: 'sonora', estadoNombre: 'Sonora', resultados: [] }] }} renderTarjeta={renderTarjeta} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('cuadro de mensaje del buscador inteligente (franja vacía)', () => {
  const TIPOS = ['sin_inventario', 'no_catalogado', 'sin_yonkes_estado', 'confirmar', 'fuera_de_giro', 'parseo_parcial', 'no_interpretada', 'rechazado', 'numero_de_parte', 'error'];

  it('caso a con la alerta de un paso: sin texto ni botón viejo, el cuadro no se dibuja', () => {
    const partes = partesCuadroMensaje({ tipo: 'sin_inventario', alertaUnPaso: true, estadoBusqueda: 'jalisco', conOtrosEstados: true });
    expect(partes).toEqual({ texto: false, confirmar: false, botonTodos: false });
    expect(cuadroMensajeTieneContenido(partes)).toBe(false);
  });

  it('sin_yonkes_estado con otros estados: sigue mostrando su texto (sin el botón viejo)', () => {
    const partes = partesCuadroMensaje({ tipo: 'sin_yonkes_estado', alertaUnPaso: true, estadoBusqueda: 'jalisco', conOtrosEstados: true });
    expect(partes).toMatchObject({ texto: true, botonTodos: false });
    expect(cuadroMensajeTieneContenido(partes)).toBe(true);
  });

  it('el servidor ya buscó en otros estados sin encontrar nada (otrosEstadosRevisados): sin botón viejo', () => {
    // HomeClient pasa conOtrosEstados = llegó la sección O otrosEstadosRevisados.
    const partes = partesCuadroMensaje({ tipo: 'sin_inventario', alertaUnPaso: false, estadoBusqueda: 'jalisco', conOtrosEstados: true });
    expect(partes).toEqual({ texto: true, confirmar: false, botonTodos: false });
    // "No identificamos el modelo" (no_catalogado) nunca se revisa en otros estados: el botón sigue.
    expect(partesCuadroMensaje({ tipo: 'no_catalogado', alertaUnPaso: false, estadoBusqueda: 'jalisco', conOtrosEstados: false }).botonTodos).toBe(true);
  });

  it('confirmar siempre se muestra', () => {
    for (const alertaUnPaso of [false, true]) {
      expect(cuadroMensajeTieneContenido(partesCuadroMensaje({ tipo: 'confirmar', alertaUnPaso, estadoBusqueda: 'todos', conOtrosEstados: false }))).toBe(true);
    }
  });

  it('banderas apagadas (sin otros estados): las partes son las de siempre y el cuadro nunca queda vacío donde hoy se dibuja', () => {
    for (const tipo of TIPOS) {
      for (const alertaUnPaso of [false, true]) {
        for (const estadoBusqueda of ['todos', 'jalisco']) {
          const partes = partesCuadroMensaje({ tipo, alertaUnPaso, estadoBusqueda, conOtrosEstados: false });
          // Las condiciones que tenía cada parte antes de este arreglo.
          expect(partes).toEqual({
            texto: !(alertaUnPaso && tipo === 'sin_inventario'),
            confirmar: tipo === 'confirmar',
            botonTodos: ['sin_inventario', 'no_catalogado', 'sin_yonkes_estado'].includes(tipo) && estadoBusqueda !== 'todos',
          });
          // Donde hoy se dibuja el cuadro (condición de afuera), sigue dibujándose.
          const seDibujabaHoy = !(alertaUnPaso && tipo === 'sin_inventario' && estadoBusqueda === 'todos');
          if (seDibujabaHoy) expect(cuadroMensajeTieneContenido(partes)).toBe(true);
        }
      }
    }
  });
});

describe('recuadro azul cuando abajo SÍ hay resultados de otros estados (seMuestranOtrosEstados)', () => {
  it('con la alerta de un paso: se oculta en sin_yonkes_estado ("Prueba buscando en Todos…") y en sin_inventario', () => {
    for (const tipo of ['sin_yonkes_estado', 'sin_inventario']) {
      const partes = partesCuadroMensaje({ tipo, alertaUnPaso: true, estadoBusqueda: 'jalisco', conOtrosEstados: true, seMuestranOtrosEstados: true });
      expect(cuadroMensajeTieneContenido(partes)).toBe(false);
    }
  });
  it('sin la alerta de un paso: "Prueba buscando en Todos los estados" (sin_yonkes_estado) también se oculta; el de sin_inventario sigue (es la única explicación)', () => {
    const sinYonkes = partesCuadroMensaje({ tipo: 'sin_yonkes_estado', alertaUnPaso: false, estadoBusqueda: 'jalisco', conOtrosEstados: true, seMuestranOtrosEstados: true });
    expect(cuadroMensajeTieneContenido(sinYonkes)).toBe(false);
    const sinInventario = partesCuadroMensaje({ tipo: 'sin_inventario', alertaUnPaso: false, estadoBusqueda: 'jalisco', conOtrosEstados: true, seMuestranOtrosEstados: true });
    expect(sinInventario.texto).toBe(true);
  });
  it('si se buscó en otros estados SIN encontrar nada, el texto sigue', () => {
    const partes = partesCuadroMensaje({ tipo: 'sin_yonkes_estado', alertaUnPaso: true, estadoBusqueda: 'jalisco', conOtrosEstados: true, seMuestranOtrosEstados: false });
    expect(partes.texto).toBe(true);
  });
});

describe('textos del caso a y margen del scroll', () => {
  it('título, texto con el estado y margen inicial de 120 px', () => {
    expect(TITULO_CON_OTROS_ESTADOS).toBe('Lo encontramos en otros estados');
    expect(textoConOtrosEstados('Jalisco')).toBe('No hay yonkes de Jalisco con ese vehículo, pero abajo ves los de otros estados. ¿Lo quieres solo en tu estado? Activa la alerta de búsqueda.');
    expect(MARGEN_SCROLL_OTROS_ESTADOS).toBe(120);
  });
});
