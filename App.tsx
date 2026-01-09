
import React, { useState, useEffect } from 'react';
import LiveAudioInterface from './components/LiveAudioInterface';

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        // Fallback for environments where the check isn't available
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      // Assume success as per instructions to avoid race conditions
      setHasKey(true);
    }
  };

  if (hasKey === null) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col items-center bg-[#0a0f1d] text-white relative overflow-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-orange-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cyan-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]"></div>
      </div>

      {!hasKey ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg z-10">
          <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center mb-8 border border-orange-500/20 shadow-[0_0_50px_rgba(249,115,22,0.1)]">
            <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-4xl font-black mb-4">Connect Meenakshi</h1>
          <p className="text-slate-400 mb-8 leading-relaxed">
            To enable Meenakshi's full conversational intelligence and real-time voice, please connect your Gemini API key from a paid project.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all shadow-[0_0_30px_rgba(249,115,22,0.3)] hover:scale-[1.02] active:scale-[0.98]"
          >
            SELECT API KEY
          </button>
          <p className="mt-6 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            Required for deployment. Check <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-orange-500 underline">billing docs</a>.
          </p>
        </div>
      ) : (
        <>
          {/* Header - Very compact for single page */}
          <header className="w-full max-w-5xl px-6 pt-6 pb-2 flex flex-row items-center justify-center gap-4 md:gap-6 z-10 shrink-0">
            <div className="relative group flex-shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-cyan-500 rounded-full blur opacity-25 group-hover:opacity-50 transition-opacity"></div>
              <div className="relative w-12 h-12 md:w-16 md:h-16 bg-slate-900 rounded-full flex items-center justify-center overflow-hidden border border-white/10 shadow-2xl">
                <svg className="w-8 h-8 md:w-12 md:h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col text-left">
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter leading-none mb-0.5">Meenakshi</h1>
              <p className="text-[7px] md:text-[9px] uppercase tracking-[0.3em] text-cyan-400 font-bold opacity-80 pl-0.5">your friendly neighbourhood AI host</p>
            </div>
          </header>

          {/* Main Content - Centered & Responsive */}
          <main className="w-full max-w-5xl px-4 flex-1 flex flex-col items-center justify-center z-10 overflow-hidden min-h-0">
            <div className="w-full max-w-xl transform transition-all duration-700 flex flex-col items-center justify-center">
              <LiveAudioInterface />
            </div>

            {/* Footer Section - Simplified and Bold */}
            <div className="mt-6 pb-6 flex flex-col items-center gap-3 shrink-0">
              <div className="text-center group transition-transform duration-500 hover:scale-105">
                <p className="text-[8px] uppercase tracking-[0.6em] text-slate-400 font-bold mb-2 opacity-60">Powered by</p>
                <img
                  src="/logo.png"
                  alt="Straw Labs Logo"
                  className="h-8 md:h-12 w-auto opacity-80 group-hover:opacity-100 transition-all duration-500 filter brightness-110"
                />
              </div>
            </div>
          </main>
        </>
      )}
    </div>
  );
};

export default App;
