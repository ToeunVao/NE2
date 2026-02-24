"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, addDoc, serverTimestamp, onSnapshot, 
  query, orderBy, deleteDoc, doc, updateDoc, 
  setDoc, getDoc // <-- Add these
} from "firebase/firestore";

export default function AdminTheoryManager() {
  // Add this with your other states
const [questionLimit, setQuestionLimit] = useState(100);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [existingQuestions, setExistingQuestions] = useState([]);
  
  // Bulk Import & Edit States
  const [bulkText, setBulkText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState(null); // Tracks which question is being edited

  useEffect(() => {
    const q = query(collection(db, "nail-theory-tests"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExistingQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // --- SAVE / UPDATE LOGIC ---
  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    const data = {
      question,
      options,
      correctAnswer: Number(correctAnswer),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        // Update existing
        await updateDoc(doc(db, "nail-theory-tests", editingId), data);
        setEditingId(null);
      } else {
        // Add new
        await addDoc(collection(db, "nail-theory-tests"), { ...data, createdAt: serverTimestamp() });
      }
      resetForm();
    } catch (err) { alert("Error saving question"); }
  };

  const resetForm = () => {
    setQuestion("");
    setOptions(["", "", "", ""]);
    setCorrectAnswer(0);
    setEditingId(null);
  };

  const startEdit = (q) => {
    setEditingId(q.id);
    setQuestion(q.question);
    setOptions(q.options);
    setCorrectAnswer(q.correctAnswer);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll up to the form
  };

  // Load current settings when page opens
useEffect(() => {
  const loadSettings = async () => {
    const docSnap = await getDoc(doc(db, "settings", "live-exam"));
    if (docSnap.exists()) {
      setQuestionLimit(docSnap.data().questionLimit || 100);
    }
  };
  loadSettings();
}, []);

// Function to save the limit to the global settings
const saveLiveSettings = async () => {
  try {
    await setDoc(doc(db, "settings", "live-exam"), {
      questionLimit: Number(questionLimit),
      updatedAt: serverTimestamp()
    });
    alert("Live Test Settings Updated! ✅");
  } catch (err) {
    console.error(err);
    alert("Error saving settings.");
  }
};

  const handleBulkImport = async () => {
    if (!bulkText.trim()) return alert("Please paste text first!");
    setIsImporting(true);
    const blocks = bulkText.split(/\n\s*\n/);
    let importedCount = 0;
    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l !== "");
      if (lines.length >= 5) {
        const qText = lines[0].replace(/^\d+[\.\)]\s*/, "");
        const opts = [
            lines[1].replace(/^[A-D][\)\.]\s*/i, ""),
            lines[2].replace(/^[A-D][\)\.]\s*/i, ""),
            lines[3].replace(/^[A-D][\)\.]\s*/i, ""),
            lines[4].replace(/^[A-D][\)\.]\s*/i, "")
        ];
        await addDoc(collection(db, "nail-theory-tests"), {
          question: qText, options: opts, correctAnswer: 0, createdAt: serverTimestamp(),
        });
        importedCount++;
      }
    }
    alert(`Imported ${importedCount} questions. Please review and set correct answers below!`);
    setBulkText("");
    setIsImporting(false);
  };

  const deleteQuestion = async (id) => {
    if (confirm("Delete this question?")) await deleteDoc(doc(db, "nail-theory-tests", id));
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 font-sans">
      
      {/* FORM SECTION (Used for both Add and Edit) */}
      <section className={`p-8 rounded-xl shadow-sm border transition-all ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
        <h2 className="text-xl font-black mb-6 uppercase tracking-tight flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
                {editingId ? '✎' : '1'}
            </span>
            {editingId ? 'Edit Question' : 'Add New Question'}
          </div>
          {editingId && (
            <button onClick={resetForm} className="text-[10px] bg-white border border-blue-300 px-3 py-1 rounded-full text-blue-500 font-bold uppercase">Cancel Edit</button>
          )}
        </h2>
        <form onSubmit={handleSaveQuestion} className="space-y-4">
          <textarea 
            className="w-full p-4 bg-white rounded-xl border border-gray-100 focus:ring-2 focus:ring-pink-500 font-bold outline-none"
            placeholder="Type your question here..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {options.map((opt, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${correctAnswer === i ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                 <input 
                  type="radio" 
                  name="correct-idx" 
                  checked={correctAnswer === i} 
                  onChange={() => setCorrectAnswer(i)}
                  className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                />
                <input 
                  className="flex-1 bg-transparent border-none text-sm font-bold outline-none"
                  placeholder={`Option ${String.fromCharCode(65+i)}`}
                  value={opt}
                  onChange={(e) => {
                    const n = [...options]; n[i] = e.target.value; setOptions(n);
                  }}
                />
              </div>
            ))}
          </div>
          <button className={`w-full py-4 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-lg transition-all ${editingId ? 'bg-blue-600 shadow-blue-200' : 'bg-gray-900 shadow-gray-200'}`}>
            {editingId ? 'Update Question' : 'Save Question'}
          </button>
        </form>
      </section>

      {/* BULK IMPORT SECTION (Same as picture) */}
      <section className="bg-pink-50 p-8 rounded-xl border-2 border-dashed border-pink-200">
        <h2 className="text-xl font-black mb-1 uppercase tracking-tight text-pink-600 flex items-center gap-2">
          <span className="bg-pink-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs italic font-serif">G</span>
          Google Doc Bulk Import
        </h2>
        <p className="text-xs font-bold text-pink-400 mb-6 italic">Paste your text here—questions default to "A" as correct. Edit below to change.</p>
        <textarea 
          className="w-full h-32 p-4 bg-white rounded-xl border border-pink-100 focus:ring-2 focus:ring-pink-500 font-medium text-sm outline-none mb-4 shadow-inner"
          placeholder="Paste text here..."
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
        />
        <button onClick={handleBulkImport} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest">
            {isImporting ? "Processing..." : "Process & Import Questions"}
        </button>
      </section>

{/* LIVE TEST CONFIGURATION PANEL */}
<div className="mb-10 p-6 bg-blue-50 rounded-xl border border-blue-100 shadow-sm">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h3 className="text-sm font-black uppercase text-blue-900 tracking-tight">Live Test Engine Settings</h3>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-1">
                Currently controlling the /theory-test/live page
            </p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-blue-100">
            <div className="pl-2">
                <label className="text-[9px] font-black uppercase text-gray-400 block leading-none">Question Limit</label>
                <input 
                    type="number" 
                    value={questionLimit}
                    onChange={(e) => setQuestionLimit(e.target.value)}
                    className="w-16 pt-1 bg-transparent font-black text-blue-900 outline-none text-lg"
                />
            </div>
            <button 
                onClick={saveLiveSettings}
                className="bg-blue-900 text-white px-5 py-3 rounded-xl font-black uppercase text-[10px] hover:bg-blue-800 transition-all shadow-md active:scale-95"
            >
                Save Changes
            </button>
        </div>
    </div>
    
    <div className="flex gap-2 mt-4">
       <div className="px-3 py-1.5 bg-white/60 rounded-lg border border-blue-100">
          <span className="text-[9px] font-black text-blue-900 uppercase">Total Pool: {existingQuestions.length} Qs</span>
       </div>
       <div className="px-3 py-1.5 bg-green-500/10 rounded-lg border border-green-200">
          <span className="text-[9px] font-black text-green-600 uppercase">Active Exam: {Math.min(questionLimit, existingQuestions.length)} Qs</span>
       </div>
    </div>
</div>

      {/* EXISTING QUESTIONS LIST WITH EDIT BUTTON */}
      <section className="space-y-4">
        <h2 className="text-xl font-black uppercase tracking-tight text-gray-800">Existing Questions ({existingQuestions.length})</h2>
        {existingQuestions.map((q, idx) => (
          <div key={q.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative group hover:border-pink-200 transition-all">
            <div className="absolute top-4 right-4 flex gap-2">
                <button onClick={() => startEdit(q)} className="p-2 text-gray-300 hover:text-blue-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                </button>
                <button onClick={() => deleteQuestion(q.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
            <p className="text-[10px] font-black text-pink-500 mb-1 uppercase tracking-widest">Question {existingQuestions.length - idx}</p>
            <p className="font-bold text-gray-800 mb-4 pr-16">{q.question}</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {q.options.map((opt, i) => (
                <div key={i} className={`text-xs font-bold flex items-center gap-2 p-1 rounded ${q.correctAnswer === i ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${q.correctAnswer === i ? 'bg-green-100' : 'bg-gray-50'}`}>
                    {String.fromCharCode(65+i)}
                  </span>
                  {opt} {q.correctAnswer === i && '✓'}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}