import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardHeader() {
  const pathname = usePathname();
  
  const navLinks = [
    { name: "Check-in", href: "/admin/check-in" },
    { name: "Booking", href: "/admin/appointments/book" },
    { name: "Report", href: "/admin/reports" },
    { name: "Nails Inspo", href: "/admin/inspo" },
    { name: "Color Chart", href: "/admin/colors" },
    { name: "Setting", href: "/admin/settings" }, // THE MISSING LINK
  ];

  return (
    <nav className="flex items-center justify-between px-8 py-4 bg-white shadow-sm border-b border-gray-100">
      <div className="flex items-center gap-8">
        <h1 className="text-[#db2777] font-black text-xl italic">Nails Express</h1>
        
        <div className="flex items-center gap-6">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              href={link.href}
              className={`text-sm font-bold uppercase tracking-wide transition-all ${
                pathname === link.href 
                ? "bg-[#db2777] text-white px-4 py-2 rounded-lg shadow-md" 
                : "text-gray-500 hover:text-[#db2777]"
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right mr-4">
          <p className="text-sm font-black text-gray-800 uppercase">10:48 PM</p>
          <p className="text-[10px] text-gray-400 font-bold">Thursday, January 1, 2026</p>
        </div>
        <button className="bg-pink-50 text-[#db2777] w-10 h-10 rounded-full flex items-center justify-center">
          <i className="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </nav>
  );
}