import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Mecanix Yonke Virtual — Refacciones y autopartes usadas en México",
  description: "Encuentra autopartes y refacciones usadas entre los yonkes y deshuesaderos afiliados en México. Busca por marca, modelo y año. Reserva en línea al instante.",
keywords: "yonke Tijuana, refacciones usadas Tijuana, autopartes Tijuana, yonke Mexicali, refacciones usadas México, piezas de carro usadas, yonke virtual, comprar refacciones en línea, motor usado Tijuana, transmisión usada Tijuana, piezas usadas Tijuana, dónde comprar refacciones Tijuana, yonke Ensenada, yonke Tecate, yonke Rosarito, refacciones Nissan Tijuana, refacciones Toyota Tijuana, refacciones Chevrolet Tijuana, refacciones Honda Tijuana, refacciones Ford Tijuana, autopartes baratas Tijuana, deshuese Tijuana, deshuesadero Tijuana, partes de carro Tijuana, yonkes en Tijuana, yonkes en México, deshuesadero México",  authors: [{ name: "Mecanix" }],
  creator: "Mecanix",
  publisher: "Mecanix",
  metadataBase: new URL("https://mecanixyonkevirtual.com"),
  alternates: {
    canonical: "https://mecanixyonkevirtual.com",
  },
  openGraph: {
    title: "Mecanix Yonke Virtual — Refacciones y autopartes usadas en México",
    description: "Encuentra autopartes y refacciones usadas entre los yonkes y deshuesaderos afiliados en México. Busca por marca, modelo y año.",
    url: "https://mecanixyonkevirtual.com",
    siteName: "Mecanix Yonke Virtual",
    locale: "es_MX",
    type: "website",
    images: [
      {
        url: "/mecanix-logo.webp",
        width: 800,
        height: 600,
        alt: "Mecanix Yonke Virtual",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mecanix Yonke Virtual — Refacciones y autopartes usadas en México",
    description: "Encuentra autopartes y refacciones usadas entre los yonkes afiliados en México.",
    images: ["/mecanix-logo.webp"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  verification: {
    google: ["Dsfqwt8FqGoJjIKLPLeZgEyozmeS9m564wCiEP_B4Uw", "iWoymVzCtoeszabTlUy29HUCkyi_clOR_0tpcF3dprU"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-GCZQQKY0TM"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-GCZQQKY0TM');
          `}
        </Script>
        <Script id="schema-org" type="application/ld+json" strategy="afterInteractive">
          {`
            {
              "@context": "https://schema.org",
              "@type": "AutoPartsStore",
              "name": "Mecanix Yonke Virtual",
              "description": "Plataforma que conecta compradores de refacciones usadas con yonkes de México",
              "url": "https://mecanixyonkevirtual.com",
              "areaServed": "México",
              "address": {
                "@type": "PostalAddress",
                "addressRegion": "Baja California",
                "addressCountry": "MX"
              },
              "sameAs": [
                "https://mecanixyonkevirtual.com"
              ]
            }
          `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}