'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { CATALOGO_BASE } from './catalogoBase';

// Fusiona el catálogo base con el catálogo vivo de Firestore
async function cargarCatalogoCombinado() {
  const combinado = {};
  Object.keys(CATALOGO_BASE).forEach((m) => {
    combinado[m] = new Set(CATALOGO_BASE[m]);
  });
  try {
    const snap = await getDoc(doc(db, 'config', 'catalogoVehiculos'));
    if (snap.exists()) {
      const vivo = snap.data().catalogo || {};
      Object.keys(vivo).forEach((m) => {
        if (!combinado[m]) combinado[m] = new Set();
        vivo[m].forEach((mo) => combinado[m].add(mo));
      });
    }
  } catch (e) { console.error('Catálogo vivo no disponible, usando base', e); }
  const final = {};
  Object.keys(combinado).sort((a, b) => a.localeCompare(b, 'es')).forEach((m) => {
    final[m] = [...combinado[m]].sort((a, b) => a.localeCompare(b, 'es'));
  });
  return final;
}

export default function SelectorMarcaModelo({ marca, modelo, onMarca, onModelo, inputStyle, selectStyle }) {
  const [catalogo, setCatalogo] = useState({});
  const [marcaSel, setMarcaSel] = useState('');
  const [modeloSel, setModeloSel] = useState('');

  useEffect(() => {
    cargarCatalogoCombinado().then(setCatalogo);
  }, []);

  // Sincroniza el selector cuando se edita un vehículo existente
  useEffect(() => {
    if (!Object.keys(catalogo).length) return;
    if (marca && catalogo[marca]) {
      setMarcaSel(marca);
      setModeloSel(catalogo[marca].includes(modelo) ? modelo : (modelo ? 'OTRA' : ''));
    } else if (marca) {
      setMarcaSel('OTRA');
    }
  }, [catalogo]); // eslint-disable-line react-hooks/exhaustive-deps

  const estiloSelect = selectStyle || inputStyle;

  if (!Object.keys(catalogo).length) {
    return (
      <>
        <input type="text" placeholder="Marca (ej. Nissan)" value={marca} onChange={(e) => onMarca(e.target.value)} style={inputStyle} />
        <input type="text" placeholder="Modelo (ej. Sentra)" value={modelo} onChange={(e) => onModelo(e.target.value)} style={inputStyle} />
      </>
    );
  }

  return (
    <>
      <select
        value={marcaSel}
        onChange={(e) => {
          const v = e.target.value;
          setMarcaSel(v); setModeloSel(''); onModelo('');
          onMarca(v === 'OTRA' ? '' : v);
        }}
        style={estiloSelect}
      >
        <option value="">Marca</option>
        {Object.keys(catalogo).map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
        <option value="OTRA">➕ Otra marca (escribir)</option>
      </select>

      {marcaSel === 'OTRA' && (
        <input type="text" placeholder="Escribe la marca nueva" value={marca} onChange={(e) => onMarca(e.target.value)} style={inputStyle} />
      )}

      {marcaSel && marcaSel !== 'OTRA' && (
        <select
          value={modeloSel}
          onChange={(e) => {
            const v = e.target.value;
            setModeloSel(v);
            onModelo(v === 'OTRA' ? '' : v);
          }}
          style={estiloSelect}
        >
          <option value="">Modelo</option>
          {(catalogo[marcaSel] || []).map((mo) => (
            <option key={mo} value={mo}>{mo}</option>
          ))}
          <option value="OTRA">➕ Otro modelo (escribir)</option>
        </select>
      )}

      {(marcaSel === 'OTRA' || modeloSel === 'OTRA') && (
        <input type="text" placeholder="Escribe el modelo nuevo" value={modelo} onChange={(e) => onModelo(e.target.value)} style={inputStyle} />
      )}
    </>
  );
}
// Llamar después de guardar un vehículo. Agrega marca/modelo al catálogo vivo si son nuevos.
export async function registrarEnCatalogo(marca, modelo) {
  if (!marca || !modelo) return;
  try {
    const { setDoc } = await import('firebase/firestore');
    const ref = doc(db, 'config', 'catalogoVehiculos');
    const snap = await getDoc(ref);
    const catalogo = snap.exists() ? (snap.data().catalogo || {}) : {};
    const modelos = catalogo[marca] || [];
    if (modelos.includes(modelo)) return; // ya existe, nada que hacer
    catalogo[marca] = [...modelos, modelo].sort((a, b) => a.localeCompare(b, 'es'));
    await setDoc(ref, { catalogo, actualizado: new Date() });
  } catch (e) {
    console.error('No se pudo actualizar el catálogo', e);
    // No bloquea el guardado del vehículo — el catálogo se puede regenerar desde admin
  }
}