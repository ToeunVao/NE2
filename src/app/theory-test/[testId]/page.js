"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, getDoc, query, where, doc, addDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import confetti from "canvas-confetti";

export default function DynamicLiveTest() {
    
const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [reviewMode, setReviewMode] = useState(false);
  const router = useRouter();
  const { testId } = useParams();
  // 1. CONFIG & AUTH STATES
  const [testConfig, setTestConfig] = useState(null);
  const [nickname, setNickname] = useState("");
  const [gameState, setGameState] = useState("entry"); // entry, playing, results
const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  // 2. EXAM STATES (From your old live test)
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [timeLeft, setTimeLeft] = useState(0); 
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
const [lastScore, setLastScore] = useState(0);
const [allQuestions, setAllQuestions] = useState([]); // Store the original list
const [showFinalReview, setShowFinalReview] = useState(false);
  // --- FETCH TEST CONFIG & QUESTIONS ---
  useEffect(() => {
    const fetchTestData = async () => {
      try {
        const docRef = doc(db, "theoryTests", testId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().active) {
          const config = docSnap.data();
          setTestConfig(config);
          setTimeLeft(config.timeLimit * 60);

          // Fetch from your existing 'nail-theory-tests' collection
          // Inside your fetchTestData useEffect:
const qSnap = await getDocs(collection(db, "nail-theory-tests"));
const qList = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

setAllQuestions(qList); // Save the master list here
// Don't setQuestions here anymore; handleStartOrRetake will do it.
          const all = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          const shuffled = all.sort(() => 0.5 - Math.random());
          setQuestions(shuffled.slice(0, config.questionCount || 100));
        }
      } catch (err) { console.error(err); } 
      finally { setLoading(false); }
    };
    fetchTestData();
  }, [testId]);

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (gameState !== "playing" || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          finishExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, timeLeft]);
const showToast = (message, type = "success") => {
  setToast({ show: true, message, type });
  setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
};

const finishExam = async () => {
  showToast("Calculating results...", "success");

  // 1. FRESH CALCULATION
  const correctCount = questions.reduce((acc, q, idx) => {
    const userAnswer = selectedAnswers[idx];
    return (userAnswer !== undefined && userAnswer == q.correctAnswer) ? acc + 1 : acc;
  }, 0);

  const total = questions.length;
  const newScore = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  
  // Update state immediately so UI shows the NEW score
  setLastScore(newScore);

  // 2. SAVE AS NEW RECORD
  try {
    await addDoc(collection(db, "testResults"), {
      testId,
      nickname,
      score: newScore,
      correctCount: correctCount, // <--- Make sure this is here
    totalQuestions: questions.length, // <--- And this
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Save Error:", err);
  }

  const isPassed = newScore >= 75;
  if (isPassed) {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  }

  setGameState("results");
  fetchLeaderboard(); 
};

  const fetchLeaderboard = () => {
    const q = query(collection(db, "testResults"), where("testId", "==", testId));
    onSnapshot(q, (snap) => {
      const results = snap.docs.map(d => d.data());
      setLeaderboard(results.sort((a, b) => b.score - a.score));
    });
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' + s : s}`;
  };

useEffect(() => {
  const savedData = localStorage.getItem("fun_test_user");
  
  if (savedData) {
    const { name, expiry } = JSON.parse(savedData);
    const now = new Date().getTime();

    // If the current time is less than the expiry time (1 hour)
    if (now < expiry) {
      setNickname(name);
      setGameState("playing"); // Skip the entry screen
    } else {
      // Data expired, clean up
      localStorage.removeItem("fun_test_user");
    }
  }
}, []);
  const handleFinalSubmit = () => {
    setShowConfirmModal(false);
    showToast("Submitting your results...", "success"); // Your existing toast function
    finishExam();
};
const handleStartTest = () => {
  if (nickname.length > 1) {
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    const expiryTime = new Date().getTime() + oneHour;

    const userData = {
      name: nickname.toUpperCase(),
      expiry: expiryTime
    };

    localStorage.setItem("fun_test_user", JSON.stringify(userData));
    setGameState("playing");
    handleStartOrRetake();
  } else {
    // Using your alert preference: I'll stick to a simple check here 
    // unless you want to add the custom Alert UI we discussed!
    showToast("Please enter a nickname", "error");
  }
};

const handleRetake = () => {
    setSelectedAnswers({}); // Clear old answers
    setCurrentIndex(0);     // Reset to start
    setLastScore(0);        // Clear the 100%
    setGameState("playing");
};
const handleStartOrRetake = () => {
  // 1. Shuffle the original questions list
  const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
  
  // 2. Apply the limit from your config
  const limited = shuffled.slice(0, testConfig?.questionCount || 100);
  
  // 3. Reset all states for a clean start
  setQuestions(limited);
  setSelectedAnswers({});
  setFlagged({});
  setCurrentIndex(0);
  setLastScore(0);
  setReviewMode(false);
  
  // 4. Start the game
  setGameState("playing");
  
  showToast("New Exam Generated!", "success");
};

  // --- RENDERING ---

if (loading) {
  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Skeleton Header */}
        <div className="h-20 bg-white rounded-xl shadow-sm border-b-4 border-blue-900/10 animate-pulse flex items-center justify-between px-6">
          <div className="w-32 h-4 bg-slate-200 rounded-full"></div>
          <div className="w-24 h-8 bg-blue-900/10 rounded-xl"></div>
        </div>

        {/* Skeleton Question Card */}
        <div className="bg-white rounded-xl shadow-xl p-8 space-y-6">
          <div className="space-y-3">
            <div className="h-6 bg-slate-200 rounded-full w-3/4 animate-pulse"></div>
            <div className="h-6 bg-slate-200 rounded-full w-1/2 animate-pulse"></div>
          </div>

          {/* Skeleton Options */}
          <div className="grid grid-cols-1 gap-3 pt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-slate-50 border-2 border-slate-100 rounded-xl animate-pulse delay-[100ms]"></div>
            ))}
          </div>
        </div>

        {/* Skeleton Footer */}
        <div className="flex justify-between items-center pt-4">
          <div className="w-28 h-12 bg-slate-200 rounded-xl"></div>
          <div className="w-40 h-12 bg-blue-900/20 rounded-xl"></div>
        </div>

      </div>
    </div>
  );
}
 if (!testConfig) return <div className="h-screen flex items-center justify-center font-black uppercase text-red-500">Exam link is disabled or invalid.</div>;

// 1. ENTRY VIEW
if (gameState === "entry") {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl border-t-8 border-blue-900 p-8 text-center">
        <h1 className="text-2xl font-black text-blue-900 uppercase mb-2">{testConfig.title}</h1>
        <p className="text-xs font-bold text-gray-400 mb-8 uppercase">
          {testConfig.questionCount} Questions • {testConfig.timeLimit} Mins
        </p>
        
        <input 
          className="w-full p-4 bg-slate-50 rounded-xl mb-4 font-bold outline-none border-2 border-transparent focus:border-blue-900"
          placeholder="ENTER YOUR NICKNAME"
          value={nickname}
          onChange={(e) => setNickname(e.target.value.toUpperCase())}
        />
        
        <button 
          onClick={handleStartTest} // Connected to new function
          className="w-full py-4 bg-blue-900 text-white rounded-xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
        >
          Start Live Test
        </button>

        {/* Added this so they can reset their name if they want */}
        {nickname && (
          <button 
            onClick={() => {
              localStorage.removeItem("fun_test_user");
              setNickname("");
            }}
            className="mt-6 text-[10px] font-black text-gray-300 uppercase hover:text-red-500 transition-colors"
          >
            Not you? Clear saved name
          </button>
        )}
      </div>
    </div>
  );
}

// 2. RESULTS VIEW (Game Show / Leaderboard Style)
// 2. RESULTS VIEW (Game Show / Leaderboard Style)
if (gameState === "results") {
  const isPassed = lastScore >= 75;

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 md:p-8 flex flex-col items-center justify-center font-sans overflow-x-hidden">
      {/* BACKGROUND DECORATION */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-900/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-2xl w-full relative z-10">
        {/* MAIN SCORE CARD */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-8 text-center shadow-2xl mb-8 transform transition-all animate-in fade-in zoom-in duration-700">
          
          <div className={`inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${isPassed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {isPassed ? "State Board Qualified" : "Additional Review Required"}
          </div>
          
          <h1 className="text-5xl font-black text-white uppercase tracking-tighter mb-2">
            {isPassed ? "Certified! 🎓" : "Keep Pushing ✍️"}
          </h1>
          
          <div className="relative inline-block my-6">
            <div className={`text-9xl font-black italic tracking-tighter ${isPassed ? 'text-blue-400' : 'text-pink-500'} drop-shadow-[0_0_35px_rgba(59,130,246,0.3)]`}>
              {lastScore}<span className="text-4xl not-italic ml-1">%</span>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-6 mb-8 border border-white/5">
            <p className="text-white font-bold text-lg leading-snug italic">
              {isPassed 
                ? `"Fantastic! You are officially State Board Ready! ✨"` 
                : `"Don't get discouraged! Review your chapters and try again—you've got this! 💪"`}
            </p>
            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-3">
              Official Performance Report for {nickname}
            </p>
          </div>

          <div className="flex gap-4">
           <button 
  onClick={handleStartOrRetake} 
  className="flex-1 py-4 bg-white text-black rounded-xl font-black uppercase text-xs hover:scale-[1.02] transition-transform active:scale-95 shadow-lg shadow-white/10"
>
  Retake Exam
</button>
            <button 
              onClick={() => window.location.href = "/"} 
              className="flex-1 py-4 bg-white/10 text-white border border-white/20 rounded-xl font-black uppercase text-xs hover:bg-white/20 transition-all"
            >
              Exit System
            </button>
          </div>
          {/* NEW SHOW QUESTION BUTTON */}
  <button 
    onClick={() => setShowFinalReview(!showFinalReview)}
    className="mt-5 w-full py-4 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl font-black uppercase text-xs hover:bg-blue-600/30 transition-all"
  >
    {showFinalReview ? "Hide Review" : "Show Questions & Answers"}
  </button>
  {showFinalReview && (
  <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
    <h3 className="text-white font-black uppercase text-xs tracking-[0.2em] mb-4 text-center">Exam Review</h3>
    {questions.map((q, idx) => {
      const userAnswer = selectedAnswers[idx];
      const isCorrect = userAnswer == q.correctAnswer;

      return (
        <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-5 text-left">
          <div className="flex justify-between items-start gap-4 mb-3">
            <p className="text-white font-bold text-sm leading-relaxed">
              <span className="text-blue-400 mr-2">Q{idx + 1}.</span> {q.question}
            </p>
            {isCorrect ? (
              <span className="bg-green-500/20 text-green-400 text-[10px] font-black px-2 py-1 rounded">CORRECT</span>
            ) : (
              <span className="bg-red-500/20 text-red-400 text-[10px] font-black px-2 py-1 rounded">WRONG</span>
            )}
          </div>

          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const isUserChoice = userAnswer == i;
              const isCorrectAnswer = q.correctAnswer == i;

              let bgColor = "bg-white/5";
              let textColor = "text-gray-400";
              let border = "border-transparent";

              if (isCorrectAnswer) {
                bgColor = "bg-green-500/20";
                textColor = "text-green-400";
                border = "border-green-500/50";
              } else if (isUserChoice && !isCorrect) {
                bgColor = "bg-red-500/20";
                textColor = "text-red-400";
                border = "border-red-500/50";
              }

              return (
                <div key={i} className={`p-3 rounded-lg border text-xs font-bold flex justify-between items-center ${bgColor} ${textColor} ${border}`}>
                  <span>{opt}</span>
                  {isCorrectAnswer && <span className="text-[8px] uppercase font-black">Correct Answer</span>}
                  {isUserChoice && !isCorrect && <span className="text-[8px] uppercase font-black">Your Choice</span>}
                </div>
              );
            })}
          </div>
          
          {/* Correct Answer Note */}
          <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-500/20">
            <p className="text-[10px] text-blue-300 leading-relaxed italic">
              <span className="font-black not-italic mr-1">NOTE:</span>
              The correct answer is <span className="underline decoration-blue-500/50">{q.options[q.correctAnswer]}</span> because it is the standard State Board requirement.
            </p>
          </div>
        </div>
      );
    })}
  </div>
)}
        </div>

        {/* CLASS RANKINGS */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-xl animate-in slide-in-from-bottom-10 duration-1000">
          <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em]">Class Rankings</h3>
            <span className="text-[10px] font-black text-blue-400 uppercase bg-blue-400/10 px-2 py-1 rounded-md">
              {leaderboard.length} Future Professionals
            </span>
          </div>

          <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
          {leaderboard.map((res, i) => {
  const isMe = res.nickname === nickname;
  return (
    <div key={i} className={`flex justify-between items-center p-5 transition-colors ${isMe ? 'bg-blue-600/20' : 'hover:bg-white/5'}`}>
      <div className="flex items-center gap-4">
        {/* Rank Number */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-yellow-400 text-black' : 'bg-white/10 text-gray-400'}`}>
          {i + 1}
        </div>
        
        {/* Name and Correct Count Badge */}
        <div>
          <p className={`font-bold text-sm uppercase ${isMe ? 'text-white' : 'text-gray-300'}`}>
            {res.nickname}
          </p>
          {/* THE CORRECT ANSWERS BADGE */}
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[9px] font-black text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded uppercase">
               {res.correctCount || 0} Correct
            </span>
            <span className="text-[9px] font-bold text-gray-500 italic">
               out of {res.totalQuestions || questions.length}
            </span>
          </div>
        </div>
      </div>

      <div className={`text-xl font-black ${i < 3 ? 'text-white' : 'text-gray-500'}`}>
        {res.score}%
      </div>
    </div>
  );
})}
          </div>
        </div>
      </div>
    </div>
  );
}
  // 3. PLAYING VIEW (Exactly like your old live/page.js)
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
          <span className="font-black text-blue-900 uppercase text-xs">Question {currentIndex + 1} of {questions.length}</span>
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
        } else if (currentIndex === visibleQuestions.length - 1) {
    if (reviewMode) {
        setReviewMode(false);
        setCurrentIndex(0);
    } else {
       // setShowConfirmModal(true); // Open our custom UI instead
       finishExam();
    }
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

{showConfirmModal && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
    {/* Backdrop */}
    <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-sm"></div>
    
    {/* Modal Content */}
    <div className="relative bg-white w-full max-w-sm p-8 rounded-xl shadow-2xl text-center animate-in zoom-in duration-300">
      <div className="w-16 h-16 bg-blue-50 text-blue-900 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      
      <h3 className="text-xl font-black text-blue-900 uppercase mb-2">Ready to Finish?</h3>
      <p className="text-xs font-bold text-gray-400 uppercase mb-8 leading-relaxed">
        You have answered {Object.keys(selectedAnswers).length} of {questions.length} questions.
      </p>

      <div className="flex flex-col gap-3">
        <button 
          onClick={() => {
            setShowConfirmModal(false);
            finishExam();
          }}
          className="w-full py-4 bg-blue-900 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all"
        >
          Yes, Submit Exam
        </button>
        <button 
          onClick={() => setShowConfirmModal(false)}
          className="w-full py-4 bg-gray-100 text-gray-500 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all"
        >
          No, Keep Working
        </button>
      </div>
    </div>
  </div>
)}

      </div>
    </div>
  );
}