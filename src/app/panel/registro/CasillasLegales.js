'use client';

// Las tres casillas de los registros de yonke: Términos, Aviso de Privacidad y declaración de
// autorización. Ninguna viene marcada. `valores` = { terminos, privacidad, autorizacion }.
import { URL_PRIVACIDAD, URL_TERMINOS } from '../../../lib/versionesLegales';

export const CASILLAS_VACIAS = { terminos: false, privacidad: false, autorizacion: false };
export const casillasCompletas = (v) => v.terminos === true && v.privacidad === true && v.autorizacion === true;

export default function CasillasLegales({ valores, onChange, declaracion }) {
  const marcar = (campo) => (e) => onChange({ ...valores, [campo]: e.target.checked });
  return (
    <>
      <Casilla checked={valores.terminos} onChange={marcar('terminos')}>
        He leído y acepto los <a href={URL_TERMINOS} target="_blank" rel="noopener noreferrer" style={enlace}>Términos y Condiciones</a>.
      </Casilla>
      <Casilla checked={valores.privacidad} onChange={marcar('privacidad')}>
        He leído y acepto el <a href={URL_PRIVACIDAD} target="_blank" rel="noopener noreferrer" style={enlace}>Aviso de Privacidad</a>.
      </Casilla>
      <Casilla checked={valores.autorizacion} onChange={marcar('autorizacion')}>{declaracion}</Casilla>
    </>
  );
}

function Casilla({ checked, onChange, children }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '4px 0 14px', cursor: 'pointer' }}>
      <input
        type="checkbox" checked={checked} onChange={onChange}
        style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#E8720C', cursor: 'pointer', flexShrink: 0 }}
      />
      <span style={{ fontSize: '13px', color: '#555', lineHeight: '1.5' }}>{children}</span>
    </label>
  );
}

const enlace = { color: '#E8720C', fontWeight: 'bold' };
