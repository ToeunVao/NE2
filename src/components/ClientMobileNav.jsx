"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User, Gift, Calendar, Plus } from "lucide-react";
import ClientBookingModal from "./modals/ClientBookingModal"; // Ensure path is correct

export default function ClientMobileNav() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 px-4 py-2 z-50 flex justify-between items-center pb-6">
        
        {/* Left Side Links */}
        <div className="flex justify-around flex-1">
          <NavLink href="/client/dashboard" icon={<Home size={22} />} label="Home" />
          <NavLink href="/client/gift-cards" icon={<Gift size={22} />} label="Gifts" />
        </div>

        {/* Center Action Button (Booking) */}
        <div className="flex-1 flex justify-center -mt-8">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-pink-600 text-white p-4 rounded-full shadow-lg shadow-pink-500/40 border-4 border-white dark:border-slate-950 active:scale-90 transition-transform"
          >
            <Plus size={24} strokeWidth={3} />
          </button>
        </div>

        {/* Right Side Links */}
        <div className="flex justify-around flex-1">
          <NavLink href="/client/bookings" icon={<Calendar size={22} />} label="Bookings" />
          <NavLink href="/client/settings" icon={<User size={22} />} label="Profile" />
        </div>
      </nav>

      {/* The Modal */}
      <ClientBookingModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}

function NavLink({ href, icon, label }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link 
      href={href} 
      className={`flex flex-col items-center gap-1 transition-colors ${
        isActive 
          ? "text-pink-600" 
          : "text-slate-400 dark:text-slate-500"
      }`}
    >
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest">
        {label}
      </span>
    </Link>
  );
}