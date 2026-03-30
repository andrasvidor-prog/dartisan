'use client';

import { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export function AuthScreen({ onSignIn }: { onSignIn: () => void }) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="h-screen bg-[#0b0d11] text-slate-200 flex flex-col items-center justify-center overflow-hidden px-10">
      <header className="text-center mb-8">
        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-2 block">DARTISAN</span>
        <h1 className="text-4xl font-extrabold text-white tracking-tighter leading-none mb-2 italic">Welcome back</h1>
        <p className="text-slate-500 text-xs font-semibold">Ultra-precise scoring.</p>
      </header>

      <main className="w-full max-w-sm bg-[#12141a] rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl">
          <div className="grid grid-cols-2 gap-2 mb-6 bg-slate-950 p-1.5 rounded-2xl border border-slate-800/50">
            <button onClick={() => setActiveTab('login')} className={`py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'login' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-600'}`}>Login</button>
            <button onClick={() => setActiveTab('register')} className={`py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'register' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-600'}`}>Register</button>
          </div>

          <div className="flex flex-col gap-5 mb-8">
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">EMAIL</label>
              <input type="email" placeholder="you@dartisan.app" className="w-full h-12 bg-slate-950/50 rounded-xl px-5 text-sm text-white border border-slate-800 outline-none focus:border-emerald-500/50 transition-all shadow-inner" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">PASSWORD</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} placeholder="••••••••" className="w-full h-12 bg-slate-950/50 rounded-xl px-5 text-sm text-white border border-slate-800 outline-none focus:border-emerald-500/50 transition-all shadow-inner" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600">{showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}</button>
              </div>
            </div>
          </div>

          <button onClick={onSignIn} className="w-full h-16 rounded-2xl bg-emerald-500 text-slate-950 text-lg font-black uppercase tracking-widest shadow-[0_8px_20px_rgba(16,185,129,0.2)] active:scale-95 transition-all">Sign in</button>
          
          <div className="mt-8 flex items-center justify-between px-2 opacity-30">
             <div className="h-px bg-slate-800 flex-1"></div>
             <span className="text-[9px] font-bold px-3 uppercase">OR</span>
             <div className="h-px bg-slate-800 flex-1"></div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <button className="h-14 rounded-2xl border border-slate-800 bg-slate-900/30 flex items-center justify-center active:scale-95 transition-all"><img src="/icons/google.svg" className="h-5 w-5" alt="G" /></button>
            <button className="h-14 rounded-2xl border border-slate-800 bg-slate-900/30 flex items-center justify-center active:scale-95 transition-all"><img src="/icons/apple.svg" className="h-5 w-5" alt="A" /></button>
          </div>
      </main>
    </div>
  );
}