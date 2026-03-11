"use client"; // <--- ADD THIS LINE HERE
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
// Find this line in your imports and add orderBy to the list:
import { 
  doc, getDoc, collection, getDocs, addDoc, 
  serverTimestamp, query, where, orderBy, limit, onSnapshot, deleteDoc // <--- ADD orderBy HERE
} from "firebase/firestore";
import { useToast } from "@/context/ToastContext";
import { useStaffAuth } from "@/hooks/useStaffAuth";

import { 
  ClipboardList, BookOpen, Timer, Award, TrendingUp, X, ChevronRight, Calendar, CheckCircle2, Search 
} from "lucide-react";
import confetti from 'canvas-confetti';
// ==========================================
// 1. LEARN THEORY MODAL (STUDY MODE)
// ==========================================
const LearnTheoryModal = ({ onClose }) => {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [answeredState, setAnsweredState] = useState({});

  useEffect(() => {
    getDocs(collection(db, "nail-theory-tests")).then(snap => {
      setQuestions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); // Fixed d.id bug
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="fixed inset-0 z-[60] bg-white flex items-center justify-center font-black text-pink-500 animate-pulse text-xs tracking-widest">LOADING STUDY MODE...</div>;

  const currentQ = questions[currentIndex];
  const isRevealed = answeredState[currentIndex] !== undefined;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50 flex flex-col animate-in slide-in-from-bottom duration-300">
      <div className="p-4 border-b flex justify-between items-center bg-pink-700 text-white dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
        
         <span className="font-black text-[10px] uppercase tracking-tighter">Study: {currentIndex + 1}/{questions.length}</span>
         <button onClick={onClose} ><X size={20}/></button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm mb-6 dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
          <h2 className="text-lg font-bold text-slate-800 leading-snug mb-8 dark:text-white">{currentQ?.question}</h2>
          <div className="space-y-3">
            {currentQ?.options.map((opt, i) => {
              const isCorrect = i === currentQ.correctAnswer;
              const isUserChoice = answeredState[currentIndex] === i;
              let style = "border-slate-100 bg-white";
              if (isRevealed) {
                if (isCorrect) style = "border-emerald-500 bg-emerald-50 text-emerald-700";
                else if (isUserChoice) style = "border-red-500 bg-red-50 text-red-700";
                else style = "opacity-40 border-slate-50";
              }
              return (
                <button key={i} disabled={isRevealed} onClick={() => setAnsweredState({...answeredState, [currentIndex]: i})}
                  className={`w-full text-left p-4 rounded-xl dark:bg-slate-950 border-2 dark:text-white font-bold text-sm flex items-center gap-3 transition-all ${style}`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center dark:bg-slate-900/80 text-[10px] ${isRevealed && isCorrect ? 'bg-emerald-500 dark:bg-slate-900/80 text-white' : 'bg-slate-100'}`}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] bg-white border-t flex gap-4 sticky bottom-0 z-40 dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
        <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} className="flex-1 dark:bg-slate-950 py-4 bg-slate-100 rounded-xl font-black text-[10px] uppercase">Back</button>
        <button onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))} className="flex-[2] py-4 bg-[#db2777] text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-pink-200">Next Question</button>
      </div>
    </div>
  );
};

// ==========================================
// 2. LIVE EXAM MODAL (TIMED TEST)
// ==========================================
const LiveExamModal = ({ onClose, staffId }) => {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5400);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExam = async () => {
      try {
        // 1. Fetch Global Limit from Admin Settings
        const settingsSnap = await getDoc(doc(db, "settings", "live-exam"));
        let activeLimit = 100;
        if (settingsSnap.exists()) {
          activeLimit = Number(settingsSnap.data().questionLimit) || 100;
        }

        // 2. Fetch Questions pool
        const snap = await getDocs(collection(db, "nail-theory-tests"));
        const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 3. Shuffle and Apply Limit
        const shuffled = all.sort(() => 0.5 - Math.random());
        setQuestions(shuffled.slice(0, Math.min(activeLimit, all.length)));
      } catch (err) {
        console.error("Exam Load Error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadExam();
  }, []);

  useEffect(() => {
    if (isFinished || loading) return;
    const t = setInterval(() => setTimeLeft(prev => (prev <= 1 ? 0 : prev - 1)), 1000);
    return () => clearInterval(t);
  }, [isFinished, loading]);

  const finishExam = async () => {
    if (!confirm("Submit your exam?")) return;
    const correct = questions.reduce((acc, q, i) => acc + (answers[i] === q.correctAnswer ? 1 : 0), 0);
    const score = Math.round((correct / questions.length) * 100);
    
    await addDoc(collection(db, "exam-results"), {
      staffId, score, correct, total: questions.length, date: serverTimestamp()
    });
    setIsFinished(true);
  };

  if (loading) return <div className="fixed inset-0 z-[70] bg-white flex items-center justify-center font-black text-pink-700 animate-pulse text-xs tracking-widest uppercase">Initializing Live Test...</div>;

if (isFinished) {
  const correct = questions.reduce((acc, q, i) => acc + (answers[i] === q.correctAnswer ? 1 : 0), 0);
  const score = Math.round((correct / questions.length) * 100);
  const isPassed = score >= 75;

  // FIREWORKS + VIBRATION LOGIC
  if (isPassed) {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    const end = Date.now() + (3 * 1000); 
    const colors = ['#db2777', '#ffffff', '#fbbf24'];
    (function frame() {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  } else {
    // FAIL VIBRATION: One long heavy pulse
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(500);
    }
  }

  return (
    <div className={`fixed inset-0 z-[70] flex items-center justify-center p-6 text-white text-center transition-all duration-1000 ${isPassed ? 'bg-emerald-600' : 'bg-slate-900'}`}>
      <div className={`space-y-8 max-w-sm w-full ${!isPassed ? 'animate-shake' : 'animate-in zoom-in duration-500'}`}>
        
        {/* ICON SECTION */}
        <div className="relative inline-block">
          <div className={`w-32 h-32 rounded-full flex items-center justify-center backdrop-blur-md border mx-auto shadow-2xl ${isPassed ? 'bg-white/20 border-white/30' : 'bg-red-500/20 border-red-500/50'}`}>
             {isPassed ? (
               <Award size={64} className="drop-shadow-lg" />
             ) : (
               <div className="relative">
                 <Timer size={64} className="text-red-400" />
                 <X size={32} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-black" />
               </div>
             )}
          </div>
        </div>

        {/* SCORE SECTION */}
        <div>
          <h1 className={`text-8xl font-black tracking-tighter drop-shadow-xl ${!isPassed ? 'text-red-500' : 'text-white'}`}>
            {score}%
          </h1>
          <p className="font-black uppercase tracking-[0.3em] text-white/50 text-[10px] mt-2">
            Required to Pass: 75%
          </p>
        </div>

        {/* TEXT CONTENT */}
        {isPassed ? (
          <div className="space-y-2 animate-in slide-in-from-bottom delay-300 duration-700 fill-mode-both">
            <p className="font-black text-2xl leading-tight uppercase italic tracking-tighter">
              🎉 You ready for <br/> state board exam!
            </p>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-1000">
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
              <p className="font-black text-xl uppercase tracking-tighter text-red-400 mb-1">
                Not Quite There Yet
              </p>
              <p className="text-sm font-bold text-slate-300 leading-relaxed">
                "Success is not final, failure is not fatal: it is the <span className="text-white">courage to continue</span> that counts."
              </p>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Review your theory and try again
            </p>
          </div>
        )}

        <button 
          onClick={onClose} 
          className={`w-full py-5 rounded-2xl font-black uppercase text-xs shadow-2xl active:scale-95 transition-all ${isPassed ? 'bg-white text-slate-900' : 'bg-slate-800 text-white border border-white/10'}`}
        >
          {isPassed ? 'Return to Dashboard' : 'Try Again Later'}
        </button>
      </div>

      {/* CSS FOR SHAKE ANIMATION */}
     <style jsx>{`
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-10px); }
        40% { transform: translateX(10px); }
        60% { transform: translateX(-10px); }
        80% { transform: translateX(10px); }
      }
      .animate-shake {
        animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
      }
    `}</style>
    </div>
  );
}

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      <div className="p-4 border-b flex justify-between items-center bg-pink-700 text-white dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
        <span className="text-[10px] font-black uppercase">Question {currentIndex + 1} of {questions.length}</span>
        <div className="bg-white/10 px-3 py-1 rounded-lg font-mono font-bold text-xs">
          {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}
        </div>
        <button onClick={() => confirm("Quit Exam?") && onClose()}><X size={20}/></button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900/80  dark:border-slate-800 dark:text-white">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[300px] dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
          <h2 className="text-lg font-bold text-slate-800 mb-8 leading-tight dark:text-white">{questions[currentIndex]?.question}</h2>
          <div className="space-y-3">
            {questions[currentIndex]?.options?.map((opt, i) => (
              <button key={i} onClick={() => setAnswers({...answers, [currentIndex]: i})}
                className={`w-full dark:bg-slate-950 dark:text-white dark:border-slate-800  text-left p-4 rounded-xl border-2 font-bold text-sm transition-all flex items-center gap-3 ${answers[currentIndex] === i ? 'border-[#db2777] bg-pink-50 text-[#db2777]' : 'border-slate-100 bg-white'}`}>
                <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] ${answers[currentIndex] === i ? 'bg-[#db2777] text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] dark:bg-slate-900/80 dark:border-slate-800 dark:text-white bg-white border-t flex gap-4 sticky bottom-0 z-40">
        {currentIndex > 0 && (
          <button onClick={() => setCurrentIndex(currentIndex - 1)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black text-xs uppercase text-slate-400">Back</button>
        )}
        <button 
          onClick={() => currentIndex === questions.length - 1 ? finishExam() : setCurrentIndex(currentIndex + 1)} 
          className="flex-[2] py-4 bg-pink-700 text-white rounded-xl font-black uppercase active:scale-95 transition-transform shadow-lg text-xs"
        >
          {currentIndex === questions.length - 1 ? "Submit Exam" : "Next Question"}
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 3. MAIN DASHBOARD
// ==========================================
export default function BoardExamDashboard() {
  const { staffId } = useStaffAuth();
  const { showToast } = useToast();
// ADD THESE STATES IF MISSING
  const [accessCode, setAccessCode] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [step, setStep] = useState("login"); // "login" -> "setup" -> "dashboard"
const [userName, setUserName] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true); // <--- This line is missing in your code

  const [activeModal, setActiveModal] = useState(null);
  const [stats, setStats] = useState({ avg: 0, count: 0 });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
// Change state initialization to this:
const [checkedItems, setCheckedItems] = useState(() => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("exam-checklist");
    return saved ? JSON.parse(saved) : {};
  }
  return {};
});
const [showGuidelines, setShowGuidelines] = useState(false);
 
// Check session on load
  useEffect(() => {
  if (localStorage.getItem("psi_authorized") === "true") {
    setIsAuthorized(true);
    // Optionally restore the name if they already registered
    setUserName(localStorage.getItem("psi_user_name") || "");
  }
    setCheckingAuth(false);
  }, []);

  const handleLogout = () => {
  localStorage.removeItem("psi_authorized");
  localStorage.removeItem("psi_user_name");
  window.location.reload();
};

  // Code Validation Function
// --- 1. Handle Code Verification ---
const handleAccessSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  
  try {
    const codesRef = collection(db, "access_codes");
    const q = query(codesRef, where("code", "==", accessCode.trim()));
    const snap = await getDocs(q);

    if (!snap.empty) {
      // Burn the code immediately so it cannot be reused
      const docId = snap.docs[0].id;
      await deleteDoc(doc(db, "access_codes", docId));
      
      // Move to Name Setup Phase
    // Use localStorage to persist the login
  localStorage.setItem("psi_authorized", "true");
  setStep("setup");
      showToast("Success", "Code verified! Please enter your name.", "success");
    } else {
      showToast("Error", "Invalid or expired access code.", "error");
    }
  } catch (err) {
    showToast("Error", "System error, please try again.", "error");
  } finally {
    setLoading(false);
  }
};

// --- 2. Handle Name Registration ---
const finishSetup = () => {
  if (userName.trim().length < 2) {
    showToast("Error", "Please enter a valid name.", "error");
    return;
  }
 // Save to localStorage so they don't have to re-enter their name
  localStorage.setItem("psi_user_name", userName);
  setIsAuthorized(true);
  setStep("dashboard");
};
const saveResult = async (score) => {
  const studentName = sessionStorage.getItem("psi_user_name");
  await addDoc(collection(db, "exam-results"), {
    studentName: studentName,
    score: score,
    timestamp: serverTimestamp()
  });
};

useEffect(() => {
  // 1. Get the student's name from sessionStorage
  const studentName = sessionStorage.getItem("psi_user_name");

  // 2. Logic: If no staffId AND no studentName, exit
  if (!staffId && !studentName) {
    setLoading(false);
    return;
  }

  // 3. Build the query dynamically
  let q;
  if (staffId) {
    // Staff view: See all results for their ID
    q = query(collection(db, "exam-results"), where("staffId", "==", staffId), orderBy("date", "desc"));
  } else {
    // Student view: See results only for their name
    q = query(collection(db, "exam-results"), where("studentName", "==", studentName), orderBy("date", "desc"));
  }
  
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    
    // Calculate stats
    const avg = data.length > 0 ? Math.round(data.reduce((a, b) => a + (b.score || 0), 0) / data.length) : 0;
    
    setStats({ avg, count: data.length });
    setHistory(data.slice(0, 5));
    setLoading(false);
  });
}, [staffId]); // Keep staffId as a dependency

  
  useEffect(() => {
  localStorage.setItem("exam-checklist", JSON.stringify(checkedItems));
}, [checkedItems]);

const examKits = [
 { 
    name: "Workstation Preparation (10 Minutes) - Keep on table until end of exam", 
    image: "/images/1.jpg",
    items: ["Q-tips", "Alcohol Pad", "Alcohol", "Lotion", "Cuticle oil","Papers towel", "Orangewood stick", "Single-use and multi-use items (large Bag)", "Disinfecting wipes", "Hand sanitizer", "Baggie of gloves","First aid kit", "3 Towels", "1 mannequin hand"] 
 
  },
  
 { 
    name: "Basic Manicure (25 Minutes)", 
    image: "/images/2.jpg",
    items: [
      "Cuticle softener",  
      "Polish remover", "Finger bowl", 
      "Nail brush", "Soap", "Water","White lint-free towel", "Cuticle pusher"
    ] 
  },
  { 
    name: "Nail Tip Application (25 Minutes)", 
    image: "/images/3.jpg",
    items: [
      "Dehydrator", "Nail glue", "Pin", "Nail tips", 
      "Clipper", "White lint-free towel", 
      "Nail tip cutters", 
      "File & buffer"
    ] 
  },
  { 
    name: "Nail Enhancement Using a Form (35 Minutes)", 
    image: "/images/4.jpg",
    items: [
      "Monomer & polymer", "Closed dappen dish", "Nail forms", 
      "white towel", "White lint-free towel", 
      "Acrylic brush", "File & buffer", "Primer", 
      "Dehydrator"
    ] 
  }
];
// --- GATEKEEPER UI ---
// A. LOGIN STEP
if (step === "login") return (
  <div className="h-screen bg-slate-50 flex items-center justify-center p-6">
    <form onSubmit={handleAccessSubmit} className="w-full max-w-sm bg-white p-8 rounded-xl shadow-xl border-t-4 border-pink-500">
      <h1 className="text-xl font-black uppercase mb-2">PSI Practical</h1>
      <input 
        className="w-full p-4 mb-4 bg-slate-100 rounded-xl font-black text-center text-lg"
        placeholder="ENTER CODE" 
        value={accessCode} 
        onChange={(e) => setAccessCode(e.target.value)} 
      />
      <button disabled={loading} className="w-full py-4 bg-pink-600 text-white rounded-xl font-black uppercase text-xs">
        {loading ? "VERIFYING..." : "ENTER SYSTEM"}
      </button>
    </form>
  </div>
);

// B. NAME SETUP STEP
if (step === "setup") return (
  <div className="h-screen bg-slate-50 flex items-center justify-center p-6">
    <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow-xl border-t-4 border-emerald-500">
      <h1 className="text-xl font-black uppercase mb-2">Welcome!</h1>
      <p className="text-[10px] font-bold text-gray-400 uppercase mb-6">Enter your name to track your progress.</p>
      <input 
        className="w-full p-4 mb-4 bg-slate-100 rounded-xl font-black text-center text-lg"
        placeholder="YOUR FULL NAME" 
        value={userName} 
        onChange={(e) => setUserName(e.target.value)} 
      />
      <button onClick={finishSetup} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-xs">
        START EXAM
      </button>
    </div>
  </div>
);


 // if (loading) return <div className="p-20 text-center font-black text-pink-500 animate-pulse text-xs tracking-widest uppercase">Syncing Dashboard...</div>;

  return (
    <div className="min-h-screen dark:bg-slate-950  bg-[#fafafa] pb-32 font-sans relative overflow-x-hidden">
      {activeModal === 'learn' && <LearnTheoryModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'live' && <LiveExamModal staffId={staffId} onClose={() => setActiveModal(null)} />}

      {/* STICKY APP HEADER */}
      <div className="sticky top-0 z-40 dark:bg-slate-900/80 dark:border-slate-800 bg-white/80 backdrop-blur-md border-b border-slate-100 p-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black dark:text-white text-slate-900 tracking-tighter">Exam Prep</h1>
            <p className="text-[10px] font-black text-[#db2777] uppercase tracking-widest">State Board Portal</p>
          </div>
          <div className="dark:bg-slate-950 dark:border-slate-800 dark:text-white bg-pink-50 px-3 py-1 rounded-lg border border-pink-100">
            <span className="text-[9px] font-black text-[#db2777] uppercase tracking-tight">Level 1 Staff</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 mt-2 max-w-md mx-auto">
        
        {/* NATIVE STYLE STATS CARDS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900/80 dark:border-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
            <div className="dark:bg-slate-950 dark:text-white w-10 h-10 bg-pink-50 rounded-lg flex items-center justify-center text-[#db2777] flex-shrink-0">
              <Award size={20} />
            </div>
            <div>
              <p className="text-[8px] dark:text-white font-black text-slate-400 uppercase tracking-tight leading-none">Avg Score</p>
              <p className="text-xl font-black dark:text-white text-slate-900 mt-1 leading-none">{stats.avg}%</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/80 dark:border-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
            <div className="dark:bg-slate-950 dark:text-white w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
              <ClipboardList size={20} />
            </div>
            <div>
              <p className="text-[8px] dark:text-white font-black text-slate-400 uppercase tracking-tight leading-none">Tests Taken</p>
              <p className="text-xl font-black dark:text-white text-slate-900 mt-1 leading-none">{stats.count}</p>
            </div>
          </div>
        </div>

        {/* MAIN ACTIONS */}
        <div className="space-y-3">
          <button onClick={() => setActiveModal('learn')} className="w-full dark:bg-slate-900/80 dark:border-slate-800 bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 active:scale-95 transition-all">
            <div className=" dark:bg-slate-950 dark:text-white w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><BookOpen size={24}/></div>
            <div className="text-left flex-1">
              <h3 className="font-black  dark:text-white text-slate-900 uppercase text-xs tracking-tight">Learn Theory</h3>
              <p className="text-[10px] font-bold text-slate-400">Study mode with instant answers</p>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>

          <button onClick={() => setActiveModal('live')} className="w-full dark:bg-slate-900/80 dark:border-slate-800 bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 active:scale-95 transition-all">
            <div className="dark:bg-slate-950 dark:text-white w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center text-[#db2777]"><Timer size={24}/></div>
            <div className="text-left flex-1">
              <h3 className="font-black  dark:text-white text-slate-900 uppercase text-xs tracking-tight">Live Exam Test</h3>
              <p className="text-[10px] font-bold text-slate-400">Timed simulation for state board</p>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
           <button onClick={() => setShowGuidelines(!showGuidelines)} className="w-full dark:bg-slate-900/80 dark:border-slate-800 bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 active:scale-95 transition-all">
            <div className="dark:bg-slate-950 dark:text-white w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center text-[#db2777]"><i className={`fas ${showGuidelines ? 'fa-minus-circle' : 'fa-info-circle'} text-24 transition-transform`}></i></div>
            <div className="text-left flex-1">
              <h3 className="font-black  dark:text-white text-slate-900 uppercase text-xs tracking-tight">{showGuidelines ? 'Hide Guidelines' : 'Practice Guidelines'}</h3>
              <p className="text-[10px] font-bold text-slate-400">{showGuidelines ? 'Click to Hide PSI Practical Guidelines' : 'Click to show PSI Practical Guidelines'}</p>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
          
        </div>
<div className="mt-4">
  {/* The Guidelines Content */}
  {showGuidelines && (
    <div className="mt-4 p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-xl shadow-2xl shadow-pink-100/20 animate-in slide-in-from-top-4 duration-500">
      
      {/* Header Section */}
      <div className="border-l-4 border-pink-500 pl-6 mb-8">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
          PSI Nail Practical Examination
        </h2>
        <p className="text-slate-400 font-medium text-sm mt-1">
          To ensure a smooth and successful experience, please adhere to the following guidelines.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Arrival & Kit Section */}
        <div className="space-y-6">
          <section>
            <h4 className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <i className="fas fa-clock text-[14px]"></i> Arrival and Check-In
            </h4>
            <ul className="space-y-2 text-slate-600 dark:text-slate-400 text-xs font-medium leading-relaxed">
              <li>• Arrive at least <span className="font-bold text-slate-900 dark:text-white">30 minutes</span> before your time.</li>
              <li>• Proceed to <span className="font-bold text-slate-900 dark:text-white">Room 138</span> for mandatory kit inspection.</li>
            </ul>
          </section>

          <section>
            <h4 className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <i className="fas fa-briefcase text-[14px]"></i> Kit Inspection Items
            </h4>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-white/5 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 uppercase">
              <div className="flex items-center gap-2">✓ Disinfectant wipe</div>
              <div className="flex items-center gap-2">✓ Odorless liquid</div>
              <div className="flex items-center gap-2">✓ Mannequin hand</div>
              <div className="flex items-center gap-2">✓ Hand sanitizer</div>
            </div>
          </section>
        </div>

        {/* Room & Prep Section */}
        <div className="space-y-6">
          <section>
            <h4 className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <i className="fas fa-chair text-[14px]"></i> Room Setup
            </h4>
            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
              Locate your designated table number and listen for the <span className="text-pink-600 font-bold">recorded speaker instructions</span>.
            </p>
          </section>

          <section className="bg-pink-50 dark:bg-pink-900/10 p-5 rounded-xl border border-pink-100 dark:border-pink-900/20">
            <h4 className="text-[10px] font-black text-pink-600 uppercase tracking-widest mb-3 flex items-center gap-2">
              <i className="fas fa-trash-alt text-[14px]"></i> Waste Management
            </h4>
            <div className="space-y-3">
              <div>
                <span className="text-[9px] font-black uppercase text-pink-400 block">Single-use</span>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium italic">Items that are not reusable.</p>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-pink-400 block">Multi-use</span>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium italic">Towels, clippers, and reusable tools.</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Task List Footer */}
<div className="mt-10 pt-6 border-t border-slate-100 dark:border-white/5">
  <h1 className="text-[14px] font-black text-slate-400 uppercase tracking-widest mb-6 text-center">Preparation Checklist</h1>
  
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {examKits.map((task, i) => (
<div key={i} className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden transition-all">
  
  {/* IMAGE SECTION - Click only active here */}
  {task.image && (
    <div 
      className="relative mb-4 -mx-5 -mt-5 h-40 overflow-hidden border-b border-slate-100 dark:border-white/5 cursor-zoom-in group"
      onClick={(e) => {
        e.stopPropagation(); // Prevents click from bubbling to parent
        setSelectedImage({ url: task.image, title: task.name });
      }}
    >
      <img 
        src={task.image} 
        alt={task.name} 
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
      />
      
      {/* Overlay - now strictly inside the image box */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/30">
          <Search size={14} className="text-white" />
          <p className="text-white text-[9px] font-black uppercase tracking-widest">
            Click to Zoom
          </p>
        </div>
      </div>
    </div>
  )}

  {/* TEXT & CHECKBOX SECTION - No zoom here */}
  <h4 className="text-[10px] font-black text-pink-500 uppercase tracking-[0.2em] mb-4">
    {task.name}
  </h4>
  
  <div className="space-y-3">
    {task.items.map((item) => (
     <label key={item} className="flex items-center gap-3 cursor-pointer group/item">
  <input 
    type="checkbox" // Fixed: Removed the backslash
    checked={!!checkedItems[item]}
    onChange={() => setCheckedItems(prev => ({ ...prev, [item]: !prev[item] }))}
    className="accent-pink-600 w-4 h-4 rounded border-slate-300"
  />
  <span className={`text-xs font-bold ${checkedItems[item] ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
    {item}
  </span>
</label>
    ))}
  </div>
</div>
  ))}
</div>
</div>
{/* FULL SCREEN IMAGE LIGHTBOX */}
{selectedImage && (
  <div 
    className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-10 transition-all"
    onClick={() => setSelectedImage(null)} // Click background to close
  >
    <button 
      className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
      onClick={() => setSelectedImage(null)}
    >
      <X size={32} strokeWidth={3} />
    </button>
    
    <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center">
      <img 
        src={selectedImage.url} 
        alt={selectedImage.title}
        className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl border border-white/10 object-contain"
      />
      <h3 className="mt-6 text-white font-black uppercase tracking-widest text-sm">
        {selectedImage.title}
      </h3>
      <p className="text-white/40 text-[10px] font-bold uppercase mt-2">
        Click anywhere to close
      </p>
    </div>
  </div>
)}

      {/* Success Banner Section */}
<div className="mt-12 mb-8 relative group overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400 opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" />
  
  <div className="relative border border-pink-100 dark:border-pink-900/30 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-8 rounded-3xl text-center shadow-xl shadow-pink-500/5">
    
    {/* Animated Icon */}
    <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-pink-500 to-rose-400 rounded-2xl shadow-lg shadow-pink-500/30 animate-bounce">
      <Award className="text-white" size={32} />
    </div>

    <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">
      Best of Luck
    </h2>
    
    <div className="flex items-center justify-center gap-2 mb-4">
      <span className="h-px w-8 bg-pink-200" />
      <p className="text-pink-600 dark:text-pink-400 font-black text-xs uppercase tracking-[0.2em]">
        Your Attentiveness is Key
      </p>
      <span className="h-px w-8 bg-pink-200" />
    </div>

    <p className="max-w-md mx-auto text-slate-500 dark:text-slate-400 text-[11px] font-bold leading-relaxed uppercase tracking-wide">
      Focus on your sanitation, maintain your posture, and treat the mannequin like a real client. You've got this!
    </p>
  </div>
</div>
    </div>
  )}
</div>
        {/* NATIVE STYLE HISTORY LIST */}
        <div className="mt-8">
          <div className="flex justify-between items-center px-2 mb-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Activity</h4>
            <div className="h-[1px] flex-1 bg-slate-100 mx-4"></div>
          </div>
          
          <div className="bg-white rounded-xl border dark:bg-slate-900/80 dark:border-slate-800 border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden mb-10">
            {history.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-[10px] font-bold text-slate-300 uppercase italic">No activity recorded</p>
              </div>
            ) : (
              history.map((item, i) => (
                <div key={i} className="p-4 flex items-center dark:border-slate-800 dark:bg-slate-950 dark:text-white justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 dark:bg-slate-950 dark:text-white rounded-xl flex items-center justify-center ${item.score >= 75 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {item.score >= 75 ? <CheckCircle2 size={18}/> : <X size={18}/>}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Mock Exam</p>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase">
                        <Calendar size={10} />
                        {item.date?.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${item.score >= 75 ? 'text-emerald-600' : 'text-red-600'}`}>{item.score}%</p>
                    <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{item.correct}/{item.total}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}