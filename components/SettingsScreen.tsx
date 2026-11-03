'use client';

import { useState, useEffect, useRef } from 'react';
import {
    ArrowLeftIcon, Cog6ToothIcon, SpeakerWaveIcon, SpeakerXMarkIcon,
    SunIcon, MoonIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, TrashIcon,
    DevicePhoneMobileIcon, BoltIcon, CheckCircleIcon, LanguageIcon,
    AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const LABELS = {
    hu: {
        title: 'Beállítások',
        tabs: ['Általános', 'Játék', 'Hangok', 'Adatok'],
        /* appearance */
        appearTitle: 'Megjelenés & Nyelv',
        lang: 'Alkalmazás nyelve',
        theme: 'Téma',
        themes: { dark:'Sötét', amoled:'AMOLED', contrast:'Kontraszt', light:'Világos ✦' },
        themeNote: '✦ Hamarosan elérhető',
        /* gameplay */
        gameplayTitle: 'Játék preferenciák',
        checkout: 'Kiszálló szabály',
        checkoutSingle: 'Bármilyen (Single-out)',
        checkoutDouble: 'Csak dupla (Double-out)',
        checkoutDesc: 'A standard versenyszabály a Double-out.',
        inputMode: 'Alapértelmezett beviteli mód',
        inputFast: 'Gyors (összpontszám)',
        inputPro: 'Pro (nyilankénti)',
        inputBoard: 'Tábla (kattintás)',
        strategy: 'Kiszálló stratégia',
        strategySafe: '🛡️ Biztonságos – kevesebb kockázat',
        strategyPro: '🔥 Pro – legjobb esélyű kiszálló',
        favDouble: 'Kedvenc kiszálló dupla',
        favDoubleDesc: 'Az AI ezt ajánlja elsőként ha elérhető.',
        fastBtns: 'Gyors gombok (Fast mód)',
        fastBtnsDesc: '3 szám, vesszővel elválasztva. Pl: 60, 100, 140',
        haptic: 'Rezgés (Haptic feedback)',
        hapticDesc: 'Visszajelzés dobásonként.',
        saveBtn: 'Beállítások mentése',
        saved: '✓ Mentve!',
        /* sounds */
        soundTitle: 'Hangbeállítások',
        soundMaster: 'Alap hangok',
        soundMasterDesc: 'Gombkattintások, dobás visszajelzők',
        sound180: '180! Bekiabálás',
        sound180Desc: 'Bemondó a maximális dobásnál',
        soundWin: 'Győzelem hangeffekt',
        soundWinDesc: 'Hang a kiszálló megdobásakor',
        /* data */
        dataTitle: 'Adatmentés & Visszaállítás',
        exportTitle: 'Helyi adatok mentése (Export)',
        exportDesc: 'A böngészőben tárolt adatok letöltése JSON fájlba. A felhőben mentett profil nincs benne.',
        exportBtn: 'Fájl letöltése',
        importTitle: 'Adatok visszatöltése (Import)',
        importDesc: 'Korábbi backup visszaállítása.',
        importBtn: 'Fájl kiválasztása',
        dangerTitle: 'Veszélyes zóna',
        dangerDesc: 'Csak ennek a böngészőnek a Dartisan adatai törlődnek. A Firebase-profil megmarad.',
        dangerBtn: 'Helyi adatok törlése',
        confirmReset: 'Biztosan törlöd ennek a böngészőnek a Dartisan adatait? A Firebase-profil megmarad.',
        resetDone: 'A helyi adatok törölve. A felhőben tárolt profil megmaradt.',
        successImport: 'Sikeres visszaállítás! Az oldal most frissül.',
        errorImport: 'Hiba: Érvénytelen Dartisan backup fájl.',
    },
    en: {
        title: 'Settings',
        tabs: ['General', 'Gameplay', 'Sounds', 'Data'],
        appearTitle: 'Appearance & Language',
        lang: 'App language',
        theme: 'Theme',
        themes: { dark:'Dark', amoled:'AMOLED', contrast:'Contrast', light:'Light ✦' },
        themeNote: '✦ Coming soon',
        gameplayTitle: 'Gameplay preferences',
        checkout: 'Checkout rule',
        checkoutSingle: 'Any (Single-out)',
        checkoutDouble: 'Double required (Double-out)',
        checkoutDesc: 'Standard competition rule is Double-out.',
        inputMode: 'Default input mode',
        inputFast: 'Fast (total score)',
        inputPro: 'Pro (per dart)',
        inputBoard: 'Board (tap on board)',
        strategy: 'Checkout strategy',
        strategySafe: '🛡️ Safe – lower risk route',
        strategyPro: '🔥 Pro – highest probability route',
        favDouble: 'Favourite checkout double',
        favDoubleDesc: 'AI will suggest this double first when possible.',
        fastBtns: 'Quick buttons (Fast mode)',
        fastBtnsDesc: '3 values, comma separated. E.g: 60, 100, 140',
        haptic: 'Haptic feedback',
        hapticDesc: 'Vibration on each throw.',
        saveBtn: 'Save settings',
        saved: '✓ Saved!',
        soundTitle: 'Sound settings',
        soundMaster: 'Master sounds',
        soundMasterDesc: 'Button clicks, throw feedback',
        sound180: '180! Caller',
        sound180Desc: 'Voice caller for maximum score',
        soundWin: 'Win sound effect',
        soundWinDesc: 'Sound on checkout',
        dataTitle: 'Backup & Restore',
        exportTitle: 'Export local data',
        exportDesc: 'Download data stored in this browser. Cloud profile data is not included.',
        exportBtn: 'Download file',
        importTitle: 'Import data',
        importDesc: 'Restore a previous backup.',
        importBtn: 'Choose file',
        dangerTitle: 'Danger zone',
        dangerDesc: 'Only Dartisan data in this browser will be deleted. Your Firebase profile remains.',
        dangerBtn: 'Delete local data',
        confirmReset: 'Delete Dartisan data from this browser? Your Firebase profile remains.',
        resetDone: 'Local data deleted. Your cloud profile remains.',
        successImport: 'Restore successful! Reloading...',
        errorImport: 'Error: Invalid Dartisan backup file.',
    },
};

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full p-1 transition-all duration-300 shrink-0 ${value ? 'bg-emerald-500' : 'bg-slate-700'}`}>
        <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${value ? 'translate-x-6' : 'translate-x-0'}`}/>
    </button>
);

const Row = ({ icon, label, desc, children }: { icon?: React.ReactNode; label: string; desc?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-800/60 last:border-0">
        <div className="flex items-center gap-3 min-w-0">
            {icon && <div className="shrink-0 text-slate-500">{icon}</div>}
            <div className="min-w-0">
                <p className="text-sm font-bold text-white leading-snug">{label}</p>
                {desc && <p className="text-[10px] text-slate-500 font-bold mt-0.5 leading-snug">{desc}</p>}
            </div>
        </div>
        <div className="shrink-0">{children}</div>
    </div>
);

interface SettingsScreenProps { onBack: () => void; }

export function SettingsScreen({ onBack }: SettingsScreenProps) {
    const [activeTab, setActiveTab] = useState(0);
    const [saved, setSaved]         = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── General ─────────────────────────────────────────────────────────────
    const [lang,    setLang]    = useState<'hu'|'en'>('hu');
    const [theme,   setTheme]   = useState('dark');

    // ── Gameplay ─────────────────────────────────────────────────────────────
    const [checkout,   setCheckout]   = useState<'single'|'double'>('double');
    const [inputMode,  setInputMode]  = useState<'fast'|'detailed'|'board'>('fast');
    const [strategy,   setStrategy]   = useState<'safe'|'pro'>('safe');
    const [favDouble,  setFavDouble]  = useState('D16');
    const [fastBtns,   setFastBtns]   = useState('60, 100, 140');
    const [haptic,     setHaptic]     = useState(true);

    // ── Sounds ───────────────────────────────────────────────────────────────
    const [soundMaster, setSoundMaster] = useState(true);
    const [sound180,    setSound180]    = useState(true);
    const [soundWin,    setSoundWin]    = useState(true);

    const txt = LABELS[lang];

    // Load all settings on mount
    useEffect(() => {
        if (typeof window === 'undefined') return;
        setLang((localStorage.getItem('dartisan_lang') as 'hu'|'en') || 'hu');
        setTheme(localStorage.getItem('dartisan_theme') || 'dark');
        setCheckout((localStorage.getItem('dartisan_checkout') as any) || 'double');
        setInputMode((localStorage.getItem('dartisan_pref_input') as any) || 'fast');
        setStrategy((localStorage.getItem('dartisan_strategy') as any) || 'safe');
        setHaptic(localStorage.getItem('dartisan_haptic') !== 'false');
        setSoundMaster(localStorage.getItem('dartisan_sound_master') !== 'false');
        setSound180(localStorage.getItem('dartisan_sound_180') !== 'false');
        setSoundWin(localStorage.getItem('dartisan_sound_legwin') !== 'false');

        const fetchFirestore = async () => {
            const user = auth.currentUser;
            if (!user) return;
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (!snap.exists()) return;
            const s = snap.data().settings || {};
            if (s.favDouble)  setFavDouble(s.favDouble);
            if (s.fastBtns)   setFastBtns(s.fastBtns.join(', '));
            if (s.checkout)   setCheckout(s.checkout);
            if (s.inputMode)  setInputMode(s.inputMode);
            if (s.strategy)   setStrategy(s.strategy);
        };
        fetchFirestore();
    }, []);

    // Apply theme immediately when changed
    const applyTheme = (t: string) => {
        setTheme(t);
        localStorage.setItem('dartisan_theme', t);
        document.body.classList.remove('theme-dark','theme-amoled','theme-contrast','theme-dim');
        if (t !== 'dark') document.body.classList.add(`theme-${t}`);
    };

    const applyLang = (l: 'hu'|'en') => {
        setLang(l);
        localStorage.setItem('dartisan_lang', l);
    };

    const saveAll = async () => {
        if (typeof window === 'undefined') return;
        // localStorage
        localStorage.setItem('dartisan_checkout',    checkout);
        localStorage.setItem('dartisan_pref_input',  inputMode);
        localStorage.setItem('dartisan_strategy',    strategy);
        localStorage.setItem('dartisan_haptic',      String(haptic));
        localStorage.setItem('dartisan_sound_master',String(soundMaster));
        localStorage.setItem('dartisan_sound_180',   String(sound180));
        localStorage.setItem('dartisan_sound_legwin',String(soundWin));
        localStorage.setItem('dartisan_fav_double',  favDouble);
        const fastArr = fastBtns.split(',').map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));

        // Firestore
        const user = auth.currentUser;
        if (user) {
            await setDoc(doc(db,'users',user.uid), {
                settings: { fastBtns: fastArr, favDouble, checkout, inputMode, strategy }
            }, { merge: true });
        }
        setSaved(true);
        setTimeout(()=>setSaved(false), 2000);
    };

    // ── Export / Import / Reset ───────────────────────────────────────────────
    const handleExport = () => {
        const data: Record<string,string|null> = {};
        for (let i=0;i<localStorage.length;i++){
            const k=localStorage.key(i);
            if(k?.startsWith('dartisan_')) data[k]=localStorage.getItem(k);
        }
        const a=document.createElement('a');
        a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
        a.download=`dartisan_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file=e.target.files?.[0]; if(!file) return;
        const reader=new FileReader();
        reader.onload=ev=>{
            try {
                const d=JSON.parse(ev.target?.result as string);
                Object.keys(d).forEach(k=>{if(d[k]!==null) localStorage.setItem(k,d[k]);});
                alert(txt.successImport); window.location.reload();
            } catch { alert(txt.errorImport); }
        };
        reader.readAsText(file);
    };

    const handleReset = () => {
        if (!window.confirm(txt.confirmReset)) return;
        const keys=[];
        for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('dartisan_'))keys.push(k);}
        keys.forEach(k=>localStorage.removeItem(k));
        alert(txt.resetDone); window.location.reload();
    };

    const TABS = txt.tabs;
    const THEME_OPTS = [
        { key:'dark',     icon:<MoonIcon className="h-4 w-4"/>,  label:txt.themes.dark     },
        { key:'amoled',   icon:<div className="w-4 h-4 rounded-full bg-black border border-slate-600"/>, label:txt.themes.amoled },
        { key:'contrast', icon:<SunIcon className="h-4 w-4"/>,   label:txt.themes.contrast  },
        { key:'light',    icon:<SunIcon className="h-4 w-4"/>,   label:txt.themes.light,  disabled:true },
    ];
    const DOUBLES = ['D20','D16','D18','D10','D8','D12','D6','D4','D2','D1','BULL'];

    return (
        <div className="fixed inset-0 z-[200] bg-[#0b0d11] text-slate-200 flex flex-col h-[100dvh]">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 bg-[#12141a] border-b border-slate-800 shrink-0">
                <button onClick={onBack} className="p-2.5 bg-slate-800 rounded-full hover:bg-slate-700 active:scale-95 transition-all">
                    <ArrowLeftIcon className="h-5 w-5"/>
                </button>
                <div className="flex items-center gap-2">
                    <Cog6ToothIcon className="h-6 w-6 text-amber-400"/>
                    <h1 className="text-lg font-black text-white uppercase italic tracking-widest">{txt.title}</h1>
                </div>
                <div className="w-10"/>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1.5 px-4 py-3 bg-[#12141a] border-b border-slate-800 shrink-0">
                {TABS.map((tab,i)=>(
                    <button key={i} onClick={()=>setActiveTab(i)}
                        className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${activeTab===i ? 'bg-amber-500 text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.35)]' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-2xl w-full mx-auto flex flex-col gap-5 pb-10">

                {/* ── TAB 0: ÁLTALÁNOS / GENERAL ─────────────────────────────── */}
                {activeTab === 0 && (
                    <>
                    <div className="bg-[#12141a] rounded-3xl border border-slate-800 p-5">
                        <h2 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                            <LanguageIcon className="h-4 w-4"/> {txt.appearTitle}
                        </h2>

                        {/* Language */}
                        <Row label={txt.lang}>
                            <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-700 gap-1">
                                {(['hu','en'] as const).map(l=>(
                                    <button key={l} onClick={()=>applyLang(l)}
                                        className={`px-4 py-1.5 rounded-lg font-black text-xs transition-all ${lang===l?'bg-slate-600 text-white':'text-slate-500 hover:text-slate-300'}`}>
                                        {l.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </Row>

                        {/* Theme */}
                        <div className="pt-3">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{txt.theme}</p>
                            <div className="grid grid-cols-2 gap-2">
                                {THEME_OPTS.map(opt=>(
                                    <button key={opt.key}
                                        onClick={()=>!opt.disabled && applyTheme(opt.key)}
                                        disabled={opt.disabled}
                                        className={`flex items-center gap-2 px-4 py-3 rounded-xl font-black text-xs border transition-all
                                            ${opt.disabled ? 'opacity-40 cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600'
                                            : theme===opt.key ? 'bg-amber-500 text-slate-900 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-white'}`}>
                                        {opt.icon}
                                        <span>{opt.label}</span>
                                        {theme===opt.key && <CheckCircleIcon className="h-3.5 w-3.5 ml-auto"/>}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[9px] text-slate-700 font-bold mt-2">{txt.themeNote}</p>
                        </div>
                    </div>

                    {/* Haptic */}
                    <div className="bg-[#12141a] rounded-3xl border border-slate-800 p-5">
                        <h2 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                            <DevicePhoneMobileIcon className="h-4 w-4"/> Eszköz
                        </h2>
                        <Row label={txt.haptic} desc={txt.hapticDesc} icon={<DevicePhoneMobileIcon className="h-5 w-5"/>}>
                            <Toggle value={haptic} onChange={v=>{setHaptic(v);localStorage.setItem('dartisan_haptic',String(v));}}/>
                        </Row>
                    </div>
                    </>
                )}

                {/* ── TAB 1: JÁTÉK / GAMEPLAY ────────────────────────────────── */}
                {activeTab === 1 && (
                    <>
                    <div className="bg-[#12141a] rounded-3xl border border-slate-800 p-5">
                        <h2 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                            <AdjustmentsHorizontalIcon className="h-4 w-4"/> {txt.gameplayTitle}
                        </h2>

                        {/* Checkout mode */}
                        <div className="mb-5">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{txt.checkout}</p>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    {key:'single',label:txt.checkoutSingle},
                                    {key:'double',label:txt.checkoutDouble},
                                ] as const).map(c=>(
                                    <button key={c.key} onClick={()=>setCheckout(c.key)}
                                        className={`py-3 px-2 rounded-xl font-black text-[10px] border transition-all text-center ${checkout===c.key?'bg-emerald-500 text-slate-900 border-emerald-400':'bg-slate-900 text-slate-500 border-slate-800'}`}>
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[9px] text-slate-600 mt-1.5 font-bold">{txt.checkoutDesc}</p>
                        </div>

                        {/* Input mode */}
                        <div className="mb-5">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{txt.inputMode}</p>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    {key:'fast',     label:txt.inputFast,  sub:'Σ'},
                                    {key:'detailed', label:txt.inputPro,   sub:'🎯'},
                                    {key:'board',    label:txt.inputBoard, sub:'◎'},
                                ] as const).map(m=>(
                                    <button key={m.key} onClick={()=>setInputMode(m.key)}
                                        className={`py-3 rounded-xl font-black text-[10px] border transition-all flex flex-col items-center gap-1 ${inputMode===m.key?'bg-cyan-500 text-slate-900 border-cyan-400':'bg-slate-900 text-slate-500 border-slate-800'}`}>
                                        <span className="text-lg leading-none">{m.sub}</span>
                                        <span>{m.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Checkout strategy */}
                        <div className="mb-5">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{txt.strategy}</p>
                            <div className="flex flex-col gap-2">
                                {([
                                    {key:'safe',label:txt.strategySafe},
                                    {key:'pro', label:txt.strategyPro},
                                ] as const).map(s=>(
                                    <button key={s.key} onClick={()=>setStrategy(s.key)}
                                        className={`py-3 px-4 rounded-xl font-bold text-xs border transition-all text-left ${strategy===s.key?'bg-[#b655ff]/20 text-[#b655ff] border-[#b655ff]/40':'bg-slate-900 text-slate-500 border-slate-800'}`}>
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Favourite double */}
                        <div className="mb-5">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{txt.favDouble}</p>
                            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                                {DOUBLES.map(d=>(
                                    <button key={d} onClick={()=>setFavDouble(d)}
                                        className={`h-9 rounded-lg font-black text-xs border transition-all ${favDouble===d?'bg-amber-500 text-slate-900 border-amber-400':'bg-slate-900 text-slate-500 border-slate-800'}`}>
                                        {d}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[9px] text-slate-600 mt-1.5 font-bold">{txt.favDoubleDesc}</p>
                        </div>

                        {/* Fast buttons */}
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{txt.fastBtns}</p>
                            <input type="text" value={fastBtns} onChange={e=>setFastBtns(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono font-bold focus:border-amber-500 outline-none text-sm"/>
                            <p className="text-[9px] text-slate-600 mt-1.5 font-bold">{txt.fastBtnsDesc}</p>
                        </div>
                    </div>

                    {/* Save button */}
                    <button onClick={saveAll}
                        className={`w-full h-14 rounded-2xl font-black uppercase tracking-widest text-sm transition-all ${saved?'bg-emerald-500 text-slate-900':'bg-amber-500 text-slate-900 hover:bg-amber-400 active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.25)]'}`}>
                        {saved ? txt.saved : txt.saveBtn}
                    </button>
                    </>
                )}

                {/* ── TAB 2: HANGOK / SOUNDS ─────────────────────────────────── */}
                {activeTab === 2 && (
                    <div className="bg-[#12141a] rounded-3xl border border-slate-800 p-5">
                        <h2 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <SpeakerWaveIcon className="h-4 w-4"/> {txt.soundTitle}
                        </h2>
                        <Row label={txt.soundMaster} desc={txt.soundMasterDesc}
                            icon={soundMaster?<SpeakerWaveIcon className="h-5 w-5 text-emerald-400"/>:<SpeakerXMarkIcon className="h-5 w-5 text-rose-500"/>}>
                            <Toggle value={soundMaster} onChange={v=>{setSoundMaster(v);localStorage.setItem('dartisan_sound_master',String(v));}}/>
                        </Row>
                        <Row label={txt.sound180} desc={txt.sound180Desc} icon={<BoltIcon className="h-5 w-5"/>}>
                            <Toggle value={sound180} onChange={v=>{setSound180(v);localStorage.setItem('dartisan_sound_180',String(v));}}/>
                        </Row>
                        <Row label={txt.soundWin} desc={txt.soundWinDesc} icon={<CheckCircleIcon className="h-5 w-5"/>}>
                            <Toggle value={soundWin} onChange={v=>{setSoundWin(v);localStorage.setItem('dartisan_sound_legwin',String(v));}}/>
                        </Row>
                        <div className="mt-4 pt-4 border-t border-slate-800">
                            <p className="text-[10px] font-bold text-slate-600 text-center">
                                💡 A hangeffektek a böngésző hangerő-beállításától függnek
                            </p>
                        </div>
                    </div>
                )}

                {/* ── TAB 3: ADATOK / DATA ───────────────────────────────────── */}
                {activeTab === 3 && (
                    <>
                    <div className="bg-[#12141a] rounded-3xl border border-slate-800 p-5">
                        <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-5">
                            <ArrowDownTrayIcon className="h-4 w-4 text-emerald-400"/> {txt.exportTitle}
                        </h2>
                        <p className="text-xs text-slate-400 font-bold mb-4 leading-relaxed">{txt.exportDesc}</p>
                        <button onClick={handleExport}
                            className="w-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 py-4 rounded-xl font-black uppercase text-sm flex items-center justify-center gap-2 transition-all active:scale-95">
                            <ArrowDownTrayIcon className="h-5 w-5"/> {txt.exportBtn}
                        </button>
                    </div>

                    <div className="bg-[#12141a] rounded-3xl border border-slate-800 p-5">
                        <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-5">
                            <ArrowUpTrayIcon className="h-4 w-4 text-cyan-400"/> {txt.importTitle}
                        </h2>
                        <p className="text-xs text-slate-400 font-bold mb-4 leading-relaxed">{txt.importDesc}</p>
                        <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} className="hidden"/>
                        <button onClick={()=>fileInputRef.current?.click()}
                            className="w-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 py-4 rounded-xl font-black uppercase text-sm flex items-center justify-center gap-2 transition-all active:scale-95">
                            <ArrowUpTrayIcon className="h-5 w-5"/> {txt.importBtn}
                        </button>
                    </div>

                    <div className="bg-rose-500/5 rounded-3xl border border-rose-500/20 p-5">
                        <h2 className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <TrashIcon className="h-4 w-4"/> {txt.dangerTitle}
                        </h2>
                        <p className="text-xs text-rose-400/60 font-bold mb-4 leading-relaxed">{txt.dangerDesc}</p>
                        <button onClick={handleReset}
                            className="w-full bg-rose-500 text-white hover:bg-rose-600 py-4 rounded-xl font-black uppercase text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_0_20px_rgba(244,63,94,0.25)]">
                            <TrashIcon className="h-5 w-5"/> {txt.dangerBtn}
                        </button>
                    </div>
                    </>
                )}
            </div>
        </div>
    );
}
