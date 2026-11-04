'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, ChevronRightIcon, ChevronLeftIcon, LightBulbIcon } from '@heroicons/react/24/outline';

export type TutorialKey =
    | 'x01'
    | 'cricket'
    | 'practice_atc'
    | 'practice_bobs'
    | 'practice_121'
    | 'practice_hunter'
    | 'career'
    | 'challenge'
    | 'setup';

interface Step {
    title: string;
    body: string;
    emoji: string;
    tip?: string;
}

const TUTORIALS: Record<TutorialKey, { label: string; steps: Step[] }> = {
    x01: {
        label: 'X01 Meccs',
        steps: [
            {
                emoji: '🎯',
                title: 'Cél: csökkentsd 0-ra!',
                body: 'A kiindulópontod (pl. 501) pontosan 0-ra kell csökkentened. Minden kör 3 nyílból áll. Az adott kör pontjait vonjuk le az aktuális pontszámodból.',
                tip: 'A pontszám a körben leadott nyilak összege!',
            },
            {
                emoji: '✌️',
                title: 'Kiszálló (Checkout)',
                body: 'Alapesetben az utolsó nyílnak egy DUPLA szegmensre kell esnie (pl. D20 = 40 pont). Ez a "dupla kiszálló" szabály. Ha besokallasz (a maradék nulla alatt marad), a kör érvénytelen és visszaáll.',
                tip: 'A leggyakoribb kiszálló: D20 (40), D16 (32), D10 (20).',
            },
            {
                emoji: '📊',
                title: 'Gyors bevitel',
                body: 'Használd a FAST módot: üsd be a kör összpontját, majd nyomj Enter-t. Ha nyílanként is szeretnéd rögzíteni (pl. statisztikáért), válts PRO módra.',
                tip: 'A kiszálló-javaslat automatikusan megjelenik, ha 170 alatt vagy!',
            },
            {
                emoji: '🏆',
                title: 'Nyerni, szetteket szerezni',
                body: 'Egy LET nyerése = a kiszálló sikeresen bedobva. Szettrendszernél (pl. Best of 3 sett, 3 leg per sett) szetteket nyersz legekkel. Az első, aki eléri a célt, nyeri a meccset.',
                tip: 'Az első 9 darts átlaga mutatja legjobban, mennyire erős a rajtod!',
            },
        ],
    },

    cricket: {
        label: 'Cricket',
        steps: [
            {
                emoji: '🏏',
                title: 'Mi az a Cricket?',
                body: 'A Cricket célja, hogy LEZÁRD a 20, 19, 18, 17, 16, 15 és BULL szegmenseket, miközben a lehető legtöbb pontot szerzed. Egyszerre 2 játékos játssza.',
                tip: 'Cricket gyorsabb és taktikusabb, mint az X01!',
            },
            {
                emoji: '✓',
                title: 'Jelölések (Marks)',
                body: '3 jelölés szükséges egy szegmens lezárásához. Single = 1 jel, Double = 2 jel, Triple = 3 jel (azonnal lezárva). A jel megjelenik a szegmens melletti oszlopban.',
                tip: 'Triple 20 = azonnali lezárás egy nyíllal!',
            },
            {
                emoji: '💰',
                title: 'Pontszerzés',
                body: 'Ha egy szegmenst TE már lezártál, de az ellenfeled még nem, akkor minden extra dobásod arra a szegmensre pontot hoz! Single 20 = +20, Double 20 = +40, Triple 20 = +60.',
                tip: 'Gyorsan zárd le a 20-ast, mert az a legtöbb pontot hozza!',
            },
            {
                emoji: '🥇',
                title: 'Győzelem feltétele',
                body: 'Nyersz, ha MINDEN szegmenst lezártad ÉS legalább annyi pontod van, mint az ellenfelednek. Ha az ellenfeled is lezár mindent, de neked több pontod van – te nyersz!',
                tip: 'Figyelj az ellenfeled pontjára is, ne csak lezárásokra!',
            },
        ],
    },

    practice_atc: {
        label: 'Around the Clock',
        steps: [
            {
                emoji: '🕐',
                title: 'Körbe az óramutató szerint',
                body: 'Dobj sorban 1-től 20-ig, majd a Bull-ra. Minden számot el kell találnod (single, double, treble egyformán érvényes), mielőtt a következőre léphetsz.',
                tip: 'Ha elhibázod, ugyanarra a számra kell újra dobni!',
            },
            {
                emoji: '⚡',
                title: 'Hogyan rögzítsd',
                body: 'A RÉSZLETES (Pro) módban: nyomj a számra ha eltaláltad. Ha nem találtad el, nyomj Miss-t. 3 nyilad van körenként.',
                tip: 'Jó edzés a precizitásra és a koncentrációra!',
            },
        ],
    },

    practice_bobs: {
        label: "Bob's 27",
        steps: [
            {
                emoji: '🎲',
                title: "Bob's 27 – Dupla vadász",
                body: '27 ponttal indulsz. A célpontok sorban: D1, D2, D3 ... D20, majd Bull. Ha eltalálod a duplát, az értéke hozzáadódik (D3 = +6). Ha nem találod el körenként egyszer sem, az értéke LEVONÓDIK (-6).',
                tip: 'Ha a pontszámod 0 alá esik, azonnal vége a játéknak!',
            },
            {
                emoji: '💡',
                title: 'Taktika',
                body: 'Az első duplák (D1 = 2, D2 = 4) kicsik, de a végén a nagy duplák (D20 = 40) nagyon megdobhatják a pontszámod. A Bull 50 pontot ér. Rekord: minél több pont, annál jobb!',
                tip: 'Ideális edzés a kiszállók tökéletesítéséhez!',
            },
        ],
    },

    practice_121: {
        label: '121 Kiszálló Edzés',
        steps: [
            {
                emoji: '🔢',
                title: '9 nyílból 121',
                body: '9 nyilad van, hogy kiszállj a 121-ről. Minden kiszálló duplával kell végződjön (dupla kiszálló szabály). Ha sikerül, a következő szint 122, aztán 123...',
                tip: 'A legnehezebb kiszállók 100 felett vannak!',
            },
            {
                emoji: '🚫',
                title: 'Besokallás',
                body: 'Ha besokallasz (1-re vagy negatívra viszi a pontot, vagy nem dupla az utolsó), az adott kör darts száma levonódik, de a pontszámod visszaáll a kör elejére.',
                tip: 'Ajánlott kiszálló javaslat mindig látható a tetején!',
            },
        ],
    },

    practice_hunter: {
        label: 'Szegmens Vadász',
        steps: [
            {
                emoji: '🤖',
                title: 'AI-vezérelt edzés',
                body: 'Az AI kiad egy célpontot (pl. D16, T20, BULL). Dobd rá a 3 nyilad, és add meg, hányszor találtad el. Ez feltölti a személyes dobóstatisztikád (Hőtérkép).',
                tip: 'Minél több adatot gyűjtesz, annál okosabb lesz a kiszálló ajánló!',
            },
            {
                emoji: '📈',
                title: 'Miért hasznos?',
                body: 'Az összegyűjtött adatok alapján az AI tanul a gyengeségeidről és erősségeidről, és meccsközben pontosabb, személyre szabott kiszálló javaslatokat ad.',
                tip: 'Legalább 10-15 kört játssz minden szegmenssel az optimális eredményért!',
            },
        ],
    },

    career: {
        label: 'Karriermód',
        steps: [
            {
                emoji: '🌍',
                title: 'Világbajnokság Ágrajz',
                body: 'A karrier 15 egymás utáni meccsből áll. Minden győzelem feloldja a következő, erősebb ellenfelet. Vereség után ugyanazzal az ellenféllel próbálkozhatsz újra.',
                tip: 'Bármelyik kört újrajátszhatod, ha elveszítesz!',
            },
            {
                emoji: '📈',
                title: 'AI Ellenfél nehézsége',
                body: 'A korai körökben az ellenfelek 1-3-as nehézségű botokok. A döntőre a szint eléri a 8-10-et – valóban kemény meccs! Az AI képes kiszálló kombinációkat dobni.',
                tip: 'Nem kell sietni – a statisztikád karriermódban is gyarapodik!',
            },
        ],
    },

    challenge: {
        label: 'Online Kihívás',
        steps: [
            {
                emoji: '📡',
                title: 'Aszinkron kihívás',
                body: 'A kihívásos módban valós időben játszol egy barát ellen az interneten keresztül. Mindkettőtök dobásait a felhő szinkronizálja. Ossz meg egy kódot a barátodnak!',
                tip: 'Mindkét félnek aktív internetkapcsolat szükséges!',
            },
            {
                emoji: '📋',
                title: 'Hogyan kell csatlakozni',
                body: 'Másold ki a kódot és küldd el a barátodnak. A barát a Setup képernyőn a "Kihívás" fülön, "Csatlakozás" opcióval léphet be a kóddal.',
                tip: 'A kód 24 óráig érvényes.',
            },
        ],
    },

    setup: {
        label: 'Beállítások & Indítás',
        steps: [
            {
                emoji: '⚙️',
                title: 'Meccs beállítása',
                body: 'Válaszd ki a játékmódot (X01, Cricket, Edzés, Karrier, Kihívás), állítsd be a játékosok számát és nevét, a pontszámot (301/501/701), és a legek/szettek számát.',
                tip: 'A színes profilkártyán tudsz játékosnevet és színt választani!',
            },
            {
                emoji: '👥',
                title: 'Játékosok',
                body: 'Adj hozzá 1-4 játékost. Kapcsold be a BOT-ot ha nincs valós ellenfeled. A nehézségi szintje csúszkával állítható (1 = kezdő, 10 = profi).',
                tip: 'Bot ellen játszva is gyűlnek a statisztikáid!',
            },
            {
                emoji: '🏆',
                title: 'Ranglista',
                body: 'A Ranglista fülön a legjobb játékosok heti XP szerinti sorrendje látható. Játssz minél több meccset, hogy feljebb kerülj! XP győzelemért: 100, vereségért: 10.',
                tip: 'A heti XP minden hétfőn nullázódik!',
            },
        ],
    },
};

interface TutorialOverlayProps {
    tutorialKey: TutorialKey;
    onClose: () => void;
}

const STORAGE_PREFIX = 'dartisan_tutorial_seen_';

export function TutorialOverlay({ tutorialKey, onClose }: TutorialOverlayProps) {
    const [step, setStep] = useState(0);
    const tut = TUTORIALS[tutorialKey];
    if (!tut) return null;
    const total = tut.steps.length;
    const current = tut.steps[step];
    const isLast = step === total - 1;

    const handleClose = () => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_PREFIX + tutorialKey, '1');
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#12141a] rounded-[2rem] border border-slate-700 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <LightBulbIcon className="h-5 w-5 text-amber-400" />
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            {tut.label} – Tutorial
                        </span>
                    </div>
                    <button onClick={handleClose} className="p-1.5 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>

                {/* Step content */}
                <div className="px-6 py-6">
                    <div className="text-5xl text-center mb-4">{current.emoji}</div>
                    <h2 className="text-xl font-black text-white text-center uppercase italic mb-3">{current.title}</h2>
                    <p className="text-sm text-slate-300 text-center leading-relaxed mb-4">{current.body}</p>
                    {current.tip && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 flex gap-2 items-start">
                            <span className="text-amber-400 text-sm shrink-0">💡</span>
                            <p className="text-xs text-amber-300 font-bold leading-snug">{current.tip}</p>
                        </div>
                    )}
                </div>

                {/* Progress + navigation */}
                <div className="px-6 pb-5">
                    {/* Dots */}
                    <div className="flex justify-center gap-1.5 mb-4">
                        {tut.steps.map((_, i) => (
                            <button key={i} onClick={() => setStep(i)}
                                className={`rounded-full transition-all ${i === step ? 'w-5 h-2 bg-emerald-500' : 'w-2 h-2 bg-slate-700 hover:bg-slate-500'}`} />
                        ))}
                    </div>
                    {/* Navigation */}
                    <div className="flex gap-2">
                        {step > 0 && (
                            <button onClick={() => setStep(s => s - 1)}
                                className="flex-1 h-12 rounded-2xl bg-slate-800 text-slate-300 font-black text-sm flex items-center justify-center gap-1 hover:bg-slate-700 transition-colors">
                                <ChevronLeftIcon className="h-4 w-4" /> Vissza
                            </button>
                        )}
                        {isLast ? (
                            <button onClick={handleClose}
                                className="flex-1 h-12 rounded-2xl bg-emerald-500 text-slate-900 font-black text-sm uppercase tracking-wider hover:opacity-90 transition-opacity">
                                Értem, kezdjük! 🎯
                            </button>
                        ) : (
                            <button onClick={() => setStep(s => s + 1)}
                                className="flex-1 h-12 rounded-2xl bg-emerald-500 text-slate-900 font-black text-sm flex items-center justify-center gap-1 hover:opacity-90 transition-opacity">
                                Következő <ChevronRightIcon className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <button onClick={handleClose} className="w-full mt-2 text-[10px] text-slate-600 hover:text-slate-500 font-bold uppercase tracking-widest transition-colors py-1">
                        Kihagyom (ne mutasd újra)
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Returns true if the tutorial for this key has NOT been seen yet */
export function shouldShowTutorial(key: TutorialKey): boolean {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(STORAGE_PREFIX + key);
}
