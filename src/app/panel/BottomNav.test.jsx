// @vitest-environment jsdom
// Globo de "Pedidos" del menú de abajo: lo calcula ConteoPedidosProvider (una vez por sesión, en el
// layout del panel) y BottomNav solo lo muestra. Mismos casos de siempre + cambio de pantalla,
// cierre de sesión y cambio de cuenta.
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Conexiones en vivo simuladas: cada una guarda su callback para poder mandarle datos después.
let conexiones;
function conexion(nombre, args, cb) {
  const c = { nombre, args, cb, abierta: true };
  conexiones.push(c);
  return () => { c.abierta = false; };
}
const abiertas = (nombre) => conexiones.filter((c) => c.nombre === nombre && c.abierta);
const todas = (nombre) => conexiones.filter((c) => c.nombre === nombre);
const emitir = (nombre, valor) => act(() => { abiertas(nombre).forEach((c) => c.cb(valor)); });

let sesion;
vi.mock('next/navigation', () => ({ usePathname: () => '/panel/inventario', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./AuthContext', () => ({ useAuth: () => sesion }));
vi.mock('./solicitudesPiezasDatos', () => ({
  escucharConfigSolicitudesPiezas: (cb) => conexion('configSolicitudes', [], cb),
  escucharYonkeEstadoActivo: (yonkeId, cb) => conexion('yonke', [yonkeId], cb),
  escucharSolicitudesAbiertas: (estado, cb) => conexion('solicitudes', [estado], cb),
}));
vi.mock('./pedidosClientesDatos', () => ({
  escucharConfigPedidosClientes: (cb) => conexion('configPedidos', [], cb),
  escucharPedidosClientesAbiertos: (estado, cb) => conexion('propias', [estado], cb),
  escucharPedidosClientesOtrosEstados: (cb) => conexion('otras', [], cb),
}));

const { default: BottomNav } = await import('./BottomNav.js');
const { ConteoPedidosProvider } = await import('./ConteoPedidos.js');

const yonkeY1 = { user: { uid: 'u1' }, userRole: 'yonke', yonkeId: 'Y1' };
const activoBC = { estado: 'baja-california', activo: true };
const Panel = ({ children = <BottomNav /> }) => <ConteoPedidosProvider>{children}</ConteoPedidosProvider>;

// Arranca una sesión de yonke con solicitudes encendidas y pedidos de clientes apagados.
function conSolicitudes(n = 2) {
  emitir('configSolicitudes', { habilitado: true });
  emitir('configPedidos', null);
  emitir('yonke', activoBC);
  emitir('solicitudes', Array.from({ length: n }, (_, i) => ({ id: `S${i}` })));
}

beforeEach(() => { conexiones = []; sesion = yonkeY1; });
afterEach(() => cleanup());

describe('badge de "Pedidos" en el BottomNav', () => {
  it('muestra el conteo de solicitudes abiertas del estado del yonke', () => {
    render(<Panel />);
    conSolicitudes(2);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(abiertas('solicitudes')[0].args).toEqual(['baja-california']);
  });

  it('sin yonkeId (otro rol) no muestra ningún badge ni abre conexiones', () => {
    sesion = { user: { uid: 'u9' }, userRole: 'yonke', yonkeId: null };
    render(<Panel />);
    expect(conexiones).toHaveLength(0);
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('admin y taller no abren ninguna conexión', () => {
    for (const s of [{ user: { uid: 'a' }, userRole: 'admin', yonkeId: null }, { user: { uid: 't' }, userRole: 'taller', yonkeId: null }]) {
      sesion = s;
      render(<Panel />);
      cleanup();
    }
    expect(conexiones).toHaveLength(0);
  });

  it('sin config/solicitudesPiezas: no hay badge y no se lee nada más de ese módulo', () => {
    render(<Panel />);
    emitir('configSolicitudes', null);
    emitir('configPedidos', null);
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(todas('yonke')).toHaveLength(0);
    expect(todas('solicitudes')).toHaveLength(0);
  });

  it('con habilitado=false: lo mismo, nada se lee de más', () => {
    render(<Panel />);
    emitir('configSolicitudes', { habilitado: false });
    emitir('configPedidos', { habilitado: false });
    expect(todas('yonke')).toHaveLength(0);
    expect(todas('solicitudes')).toHaveLength(0);
  });

  it('yonke inactivo o sin estado: no cuenta nada', () => {
    render(<Panel />);
    emitir('configSolicitudes', { habilitado: true });
    emitir('yonke', { estado: 'baja-california', activo: false });
    expect(todas('solicitudes')).toHaveLength(0);
    emitir('yonke', { estado: null, activo: true });
    expect(todas('solicitudes')).toHaveLength(0);
  });

  it('más de 9: muestra "9+"', () => {
    render(<Panel />);
    conSolicitudes(12);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });
});

describe('una sola conexión por sesión', () => {
  it('cambiar de pantalla 5 veces no vuelve a conectar ni a leer nada', () => {
    const { rerender } = render(<Panel><BottomNav key="p0" /></Panel>);
    conSolicitudes(2);
    const antes = conexiones.length;
    for (let i = 1; i <= 5; i++) rerender(<Panel><BottomNav key={`p${i}`} /></Panel>);
    expect(conexiones.length).toBe(antes);
    expect(todas('configSolicitudes')).toHaveLength(1);
    expect(todas('configPedidos')).toHaveLength(1);
    expect(todas('yonke')).toHaveLength(1);
    expect(todas('solicitudes')).toHaveLength(1);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
  it('un cambio en la ficha que no toca el estado (p. ej. la marca de actividad) no reconecta las listas', () => {
    render(<Panel />);
    conSolicitudes(2);
    emitir('yonke', { ...activoBC, nombre: 'Otro nombre' });
    expect(todas('solicitudes')).toHaveLength(1);
  });
  it('si el admin apaga la función, el contador se corrige solo y se cierra la lista', () => {
    render(<Panel />);
    conSolicitudes(2);
    emitir('configSolicitudes', { habilitado: false });
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(abiertas('solicitudes')).toHaveLength(0);
  });
  it('si el admin cambia el estado del yonke, la lista se reconecta al estado nuevo', () => {
    render(<Panel />);
    conSolicitudes(2);
    emitir('yonke', { estado: 'sonora', activo: true });
    expect(abiertas('solicitudes').map((c) => c.args[0])).toEqual(['sonora']);
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });
});

describe('cierre de sesión y cambio de cuenta', () => {
  it('al cerrar sesión: contador en 0 y todas las conexiones cerradas', () => {
    const { rerender } = render(<Panel />);
    conSolicitudes(2);
    const deLaSesion = [...conexiones];
    sesion = { user: null, userRole: null, yonkeId: null };
    rerender(<Panel />);
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(deLaSesion.every((c) => !c.abierta)).toBe(true);
    expect(conexiones.filter((c) => c.abierta)).toHaveLength(0);
  });
  it('lo que llegue tarde de una conexión ya cerrada se ignora', () => {
    const { rerender } = render(<Panel />);
    conSolicitudes(2);
    const vieja = abiertas('solicitudes')[0];
    sesion = { user: null, userRole: null, yonkeId: null };
    rerender(<Panel />);
    act(() => vieja.cb([{ id: 'X1' }, { id: 'X2' }, { id: 'X3' }]));
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });
  it('cambiar de cuenta Y1 → Y2: cierra lo de Y1, abre lo de Y2 y no mezcla números', () => {
    const { rerender } = render(<Panel />);
    conSolicitudes(2);
    const deY1 = [...conexiones];
    sesion = { user: { uid: 'u2' }, userRole: 'yonke', yonkeId: 'Y2' };
    rerender(<Panel />);
    expect(deY1.every((c) => !c.abierta)).toBe(true);
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    emitir('configSolicitudes', { habilitado: true });
    emitir('configPedidos', null);
    expect(abiertas('yonke').map((c) => c.args[0])).toEqual(['Y2']);
    emitir('yonke', { estado: 'jalisco', activo: true });
    emitir('solicitudes', [{ id: 'S9' }]);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(abiertas('solicitudes').map((c) => c.args[0])).toEqual(['jalisco']);
  });
});

describe('sin el proveedor montado', () => {
  it('el menú no muestra globo (0), nunca un número equivocado', () => {
    render(<BottomNav />);
    expect(screen.queryByText(/^(\d+|9\+)$/)).not.toBeInTheDocument();
    expect(conexiones).toHaveLength(0);
  });
});
