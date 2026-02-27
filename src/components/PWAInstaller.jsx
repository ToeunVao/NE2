"use client";
import { useState, useEffect } from "react";
import { Share, PlusSquare, Download, X, Info } from "lucide-react";

export default function PWAInstaller() {
  const [platform, setPlatform] = useState(""); 
  const [show, setShow] = useState(false);

useEffect(() => {
  // 1. HARDWARE CHECK: Hide if it's not a touch-enabled device (like a Desktop)
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouchDevice) return;

  // 2. SIZE CHECK: Hide on Desktop or large Tablets (wider than 500px)
  // Physical phones are almost always under 500px in width
  if (window.innerWidth > 500) return;

  // 3. INSTALLED CHECK: Hide if they are already using the App
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                       || window.navigator.standalone === true;
  if (isStandalone) return;

  // 4. PATH CHECK: Hide on Admin pages
  if (window.location.pathname.startsWith('/admin')) return null;

  // 5. DEVICE DETECTION
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  setPlatform(isIOS ? "ios" : "android");

  // Show after 4 seconds
  const timer = setTimeout(() => setShow(true), 4000);
  return () => clearTimeout(timer);
}, []);


  const dismiss = () => {
    setShow(false);
    sessionStorage.setItem("pwa-dismissed", "true");
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[100] animate-in slide-in-from-bottom duration-1000">
      <div className="bg-slate-900 text-white p-5 rounded-[2.5rem] shadow-2xl border border-white/10 relative overflow-hidden">
        
        {/* Decorative background glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-600/20 blur-3xl rounded-full" />
        
        <div className="flex gap-4 items-start relative z-10">
          <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-pink-700 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-500/20 flex-shrink-0">
            <Download className="text-white animate-bounce" size={28} />
          </div>
          
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="font-black text-sm uppercase tracking-widest text-white">Install Staff App</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1 leading-relaxed">
                Add to your home screen for faster access and a full-screen experience.
              </p>
            </div>

            {platform === "ios" ? (
              /* iOS SPECIFIC GUIDE */
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-sm">
                    <Share size={16} className="text-white" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-tight">
                    1. Tap the <span className="text-blue-400">'Share'</span> button
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center shadow-sm">
                    <PlusSquare size={16} className="text-white" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-tight">
                    2. Select <span className="text-pink-400">'Add to Home Screen'</span>
                  </p>
                </div>
              </div>
            ) : (
              /* ANDROID / CHROME GUIDE */
              <button 
                onClick={() => window.dispatchEvent(new Event('beforeinstallprompt'))}
                className="w-full bg-white text-slate-900 py-3 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all"
              >
                Install Now
              </button>
            )}
          </div>
          
          <button onClick={dismiss} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}