/** @type {import('next').NextConfig} */
const nextConfig = {
  // La imagen de vista previa de los subdominios lee estos logos y la tipografía Inter del disco
  // (no por internet): se incluyen a propósito en la función del servidor.
  outputFileTracingIncludes: {
    '/api/vista-previa/[sub]': [
      './public/logo-mecanix-solo.png',
      './src/assets/fuentes/inter-regular.ttf', './src/assets/fuentes/inter-semibold.ttf',
    ],
  },
};

export default nextConfig;
