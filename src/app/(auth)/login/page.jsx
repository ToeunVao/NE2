"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
      // 1. Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Fetch User Role from Firestore (Admin vs Staff)
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Redirect based on role
        if (userData.role === "admin") {
          router.push("/admin");
        } else {
          router.push("/staff-dashboard"); // You can create this later
        }
      } else {
        // If no role is found, default to admin for your first user
        router.push("/admin");
      }
    } catch (err) {
      setError("Invalid email or password. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-pink-50/30 px-6">
      <div className="max-w-md w-full bg-white rounded-[3rem] shadow-xl p-10 border border-white">
        <div className="text-center mb-10">
          <Link href="/" className="text-3xl font-serif font-bold text-pink-600">NailsXpress</Link>
          <h2 className="text-xl font-bold text-gray-800 mt-4">Staff Portal</h2>
          <p className="text-gray-400 text-sm">Please enter your credentials to continue</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-2xl border border-red-100 flex items-center gap-2">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase ml-2">Email Address</label>
            <input 
              type="email" required placeholder="admin@nailsxpress.com"
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 border-none mt-1"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase ml-2">Password</label>
            <input 
              type="password" required placeholder="••••••••"
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 border-none mt-1"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-pink-600 text-white font-bold py-5 rounded-2xl hover:bg-pink-700 transition-all shadow-lg shadow-pink-200 uppercase tracking-widest mt-4 disabled:opacity-50"
          >
            {loading ? <i className="fas fa-spinner animate-spin"></i> : "Sign In"}
          </button>
        </form>

        <div className="text-center mt-8">
          <Link href="/" className="text-sm text-gray-400 hover:text-pink-600 transition-colors">
            ← Back to Public Website
          </Link>
        </div>
      </div>
    </div>
  );
}