"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export default function DashboardLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false); // New Stat
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      if (window.confirm("Are you sure you want to logout?")) {
        await signOut(auth);
        router.push("/login");
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const navLinks = [
    { name: "Check-in", href: "/admin/check-in", icon: "fa-user-check" },
    { name: "Booking", href: "/admin/appointments/book", icon: "fa-calendar-alt" },
    { name: "Report", href: "/admin/reports", icon: "fa-chart-line" },
    { name: "Setting", href: "/admin/settings", icon: "fa-cog" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      
      {/* --- LEFT SIDEBAR --- */}
 <aside className={`bg-white border-r border-gray-100 flex flex-col sticky top-0 h-screen transition-all duration-300 ease-in-out ${
    isCollapsed ? "w-20" : "w-64"
  }`}>
    
    {/* Toggle Button */}
    <button 
      onClick={() => setIsCollapsed(!isCollapsed)}
      className="absolute -right-3 top-10 bg-white border border-gray-100 rounded-full w-6 h-6 flex items-center justify-center text-[10px] text-pink-600 shadow-sm cursor-pointer hover:bg-pink-50 z-50"
    >
      <i className={`fas ${isCollapsed ? "fa-chevron-right" : "fa-chevron-left"}`}></i>
    </button> 
    {/* Logo Section */}
    <div className={`p-6 transition-all duration-300 ${isCollapsed ? "text-center px-2" : "p-8"}`}>
      <Link href="/admin/appointments/book" className="no-underline group">
        <span className={`logo-style text-pink-700 block transition-all ${isCollapsed ? "text-xl" : "text-2xl"}`}>
          {isCollapsed ? "NE" : "Nails Express"}
        </span>
        {!isCollapsed && (
          <p className="text-[9px] font-bold text-pink-600 uppercase tracking-[4px] mt-1 mb-0 animate-in fade-in duration-500">
            Management Suite
          </p>
        )}
      </Link>
    </div>

     {/* Navigation */}
    <nav className="flex-1 px-3 space-y-2 mt-4">
      {navLinks.map((link) => (
        <Link 
          key={link.name} 
          href={link.href}
          title={isCollapsed ? link.name : ""} // Show tooltip on hover when collapsed
          className={`flex items-center rounded-xl transition-all no-underline font-bold text-sm ${
            isCollapsed ? "justify-center h-12 w-12 mx-auto" : "px-4 py-3 gap-4"
          } ${
            pathname === link.href 
            ? "bg-pink-600 text-white shadow-lg shadow-pink-100" 
            : "text-gray-400 hover:bg-gray-50 hover:text-pink-600"
          }`}
        >
          <i className={`fas ${link.icon} text-lg`}></i>
          {!isCollapsed && <span className="whitespace-nowrap">{link.name}</span>}
        </Link>
      ))}
    </nav>
       {/* Footer (Logout) */}
    <div className={`p-4 border-t border-gray-50 space-y-4 ${isCollapsed ? "items-center" : ""}`}>
      <button 
        onClick={handleLogout}
        className={`flex items-center transition-all border-none cursor-pointer font-bold text-sm text-gray-400 hover:text-red-600 bg-transparent ${
          isCollapsed ? "justify-center w-full py-4" : "gap-3 px-4 py-3 w-full hover:bg-red-50 rounded-xl"
        }`}
      >
        <i className="fas fa-sign-out-alt text-lg"></i>
        {!isCollapsed && <span>Logout</span>}
      </button>
    </div>
  </aside>
      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar for Notifications/User Profile if needed */}
        <header className="h-20 bg-white/50 backdrop-blur-md border-b border-gray-100 px-10 flex items-center justify-end">
          <div className="relative text-gray-300 cursor-pointer hover:text-pink-600 transition-colors">
            <i className="fas fa-bell text-xl"></i>
            <span className="absolute -top-1 -right-1 bg-pink-600 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-white font-bold">
              3
            </span>
          </div>
        </header>

        <div className="p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}