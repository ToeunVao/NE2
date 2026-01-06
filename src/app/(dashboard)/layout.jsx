"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navLinks = [
    { name: "Check-in", href: "/admin/check-in" },
    { name: "Booking", href: "/admin/appointments/book" },
    { name: "Report", href: "/admin/reports" },
    { name: "Setting", href: "/admin/settings" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* HEADER: grid-cols-3 keeps the menu exactly in the middle */}
      <header className="grid grid-cols-3 items-center h-20 px-10 bg-white border-b border-gray-100 sticky top-0 z-50">
        
        {/* LEFT Section */}
        <div className="flex items-center gap-4">
          <Link href="/admin/appointments/book" className="no-underline">
            <span className="text-2xl logo-style">Nails Express</span>
          </Link>
          <div className="relative text-gray-300">
            <i className="fas fa-bell text-lg"></i>
            <span className="absolute -top-2 -right-2 bg-pink-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-white font-bold">
              3
            </span>
          </div>
        </div>

        {/* MIDDLE Section (Center) */}
        <nav className="flex justify-center gap-2">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              href={link.href}
              className={`px-5 py-2 text-[11px] menu-text rounded-lg transition-all no-underline ${
                pathname === link.href 
                ? "bg-pink-600 text-white shadow-lg" 
                : "text-gray-400 hover:text-pink-600"
              }`}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* RIGHT Section */}
        <div className="flex items-center justify-end gap-6">
          {mounted && (
            <div className="text-right border-r border-gray-100 pr-6 hidden md:block">
              <p className="text-sm font-black text-gray-800 m-0 leading-none">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-[10px] text-gray-400 font-bold uppercase m-0 mt-1">
                {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </div>
          )}
          <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-pink-600 hover:text-white border-none cursor-pointer transition-colors">
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}