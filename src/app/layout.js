import ClientWrapper from "@/components/ClientWrapper";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/context/ToastContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import MobileNavApp from "@/components/MobileNavApp";
import PWAInstaller from "@/components/PWAInstaller";
import PWAHandler from "@/components/PWAHandler";
import { ThemeProvider } from "@/context/ThemeContext";
// 1. Setup Playfair
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair", // This creates a CSS variable
  display: "swap",
});

// 2. Setup Inter (for body text)
const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Nails Express - Management System",
  description: "A management system for Nails Express salon.",
  // ADD THIS: This helps browsers recognize it's a PWA
  manifest: "/manifest.json", 
};
// Add this exported viewport configuration
export const viewport = {
  themeColor: "#db2777",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Recommended for PWA to feel like an app
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
       <head>
        {/* This loads FontAwesome directly from the web, fixing the "Module Not Found" error */}
       {/* CRITICAL: Link to manifest.json */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
         <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" 
        />
      </head>
      <body className="font-sans bg-white dark:bg-slate-950 transition-colors duration-500"> 
        <ThemeProvider>
        <PWAHandler />
        <ClientWrapper>
        <ToastProvider>
          <ConfirmProvider>
        {children}
        <MobileNavApp />
        </ConfirmProvider>
        </ToastProvider>
        </ClientWrapper>
          </ThemeProvider>
      </body>
    </html>
  );
}