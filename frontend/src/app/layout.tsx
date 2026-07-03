import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { SCRIPT_SIN_PARPADEO } from "@/lib/movimiento";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestor de Proyectos — Vitralux / VLX Windows",
  description:
    "Gestión de proyectos de ventanería: cotización, contrato, producción, instalación y garantías.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Fija data-motion antes del primer paint: sin parpadeo de animaciones */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_SIN_PARPADEO }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
