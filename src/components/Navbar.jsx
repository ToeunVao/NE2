"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Gallery", path: "/gallery" },
    { name: "Book Now", path: "/login" }, // We'll link this to booking later
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-pink-50 px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-serif font-bold text-pink-600">
          NailsXpress
        </Link>
        
        <div className="hidden md:flex space-x-8">
          {navLinks.map((link) => (
            <Link 
              key={link.path} 
              href={link.path}
              className={`text-sm font-medium tracking-widest uppercase transition-colors ${
                pathname === link.path ? "text-pink-600" : "text-gray-500 hover:text-pink-400"
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <Link 
          href="/login" 
          className="bg-pink-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-pink-700 transition-all shadow-lg shadow-pink-100"
        >
          Staff Login
        </Link>
      </div>
    </nav>
  );
}