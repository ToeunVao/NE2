"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { 
  signInWithEmailAndPassword, 
  setPersistence, 
  browserLocalPersistence 
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Ensure the user stays logged in
      await setPersistence(auth, browserLocalPersistence);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === "admin") {
          router.push("/admin");
        } else {
          router.push("/staff/dashboard");
        }
      } else {
        router.push("/admin");
      }
    } catch (err) {
      console.error("Login Error:", err.message);
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center px-6 bg-cover bg-center bg-no-repeat"
      style={{ 
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('https://images.unsplash.com/photo-1632345031435-8727f6897d53?q=80&w=2070&auto=format&fit=crop')` 
      }}
    >
      {/* Glassmorphism Login Card */}
      <div className="w-full max-w-md backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 p-10 rounded-xl shadow-2xl border border-white/20">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-pink-600 uppercase tracking-tighter leading-none">
            Nails Express
          </h1>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] mt-3">
            Salon Management System
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="p-4 bg-red-500/10 text-red-600 text-xs font-bold rounded-xl border border-red-500/20 text-center">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Email</label>
            <input 
              type="email" required placeholder="admin@nailsxpress.com"
              className="w-full p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 transition-all border border-slate-200 dark:border-slate-700"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Password</label>
            <input 
              type="password" required placeholder="••••••••"
              className="w-full p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 transition-all border border-slate-200 dark:border-slate-700"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-pink-600 text-white font-black py-4 rounded-xl hover:bg-pink-700 active:scale-[0.98] transition-all shadow-xl shadow-pink-500/30 uppercase tracking-widest text-sm disabled:opacity-50 mt-4"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-slate-400 text-[10px] font-bold uppercase mt-8 tracking-widest">
          Secure Admin Access Only
        </p>
      </div>
    </div>
  );
}