"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = [
    { name: "Overview", path: "/admin", icon: "fa-chart-pie" },
    { name: "Appointments", path: "/admin/appointments", icon: "fa-calendar-check" },
    { name: "Create Booking", path: "/admin/appointments/book", icon: "fa-calendar-plus" }, // ADD THIS
    { name: "POS / Checkout", path: "/admin/pos", icon: "fa-cash-register" },
    { name: "Client Database", path: "/admin/clients", icon: "fa-address-book" },
    { name: "Staff & Payroll", path: "/admin/staff", icon: "fa-users" },
    { name: "Earnings Reports", path: "/admin/earnings", icon: "fa-file-invoice-dollar" },
    { name: "Service Menu", path: "/admin/services", icon: "fa-concierge-bell" },
    { name: "Inventory", path: "/admin/inventory", icon: "fa-box-open" },
  ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <aside className="w-72 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0 shadow-sm">
      {/* Brand Section */}
      <div className="p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-pink-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-pink-200">
            <i className="fas fa-sparkles"></i>
          </div>
          <h1 className="text-2xl font-serif font-bold text-gray-800 tracking-tight">NailsXpress</h1>
        </div>
        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest ml-1">Management Suite</p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 group ${
                isActive 
                  ? "bg-pink-600 text-white shadow-md shadow-pink-100" 
                  : "text-gray-500 hover:bg-pink-50 hover:text-pink-600"
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                isActive ? "bg-pink-500" : "bg-gray-50 group-hover:bg-white"
              }`}>
                <i className={`fas ${item.icon} text-sm`}></i>
              </div>
              <span className="font-semibold text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User / Logout Section */}
      <div className="p-6 border-t border-gray-50">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-4 py-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all duration-200 group"
        >
          <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-white transition-colors">
            <i className="fas fa-sign-out-alt"></i>
          </div>
          <span className="font-semibold text-sm">Logout</span>
        </button>
      </div>
    </aside>
  );
}