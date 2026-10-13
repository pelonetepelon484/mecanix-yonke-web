/** @type {import('next').NextConfig} */
const nextConfig = {
  // La imagen de vista previa de los subdominios lee estos logos del disco (no por internet):
  // se incluyen a propósito en la función del servidor.
  outputFileTracingIncludes: {
    '/api/vista-previa/[sub]': ['./public/logo-mecanix-solo.png', './public/logo-mecanix-blanco.png'],
  },
};

export default nextConfig;
