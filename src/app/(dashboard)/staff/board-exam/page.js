"use client";

import { useState, useEffect } from "react";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { db } from "@/lib/firebase";
import { 
  doc, getDoc, collection, getDocs, addDoc, 
  serverTimestamp, query, where, orderBy, limit, onSnapshot 
} from "firebase/firestore";
import { 
  ClipboardList, BookOpen, Timer, Award, TrendingUp, X, ChevronRight, Calendar, CheckCircle2 
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
      <div className="safe-top bg-white p-4 flex justify-between items-center sticky top-0 border-b">
         <div className="w-10"></div>
         <span className="font-black text-[10px] uppercase tracking-tighter">Study: {currentIndex + 1}/{questions.length}</span>
         <button onClick={onClose} className="p-2 bg-slate-100 text-pink-700 rounded-xl"><X size={20}/></button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm mb-6">
          <h2 className="text-lg font-bold text-slate-800 leading-snug mb-8">{currentQ?.question}</h2>
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
                  className={`w-full text-left p-4 rounded-xl border-2 font-bold text-sm flex items-center gap-3 transition-all ${style}`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] ${isRevealed && isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-100'}`}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] bg-white border-t flex gap-4">
        <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} className="flex-1 py-4 bg-slate-100 rounded-xl font-black text-[10px] uppercase">Back</button>
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
      <div className="p-4 border-b flex justify-between items-center bg-pink-700 text-white">
        <span className="text-[10px] font-black uppercase">Question {currentIndex + 1} of {questions.length}</span>
        <div className="bg-white/10 px-3 py-1 rounded-lg font-mono font-bold text-xs">
          {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}
        </div>
        <button onClick={() => confirm("Quit Exam?") && onClose()}><X size={20}/></button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[300px]">
          <h2 className="text-lg font-bold text-slate-800 mb-8 leading-tight">{questions[currentIndex]?.question}</h2>
          <div className="space-y-3">
            {questions[currentIndex]?.options?.map((opt, i) => (
              <button key={i} onClick={() => setAnswers({...answers, [currentIndex]: i})}
                className={`w-full text-left p-4 rounded-xl border-2 font-bold text-sm transition-all flex items-center gap-3 ${answers[currentIndex] === i ? 'border-[#db2777] bg-pink-50 text-[#db2777]' : 'border-slate-100 bg-white'}`}>
                <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] ${answers[currentIndex] === i ? 'bg-[#db2777] text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] bg-white border-t flex gap-4 sticky bottom-0 z-40">
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
  const [activeModal, setActiveModal] = useState(null);
  const [stats, setStats] = useState({ avg: 0, count: 0 });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!staffId) return;
    const q = query(collection(db, "exam-results"), where("staffId", "==", staffId), orderBy("date", "desc"));
    
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      const avg = data.length > 0 ? Math.round(data.reduce((a, b) => a + b.score, 0) / data.length) : 0;
      setStats({ avg, count: data.length });
      setHistory(data.slice(0, 5));
      setLoading(false);
    });
  }, [staffId]);

  if (loading) return <div className="p-20 text-center font-black text-pink-500 animate-pulse text-xs tracking-widest uppercase">Syncing Dashboard...</div>;

  return (
    <div className="min-h-screen bg-[#fafafa] pb-32 font-sans relative overflow-x-hidden">
      {activeModal === 'learn' && <LearnTheoryModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'live' && <LiveExamModal staffId={staffId} onClose={() => setActiveModal(null)} />}

      {/* STICKY APP HEADER */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 p-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Exam Prep</h1>
            <p className="text-[10px] font-black text-[#db2777] uppercase tracking-widest">State Board Portal</p>
          </div>
          <div className="bg-pink-50 px-3 py-1 rounded-lg border border-pink-100">
            <span className="text-[9px] font-black text-[#db2777] uppercase tracking-tight">Level 1 Staff</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 mt-2 max-w-md mx-auto">
        
        {/* NATIVE STYLE STATS CARDS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-50 rounded-lg flex items-center justify-center text-[#db2777] flex-shrink-0">
              <Award size={20} />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight leading-none">Avg Score</p>
              <p className="text-xl font-black text-slate-900 mt-1 leading-none">{stats.avg}%</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
              <ClipboardList size={20} />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight leading-none">Tests Taken</p>
              <p className="text-xl font-black text-slate-900 mt-1 leading-none">{stats.count}</p>
            </div>
          </div>
        </div>

        {/* MAIN ACTIONS */}
        <div className="space-y-3">
          <button onClick={() => setActiveModal('learn')} className="w-full bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 active:scale-95 transition-all">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><BookOpen size={24}/></div>
            <div className="text-left flex-1">
              <h3 className="font-black text-slate-900 uppercase text-xs tracking-tight">Learn Theory</h3>
              <p className="text-[10px] font-bold text-slate-400">Study mode with instant answers</p>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>

          <button onClick={() => setActiveModal('live')} className="w-full bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 active:scale-95 transition-all">
            <div className="w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center text-[#db2777]"><Timer size={24}/></div>
            <div className="text-left flex-1">
              <h3 className="font-black text-slate-900 uppercase text-xs tracking-tight">Live Exam Test</h3>
              <p className="text-[10px] font-bold text-slate-400">Timed simulation for state board</p>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
        </div>

        {/* NATIVE STYLE HISTORY LIST */}
        <div className="mt-8">
          <div className="flex justify-between items-center px-2 mb-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Activity</h4>
            <div className="h-[1px] flex-1 bg-slate-100 mx-4"></div>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden mb-10">
            {history.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-[10px] font-bold text-slate-300 uppercase italic">No activity recorded</p>
              </div>
            ) : (
              history.map((item, i) => (
                <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.score >= 75 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {item.score >= 75 ? <CheckCircle2 size={18}/> : <X size={18}/>}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Mock Exam</p>
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