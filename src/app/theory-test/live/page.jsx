"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, getDoc, query, where, deleteDoc, doc } from "firebase/firestore";

export default function LiveTest() {
  const router = useRouter();
  const { testId } = useParams(); // <--- Add this line
  const [reviewMode, setReviewMode] = useState(false);
  // 1. AUTHENTICATION STATES
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isStaff, setIsStaff] = useState(false);

  // 2. EXAM STATES
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5400); 
  const [loading, setLoading] = useState(true);

  const EXAM_LIMIT = 100;

  // --- SECURITY: DELETE CODE ONCE USED ---
  const deleteUsedCode = async () => {
    const mode = sessionStorage.getItem("access_mode");
    if (mode === "staff") return; // Don't delete if staff is practicing

    const savedCode = sessionStorage.getItem("active_exam_code");
    if (!savedCode) return;

    try {
      const q = query(collection(db, "access_codes"), where("code", "==", savedCode));
      const snap = await getDocs(q);
      snap.forEach(async (docSnap) => {
        await deleteDoc(doc(db, "access_codes", docSnap.id));
      });
      sessionStorage.removeItem("active_exam_code");
    } catch (err) { console.error("Cleanup error:", err); }
  };

  // --- SECURITY: RUNS IMMEDIATELY ON LOAD ---
  useEffect(() => {
    const auth = sessionStorage.getItem("theory_auth");
    const mode = sessionStorage.getItem("access_mode");
    
    if (!auth) {
      router.replace("/theory-test/login");
    } else {
      setIsAuthorized(true);
      setCheckingAuth(false);
      if (mode === "staff") setIsStaff(true);
      deleteUsedCode(); // Burn the student code
    }
  }, [router]);

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (loading || isFinished || !isAuthorized) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, isFinished, isAuthorized]);

  // --- DATA FETCHING ---
// --- DATA FETCHING (Corrected & Defensive) ---
  useEffect(() => {
    if (!isAuthorized) return;

    const loadExam = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch the Global Limit from Admin settings
        const settingsSnap = await getDoc(doc(db, "settings", "live-exam"));
        let activeLimit = 100; // Fallback
        
        if (settingsSnap.exists()) {
          const dbLimit = settingsSnap.data().questionLimit;
          // Ensure it's a valid number and not 0
          activeLimit = (dbLimit && Number(dbLimit) > 0) ? Number(dbLimit) : 100;
        }

        // 2. Fetch all questions
        const snap = await getDocs(collection(db, "nail-theory-tests"));
        // FIXED: Changed 'd.id' to 'doc.id' to match the map variable
        const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (all.length === 0) {
          console.error("No questions found in 'nail-theory-tests'");
          setLoading(false);
          return;
        }

        // 3. Shuffle and apply the limit (whichever is smaller)
        const shuffled = all.sort(() => 0.5 - Math.random());
        const limitToUse = Math.min(activeLimit, all.length);
        
        setQuestions(shuffled.slice(0, limitToUse));
        
      } catch (err) {
        console.error("Error loading exam:", err);
      } finally {
        setLoading(false);
      }
    };

    loadExam();
  }, [isAuthorized]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' + s : s}`;
  };

  // --- RENDER LOGIC ---

  if (checkingAuth) {
    return <div className="h-screen bg-slate-100 flex items-center justify-center font-black uppercase text-blue-900 animate-pulse">Verifying Access...</div>;
  }

  if (isFinished) {
    const correctCount = questions.reduce((acc, q, idx) => {
      return acc + (selectedAnswers[idx] === q.correctAnswer ? 1 : 0);
    }, 0);
    const scorePercent = Math.round((correctCount / questions.length) * 100);
    const isPassed = scorePercent >= 75;

    return (
      <div className="min-h-screen bg-slate-100 p-10 flex items-center justify-center">
        <div className="max-w-3xl w-full bg-white rounded-xl shadow-2xl border-t-8 border-blue-900 p-10 text-center">
          <h1 className="text-3xl font-black text-blue-900 uppercase mb-6">Score Report</h1>
          <div className={`text-7xl font-black mb-4 ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
            {scorePercent}%
          </div>
          <p className="font-bold uppercase tracking-widest text-gray-400 mb-10">
            {isPassed ? "Status: Passed" : "Status: Failed"}
          </p>
          <button onClick={() => { sessionStorage.clear(); window.location.href = "/"; }} className="w-full py-4 bg-blue-900 text-white rounded-xl font-black uppercase tracking-widest shadow-lg">
            Exit System
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-20 text-center font-black uppercase text-blue-900 animate-pulse">Initializing Exam...</div>;

// This determines which questions the user actually sees
const visibleQuestions = reviewMode 
  ? questions.filter((_, idx) => flagged[idx]) 
  : questions;

// We also need to map the current view index to the ACTUAL question index
const currentQ = visibleQuestions[currentIndex];

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden border-t-8 border-blue-900">
        <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="font-black text-blue-900 uppercase text-xs">Question {currentIndex + 1} of {questions.length}</span>
            {isStaff && (
              <button 
                onClick={() => confirm("Exit to Dashboard?") && router.push("/admin/theory-manager")}
                className="bg-white border px-3 py-1 rounded-lg text-[10px] font-black uppercase text-gray-400 hover:text-red-500 transition-all"
              >
                Exit Dashboard
              </button>
            )}
          </div>
          <div className={`px-4 py-2 rounded-lg font-mono font-black border-2 ${timeLeft < 300 ? 'text-red-600 bg-red-50 animate-pulse' : 'text-blue-900 bg-white'}`}>
             ⏱ {formatTime(timeLeft)}
          </div>
        </div>

        <div className="p-8 md:p-12 min-h-[400px]">
          <div className="flex justify-between items-start mb-10">
            <h2 className="text-2xl font-bold text-gray-800 leading-tight pr-10">{currentQ?.question}</h2>
            <button 
              onClick={() => setFlagged({...flagged, [currentIndex]: !flagged[currentIndex]})} 
              className={`p-2 rounded-xl border-2 transition-all ${flagged[currentIndex] ? 'bg-orange-500 border-orange-500 text-white shadow-lg' : 'bg-gray-50 border-gray-100 text-gray-300'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={flagged[currentIndex] ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {currentQ?.options?.map((opt, i) => (
              <button 
                key={i}
                onClick={() => setSelectedAnswers({...selectedAnswers, [currentIndex]: i})}
                className={`w-full text-left p-5 rounded-xl border-2 transition-all flex items-center gap-4 ${
                  selectedAnswers[currentIndex] === i ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-100'
                }`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${selectedAnswers[currentIndex] === i ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="font-bold text-gray-700">{opt}</span>
              </button>
            ))}
          </div>
        </div>


<div className="p-6 bg-gray-50 border-t flex justify-between items-center">
 
      <button 
      onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
      disabled={currentIndex === 0}
      className="px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold uppercase text-xs disabled:opacity-30"
    >
      Previous
    </button>
    {/* ONLY SHOW BUTTON IF THERE ARE FLAGS */}
    {Object.values(flagged).filter(Boolean).length > 0 && (
      <button 
        onClick={() => {
          setCurrentIndex(0); 
          setReviewMode(!reviewMode);
        }}
        className={`px-4 py-3 rounded-xl font-black uppercase text-[10px] transition-all border-2 ${
          reviewMode 
            ? 'bg-orange-500 border-orange-500 text-white shadow-inner' 
            : 'bg-white border-orange-200 text-orange-500 hover:bg-orange-50'
        }`}
      >
        <i className="fas fa-flag mr-2"></i>
        {reviewMode ? "Show All" : `Review Flagged (${Object.values(flagged).filter(Boolean).length})`}
      </button>
    )}
    
<button 
  onClick={() => {
    if (currentIndex === visibleQuestions.length - 1) {
      if (reviewMode) {
        setReviewMode(false);
        setCurrentIndex(0);
      } else if (confirm("Submit Exam?")) {
        setIsFinished(true); // Changed from finishExam() to match your state
      }
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }}
  className="px-10 py-3 bg-blue-900 text-white rounded-xl font-black uppercase text-xs shadow-lg"
>
  {currentIndex === visibleQuestions.length - 1 ? (reviewMode ? "Exit Review" : "Finish") : "Next"}
</button>
</div>

      </div>
    </div>
  );
}