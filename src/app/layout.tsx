import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Header } from "@/components/header";

const manrope = Manrope({ subsets: ["latin"], weight: ['400', '500', '600', '700'], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Fechamentto",
  description: "Sistema de conciliação de vendas em marketplaces.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={`${manrope.variable} font-body antialiased`}>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 container mx-auto py-8">
            {children}
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
