"use client";
import { createContext, useContext, useState } from "react";

const ConfirmContext = createContext();

export function ConfirmProvider({ children }) {
  const [config, setConfig] = useState(null); // { title, message, onConfirm }

  const ask = (title, message, onConfirm) => {
    setConfig({ title, message, onConfirm });
  };

  const close = () => setConfig(null);

  const handleConfirm = () => {
    config.onConfirm();
    close();
  };

  return (
    <ConfirmContext.Provider value={{ ask }}>
      {children}
      {config && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
          
          {/* Modal */}
          <div className="relative bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-pink-50 text-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-gray-900">{config.title}</h3>
              <p className="text-gray-500 text-sm mt-2 font-medium">{config.message}</p>
            </div>
            
            <div className="flex border-t border-gray-100">
              <button onClick={close} className="flex-1 p-4 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-all">
                Cancel
              </button>
              <button onClick={handleConfirm} className="flex-1 p-4 text-xs font-black uppercase tracking-widest text-white bg-pink-600 hover:bg-pink-700 transition-all">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);