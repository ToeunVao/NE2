"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, addDoc, serverTimestamp, onSnapshot, 
  query, orderBy, deleteDoc, doc 
} from "firebase/firestore";

export default function AccessCodeManager() {
  const [codes, setCodes] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // 1. Listen for active codes
  useEffect(() => {
    const q = query(collection(db, "access_codes"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // 2. Generate a random 6-digit code
  const generateCode = async () => {
    setIsGenerating(true);
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      await addDoc(collection(db, "access_codes"), {
        code: newCode,
        status: "active",
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Valid for 24 hours
      });
    } catch (error) {
      console.error("Error generating code:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteCode = async (id) => {
    await deleteDoc(doc(db, "access_codes", id));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 mb-8">
        <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">Theory Exam Access</h1>
        <p className="text-gray-400 text-xs font-bold uppercase mb-6">Generate 6-digit codes for student examinations</p>
        
        <button 
          onClick={generateCode}
          disabled={isGenerating}
          className="bg-gray-900 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-blue-600 transition-all disabled:opacity-50"
        >
          {isGenerating ? "Generating..." : "Generate New Access Code"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {codes.map((item) => (
          <div key={item.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center relative group">
            <button 
              onClick={() => deleteCode(item.id)}
              className="absolute top-2 right-2 text-gray-200 hover:text-red-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="text-[10px] font-black text-blue-500 uppercase mb-2">Active Code</span>
            <div className="text-4xl font-black tracking-widest text-gray-800 mb-2 font-mono">
              {item.code}
            </div>
            <p className="text-[9px] font-bold text-gray-300 uppercase italic">
              Created: {item.createdAt?.toDate().toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>

      {codes.length === 0 && (
        <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">No active access codes</p>
        </div>
      )}
    </div>
  );
}