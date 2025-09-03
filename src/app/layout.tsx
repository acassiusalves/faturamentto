import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/auth-context";
import { ProtectedLayout } from "@/components/protected-layout";
import { MLSprite } from "@/components/ml-sprite";

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
        <MLSprite />
        <AuthProvider>
            <ProtectedLayout>
                {children}
            </ProtectedLayout>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
