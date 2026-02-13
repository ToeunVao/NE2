"use client";
import { createContext, useContext, useState, useEffect } from "react";

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  // Auto-hide after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className={`fixed bottom-8 right-8 z-[9999] animate-in slide-in-from-bottom-5 duration-300`}>
          <div className={`${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          } text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border border-white/10`}>
            <div className="bg-white/20 p-1 rounded-full">
              {toast.type === "success" ? "✓" : "✕"}
            </div>
            <p className="font-black uppercase tracking-widest text-[10px]">{toast.message}</p>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);