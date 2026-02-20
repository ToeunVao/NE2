"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase"; // Make sure auth is imported
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function TheoryLogin() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true); // Start as true to check staff status
  const router = useRouter();

  // --- STAFF BYPASS LOGIC ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // If a user is logged in (Staff/Admin), bypass the code
        sessionStorage.setItem("theory_auth", "true");
        sessionStorage.setItem("access_mode", "staff"); // Mark as staff so code isn't deleted
        router.push("/theory-test/live");
      } else {
        setLoading(false); // No staff found, show the login form
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (code.length < 6) return alert("Please enter a 6-digit code");
    
    setLoading(true);
    try {
      const q = query(collection(db, "access_codes"), where("code", "==", code));
      const snap = await getDocs(q);

      if (!snap.empty) {
        sessionStorage.setItem("theory_auth", "true");
        sessionStorage.setItem("active_exam_code", code); // Store code to burn it later
        router.push("/theory-test/live");
      } else {
        alert("Invalid Access Code.");
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  if (loading && !code) {
    return <div className="h-screen bg-slate-100 flex items-center justify-center font-black text-blue-900 animate-pulse">VERIFYING PERMISSIONS...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-10 border-t-8 border-blue-900">
        <h1 className="text-2xl font-black text-center text-blue-900 uppercase">Exam Login</h1>
        <p className="text-[10px] text-center text-gray-400 font-bold mb-8 uppercase">Students enter code below</p>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <input 
            type="text"
            maxLength={6}
            className="w-full text-center py-5 bg-gray-50 rounded-xl border-2 text-3xl font-black tracking-widest outline-none"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
          />
          <button className="w-full py-4 bg-blue-900 text-white rounded-xl font-black uppercase shadow-lg">
            Start Exam
          </button>
        </form>
      </div>
    </div>
  );
}