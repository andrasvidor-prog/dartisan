'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeftIcon, Cog6ToothIcon, SpeakerWaveIcon, SpeakerXMarkIcon, SunIcon, MoonIcon, EyeIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, TrashIcon } from '@heroicons/react/24/outline';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface SettingsScreenProps {
    onBack: () => void;
}

const t = {
    hu: {
        title: "Beállítások", tabGeneral: "Alapvető", tabData: "Adatmentés",
        appearance: "Megjelenés & Nyelv", langLabel: "Nyelv (Language)", langDesc: "Később további nyelvekkel bővül",
        themeLabel: "Téma", themeDesc: "Válaszd ki az alkalmazás kinézetét",
        themeDark: "Sötét", themeLight: "Világos", themeContrast: "Kontraszt",
        soundTitle: "Hangbeállítások", soundMaster: "Alap Hangok", soundMasterDesc: "Menü kattintások, dobás hangok",
        sound180: "\"180\" Bekiabálás", sound180Desc: "Bemondó a maximum dobásnál",
        soundWin: "Leg / Szett Győzelem", soundWinDesc: "Hangeffekt a kiszálló megdobásakor",
        exportTitle: "Profil Mentése (Export)", exportDesc: "Töltsd le a statisztikáidat egy fájlba.", exportBtn: "Fájl Letöltése",
        importTitle: "Adatok Visszatöltése (Import)", importDesc: "Van egy korábbi mentésed? Töltsd fel ide!", importBtn: "Fájl Kiválasztása",
        dangerTitle: "Veszélyes Zóna", dangerDesc: "Ha újra akarod kezdeni a játékot, itt törölheted a profilodat.", dangerBtn: "Minden Adat Törlése (Reset)",
        successImport: "Sikeres visszaállítás! Az alkalmazás most frissül.",
        errorImport: "Hiba történt a fájl beolvasásakor. Győződj meg róla, hogy érvényes Dartisan mentést választottál!",
        confirmReset: "Biztosan törölni akarsz mindent? Ez letörli a statisztikáidat. A művelet nem vonható vissza!",
        resetDone: "Minden adat törölve lett. Tiszta lappal indulsz!"
    },
    en: {
        title: "Settings", tabGeneral: "General", tabData: "Data & Backup",
        appearance: "Appearance & Language", langLabel: "Language", langDesc: "More languages coming later",
        themeLabel: "Theme", themeDesc: "Choose the app's appearance",
        themeDark: "Dark", themeLight: "Light", themeContrast: "Contrast",
        soundTitle: "Sound Settings", soundMaster: "Master Sounds", soundMasterDesc: "Menu clicks, throw sounds",
        sound180: "\"180\" Caller", sound180Desc: "Voice caller for maximum score",
        soundWin: "Leg / Set Win", soundWinDesc: "Sound effect on checkout",
        exportTitle: "Save Profile (Export)", exportDesc: "Download your stats into a file.", exportBtn: "Download File",
        importTitle: "Restore Data (Import)", importDesc: "Have a backup? Upload it here!", importBtn: "Choose File",
        dangerTitle: "Danger Zone", dangerDesc: "Erase your entire profile here.", dangerBtn: "Delete All Data (Reset)",
        successImport: "Restore successful! The app will now refresh.",
        errorImport: "Error reading file. Make sure you selected a valid Dartisan backup!",
        confirmReset: "Are you sure you want to delete everything? This action cannot be undone!",
        resetDone: "All data has been deleted. You are starting with a clean slate!"
    }
};

export function SettingsScreen({ onBack }: SettingsScreenProps) {
    const [activeTab, setActiveTab] = useState<'general' | 'data'>('general');
    const [lang, setLang] = useState<'hu' | 'en'>('hu');
    const [theme, setTheme] = useState('dark');
    const [masterSound, setMasterSound] = useState(true);
    const [sound180, setSound180] = useState(true);
    const [soundLegWin, setSoundLegWin] = useState(true);
    
    // --- JÁTÉK PREFERENCIÁK ---
    const [favDouble, setFavDouble] = useState("D16");
    const [fastBtnsInput, setFastBtnsInput] = useState("60, 100, 140");

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setLang((localStorage.getItem('dartisan_lang') as 'hu' | 'en') || 'hu');
            setTheme(localStorage.getItem('dartisan_theme') || 'dark');
            setMasterSound(localStorage.getItem('dartisan_sound_master') !== 'false');
            setSound180(localStorage.getItem('dartisan_sound_180') !== 'false');
            setSoundLegWin(localStorage.getItem('dartisan_sound_legwin') !== 'false');
            
            const storedFav = localStorage.getItem('dartisan_fav_double');
            if (storedFav) setFavDouble(storedFav);
        }
        
        const fetchSettings = async () => {
            const user = auth.currentUser;
            if (user) {
                const docSnap = await getDoc(doc(db, 'users', user.uid));
                if (docSnap.exists() && docSnap.data().settings) {
                    const s = docSnap.data().settings;
                    if (s.favDouble) setFavDouble(s.favDouble);
                    if (s.fastBtns) setFastBtnsInput(s.fastBtns.join(', '));
                }
            }
        };
        fetchSettings();
    }, []);

    const txt = t[lang]; 
    const triggerHaptic = () => { if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(20); };

    const toggleSetting = (key: string, currentValue: boolean, setter: (val: boolean) => void) => {
        triggerHaptic();
        const newValue = !currentValue;
        setter(newValue);
        localStorage.setItem(key, String(newValue));
    };

    const changeLanguage = (newLang: 'hu' | 'en') => { triggerHaptic(); setLang(newLang); localStorage.setItem('dartisan_lang', newLang); };
    const changeTheme = (newTheme: string) => { triggerHaptic(); setTheme(newTheme); localStorage.setItem('dartisan_theme', newTheme); };

    const saveSettings = async () => {
        triggerHaptic();
        localStorage.setItem('dartisan_fav_double', favDouble);
        const fastBtnsArr = fastBtnsInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        
        const user = auth.currentUser;
        if (user) {
            await setDoc(doc(db, 'users', user.uid), { 
                settings: { fastBtns: fastBtnsArr, favDouble: favDouble } 
            }, { merge: true });
        }
        alert(lang === 'hu' ? "Beállítások sikeresen mentve!" : "Settings saved successfully!");
    };

    // --- ADATMENTÉS LOGIKA ---
    const handleExportData = () => {
        triggerHaptic();
        const data: Record<string, string | null> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('dartisan_')) {
                data[key] = localStorage.getItem(key);
            }
        }
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `dartisan_backup_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                Object.keys(data).forEach(key => {
                    if (data[key] !== null) localStorage.setItem(key, data[key]);
                });
                alert(txt.successImport);
                window.location.reload(); 
            } catch (err) {
                alert(txt.errorImport);
            }
        };
        reader.readAsText(file);
    };

    const handleResetData = () => {
        triggerHaptic();
        const confirmReset = window.confirm(txt.confirmReset);
        if (confirmReset) {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('dartisan_')) keysToRemove.push(key);
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            alert(txt.resetDone);
            window.location.reload();
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-[#0b0d11] text-slate-200 flex flex-col h-[100dvh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between p-4 sm:p-8 shrink-0 bg-[#12141a] border-b border-slate-800 shadow-xl sticky top-0 z-20">
                <button onClick={onBack} className="p-3 bg-slate-800 rounded-full hover:bg-slate-700 active:scale-95 transition-all"><ArrowLeftIcon className="h-6 w-6 text-white" /></button>
                <div className="flex flex-col items-center"><Cog6ToothIcon className="h-8 w-8 text-amber-500 mb-1 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" /><h1 className="text-xl font-black text-white uppercase italic tracking-widest leading-none">{txt.title}</h1></div>
                <div className="w-12"></div>
            </div>

            <div className="flex p-4 gap-2 bg-[#12141a] border-b border-slate-800">
                <button onClick={() => {triggerHaptic(); setActiveTab('general')}} className={`flex-1 py-3 rounded-xl font-black uppercase text-xs transition-all ${activeTab === 'general' ? 'bg-amber-500 text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-slate-800 text-slate-400'}`}>{txt.tabGeneral}</button>
                <button onClick={() => {triggerHaptic(); setActiveTab('data')}} className={`flex-1 py-3 rounded-xl font-black uppercase text-xs transition-all ${activeTab === 'data' ? 'bg-amber-500 text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-slate-800 text-slate-400'}`}>{txt.tabData}</button>
            </div>

            <div className="flex-1 p-4 sm:p-8 max-w-2xl w-full mx-auto flex flex-col gap-6">
                {activeTab === 'general' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-6">
                        
                        <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl">
                            <h2 className="text-sm font-black text-amber-500 uppercase tracking-widest flex items-center gap-2 mb-6"><SunIcon className="h-5 w-5" /> Játékos Preferenciák</h2>
                            
                            <div className="mb-6">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Kedvenc Kiszálló Dupla</label>
                                <div className="relative">
                                    <select value={favDouble} onChange={(e) => setFavDouble(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white font-mono font-bold focus:border-amber-500 outline-none appearance-none">
                                        <option value="D20">D20 (Top)</option><option value="D16">D16</option><option value="D18">D18</option>
                                        <option value="D10">D10</option><option value="D8">D8</option><option value="D12">D12</option>
                                    </select>
                                </div>
                                <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-wider">Az Okos Kiszálló Segéd meccs közben megpróbál majd erre a duplára kihegyezett utakat javasolni, ha lehetséges.</p>
                            </div>

                            <div className="mb-6 border-t border-slate-800 pt-6">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Fast Mód Gombok (Vesszővel)</label>
                                <input type="text" value={fastBtnsInput} onChange={(e) => setFastBtnsInput(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white font-mono font-bold focus:border-amber-500 outline-none" placeholder="Pl: 60, 100, 140" />
                                <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-wider">A gyors beviteli képernyő tetején lévő 3 dedikált gomb értéke.</p>
                            </div>

                            <button onClick={saveSettings} className="w-full h-14 bg-amber-500 text-slate-900 rounded-xl font-black uppercase tracking-widest hover:bg-amber-400 active:scale-95 shadow-[0_10px_30px_rgba(245,158,11,0.2)] transition-all">Beállítások Mentése</button>
                        </div>

                        <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl">
                            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 mb-6"><SunIcon className="h-5 w-5 text-amber-400" /> {txt.appearance}</h2>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex flex-col"><span className="font-bold text-white uppercase text-sm">{txt.langLabel}</span></div>
                                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                                    <button onClick={() => changeLanguage('hu')} className={`px-4 py-2 rounded-md font-black text-xs transition-colors ${lang === 'hu' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>HU</button>
                                    <button onClick={() => changeLanguage('en')} className={`px-4 py-2 rounded-md font-black text-xs transition-colors ${lang === 'en' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>EN</button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl">
                            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 mb-6"><SpeakerWaveIcon className="h-5 w-5 text-emerald-400" /> {txt.soundTitle}</h2>
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between cursor-pointer group bg-slate-900/50 p-3 rounded-xl border border-slate-800" onClick={() => toggleSetting('dartisan_sound_master', masterSound, setMasterSound)}>
                                    <div className="flex items-center gap-3">{masterSound ? <SpeakerWaveIcon className="h-6 w-6 text-emerald-400" /> : <SpeakerXMarkIcon className="h-6 w-6 text-rose-500" />}<span className="font-bold text-white uppercase text-sm">{txt.soundMaster}</span></div>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 shrink-0 ${masterSound ? 'bg-emerald-500' : 'bg-slate-700'}`}><div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${masterSound ? 'translate-x-6' : 'translate-x-0'}`}></div></div>
                                </div>
                                <div className="flex items-center justify-between cursor-pointer group bg-slate-900/50 p-3 rounded-xl border border-slate-800" onClick={() => toggleSetting('dartisan_sound_180', sound180, setSound180)}>
                                    <div className="flex items-center gap-3"><span className={`font-black text-xl w-6 text-center ${sound180 ? 'text-white' : 'text-slate-600'}`}>!</span><span className={`font-bold uppercase text-sm ${sound180 ? 'text-white' : 'text-slate-500'}`}>{txt.sound180}</span></div>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 shrink-0 ${sound180 ? 'bg-cyan-500' : 'bg-slate-700'}`}><div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${sound180 ? 'translate-x-6' : 'translate-x-0'}`}></div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="animate-in fade-in slide-in-from-right-4 flex flex-col gap-6">
                        <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl">
                            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 mb-2"><ArrowDownTrayIcon className="h-5 w-5 text-emerald-400" /> {txt.exportTitle}</h2>
                            <p className="text-xs text-slate-400 font-bold leading-relaxed mb-6">{txt.exportDesc}</p>
                            <button onClick={handleExportData} className="w-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 py-4 rounded-xl font-black uppercase text-sm flex items-center justify-center gap-2 transition-all active:scale-95">
                                <ArrowDownTrayIcon className="h-6 w-6" /> {txt.exportBtn}
                            </button>
                        </div>

                        <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl">
                            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 mb-2"><ArrowUpTrayIcon className="h-5 w-5 text-cyan-400" /> {txt.importTitle}</h2>
                            <p className="text-xs text-slate-400 font-bold leading-relaxed mb-6">{txt.importDesc}</p>
                            <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportData} className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 py-4 rounded-xl font-black uppercase text-sm flex items-center justify-center gap-2 transition-all active:scale-95">
                                <ArrowUpTrayIcon className="h-6 w-6" /> {txt.importBtn}
                            </button>
                        </div>

                        <div className="bg-rose-500/5 p-6 rounded-3xl border border-rose-500/20 mt-4">
                            <h2 className="text-sm font-black text-rose-500 uppercase tracking-widest flex items-center gap-2 mb-2"><TrashIcon className="h-5 w-5" /> {txt.dangerTitle}</h2>
                            <p className="text-xs text-rose-400/70 font-bold leading-relaxed mb-6">{txt.dangerDesc}</p>
                            <button onClick={handleResetData} className="w-full bg-rose-500 text-white hover:bg-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.3)] py-4 rounded-xl font-black uppercase text-sm flex items-center justify-center gap-2 transition-all active:scale-95">
                                {txt.dangerBtn}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}