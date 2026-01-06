import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

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
  title: "Salon Management",
  description: "Management System",
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
      <body className="font-sans"> 
        {children}
      </body>
    </html>
  );
}