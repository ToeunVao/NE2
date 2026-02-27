import ClientWrapper from "@/components/ClientWrapper";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/context/ToastContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import StaffMobileNav from "@/components/StaffMobileNav";
import PWAInstaller from "@/components/PWAInstaller";
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
};
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
       <head>
        {/* This loads FontAwesome directly from the web, fixing the "Module Not Found" error */}
        <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" 
        />
      </head>
      <body className="font-sans bg-white dark:bg-slate-950 transition-colors duration-500"> 
        <ClientWrapper>
        <ToastProvider>
          <ConfirmProvider>
        {children}
        <PWAInstaller />
        </ConfirmProvider>
        </ToastProvider>
        </ClientWrapper>
      </body>
    </html>
  );
}