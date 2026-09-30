import { defineConfig } from 'vitest/config';
import { transform } from 'esbuild';

// Esta app sigue la convención de Next de escribir JSX en archivos .js (page.js, layout.js,
// etc.) — Next lo soporta porque usa SWC, pero Vitest usa el transform interno de Vite (oxc en
// esta versión), que rechaza JSX en .js a propósito ("JSX syntax is disabled"). @vitejs/plugin-
// react no alcanza a interceptar antes que ese transform interno.
//
// Este plugin, con enforce:'pre', corre ANTES que el transform interno de Vite: convierte el JSX
// a JS plano con esbuild (loader:'jsx') para cualquier .js dentro de src/, así que cuando el
// archivo llega al transform interno ya no queda JSX que rechazar. No afecta a los módulos .ts
// puros que ya se probaban antes de este archivo (esbuild los deja pasar igual, loader 'jsx' es
// un superconjunto de sintaxis de JS/TS normal).
function jsxEnArchivosJs() {
  return {
    name: 'jsx-en-js',
    enforce: 'pre',
    async transform(code, id) {
      const archivo = id.split('?')[0];
      if (!archivo.includes('/src/') || !archivo.endsWith('.js')) return null;
      const resultado = await transform(code, {
        loader: 'jsx', jsx: 'automatic', format: 'esm', sourcemap: true, sourcefile: archivo,
      });
      return { code: resultado.code, map: resultado.map };
    },
  };
}

export default defineConfig({
  plugins: [jsxEnArchivosJs()],
});
