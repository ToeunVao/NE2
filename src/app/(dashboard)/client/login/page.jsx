"use client";
import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import Link from "next/link";
import { Mail, Lock, ArrowRight, Sparkles, Loader2 } from "lucide-react";

export default function ClientLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Verify Role: Ensure this user is actually a client
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();

      if (userData?.role === "client") {
        showToast("Welcome back to Nails Express!", "success");
        router.push("/client/dashboard");
      } else {
        // If an admin/staff tries to login here, redirect them to the proper place
        showToast("Staff detected. Redirecting to Management...", "info");
        router.push("/admin");
      }
    } catch (error) {
      console.error(error);
      showToast("Invalid email or password. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
      {/* Decorative Background Element */}
      <div className="absolute top-0 left-0 w-full h-64 bg-pink-600 -skew-y-6 -translate-y-32 z-0" />

      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-pink-200/50 p-8 md:p-12 z-10 relative overflow-hidden">
        {/* Logo Section */}
        <div className="text-center mb-10">
          <div className="inline-flex p-4 bg-pink-50 rounded-3xl mb-4 text-pink-600">
            <Sparkles size={32} />
          </div>
          <h1 className="text-3xl font-serif font-black text-gray-900 leading-tight">
            Nails Express
          </h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2">
            Client Portal
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="your@email.com"
                className="w-full p-4 pl-12 bg-gray-50 border border-transparent rounded-2xl font-bold focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Mail className="absolute left-4 top-4 text-gray-300" size={20} />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full p-4 pl-12 bg-gray-50 border border-transparent rounded-2xl font-bold focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Lock className="absolute left-4 top-4 text-gray-300" size={20} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:bg-pink-600 active:scale-[0.98] transition-all flex justify-center items-center gap-2 group disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                Sign In <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-10 text-center space-y-4">
          <p className="text-xs font-bold text-gray-400">
            Don't have an account?{" "}
            <Link href="/" className="text-pink-600 hover:underline">
              Book to register
            </Link>
          </p>
          
          <div className="pt-6 border-t border-gray-100">
             <Link href="/" className="text-[10px] font-black text-gray-300 uppercase tracking-widest hover:text-gray-500 transition-colors">
              ← Back to Main Page
             </Link>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <p className="mt-8 text-[10px] font-black text-gray-300 uppercase tracking-[0.5em] z-10">
        KY Luxury Nail Care
      </p>
    </div>
  );
}