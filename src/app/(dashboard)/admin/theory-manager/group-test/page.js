"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/context/ToastContext";

export default function AdminTheory() {
  const { showToast } = useToast();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    timeLimit: 30,
    questionCount: 50,
    passingScore: 75
  });

  // Fetch existing tests
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "theoryTests"), (snap) => {
      setTests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleCreateTest = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "theoryTests"), {
        ...formData,
        active: true,
        createdAt: serverTimestamp(),
      });
      showToast("Live test link created!", "success");
      setFormData({ title: "", timeLimit: 30, questionCount: 50, passingScore: 75 });
    } catch (err) {
      showToast("Error creating test", "error");
    }
    setLoading(false);
  };

  const toggleStatus = async (id, currentStatus) => {
    await updateDoc(doc(db, "theoryTests", id), { active: !currentStatus });
  };

  const copyLink = (id) => {
    const link = `${window.location.origin}/theory-test/${id}`;
    navigator.clipboard.writeText(link);
    showToast("Link copied to clipboard!", "success");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-black uppercase tracking-tighter mb-8">Theory Test Manager</h1>

      {/* CREATE NEW TEST FORM */}
      <form onSubmit={handleCreateTest} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-10 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="text-[10px] font-black uppercase text-gray-400">Test Title</label>
          <input required className="w-full p-3 bg-gray-50 rounded-xl border-none font-bold" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. State Board 2026" />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-gray-400">Time (Mins)</label>
          <input type="number" className="w-full p-3 bg-gray-50 rounded-xl border-none font-bold" value={formData.timeLimit} onChange={e => setFormData({...formData, timeLimit: e.target.value})} />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-gray-400">Questions</label>
          <input type="number" className="w-full p-3 bg-gray-50 rounded-xl border-none font-bold" value={formData.questionCount} onChange={e => setFormData({...formData, questionCount: e.target.value})} />
        </div>
        <button disabled={loading} className="bg-black text-white p-4 rounded-xl font-black uppercase text-xs hover:bg-pink-600 transition-colors">
          Generate Live Link
        </button>
      </form>

      {/* ACTIVE LINKS TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
            <tr>
              <th className="p-4">Test Details</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {tests.map(test => (
              <tr key={test.id} className="hover:bg-gray-50/50">
                <td className="p-4">
                  <p className="font-black text-gray-800 uppercase">{test.title}</p>
                  <p className="text-[10px] text-gray-400 font-bold">{test.questionCount} Qs • {test.timeLimit} Mins</p>
                </td>
                <td className="p-4 text-center">
                  <button onClick={() => toggleStatus(test.id, test.active)} className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${test.active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {test.active ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button onClick={() => copyLink(test.id)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><i className="fas fa-copy"></i></button>
                  <button onClick={() => deleteDoc(doc(db, "theoryTests", test.id))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><i className="fas fa-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}