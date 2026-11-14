'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
                emoji: '🎯',
                title: 'Célpont alapú edzés',
                body: 'Az alkalmazás kiad egy célpontot (pl. D16, T20, BULL). Dobj rá három nyilat, majd add meg, hányszor találtad el. A rögzített találatok a személyes térképen jelennek meg.',
                tip: 'A térkép a rögzített találatok számát mutatja, nem a célzási pontosságot.',
            },
            {
                emoji: '📈',
                title: 'Miért hasznos?',
                body: 'A gyakorlás után áttekintheted, mely célpontokat találtad el gyakrabban. Az eredmények segítenek kiválasztani a következő edzés fókuszát.',
                tip: 'Több kör után jobban látszik, melyik célpont igényel gyakorlást.',
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
                title: 'Online kihívás',
                body: 'A kihívásos módban valós időben játszol egy barát ellen az interneten keresztül. Mindkettőtök dobásait a felhő szinkronizálja. Ossz meg egy kódot a barátodnak!',
                tip: 'Mindkét félnek aktív internetkapcsolat szükséges!',
            },
            {
                emoji: '📋',
                title: 'Hogyan kell csatlakozni',
                body: 'Másold ki a kódot és küldd el a barátodnak. A barát a Setup képernyőn a "Kihívás" fülön, "Csatlakozás" opcióval léphet be a kóddal.',
                tip: 'A kód addig használható, amíg a szoba elérhető.',
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
                body: 'A Ranglista fülön a játékosok heti XP szerinti sorrendje látható. Játssz meccseket, hogy gyarapítsd a profilod statisztikáit.',
                tip: 'A ranglista adataihoz bejelentkezés szükséges.',
            },
        ],
    },
};

const TUTORIALS_EN: Record<TutorialKey, { label: string; steps: Pick<Step, 'title' | 'body' | 'tip'>[] }> = {
    x01: { label: 'X01 match', steps: [
        { title: 'Reach exactly zero', body: 'Reduce your starting score (for example, 501) to exactly zero. A visit has up to three darts, and each dart is deducted as you enter it.', tip: 'Your visit score is the sum of its darts.' },
        { title: 'Checking out', body: 'With double-out, the finishing dart must land in a double segment or the inner bull. If you go below zero or leave one, the visit is a bust and your score returns to its value before the visit.', tip: 'Common finishes include D20 (40), D16 (32) and D10 (20).' },
        { title: 'Fast input', body: 'In Fast mode, enter your visit total and press Enter. Use Pro or Board mode to record each dart and its sector for detailed statistics.', tip: 'A suggested finish appears when your remaining score is within checkout range.' },
        { title: 'Legs and sets', body: 'A successful checkout wins a leg. When playing sets, win the required number of legs to take a set. The first player to reach the set target wins the match.', tip: 'The first-nine average helps you track your opening pace.' },
    ] },
    cricket: { label: 'Cricket', steps: [
        { title: 'What is Cricket?', body: 'Close 20, 19, 18, 17, 16, 15 and bull while managing the score against your opponent. Two players take turns.', tip: 'Cricket rewards both accuracy and timing.' },
        { title: 'Marks', body: 'Three marks close a target. A single earns one mark, a double two, and a treble three. The marks appear beside each target.', tip: 'Treble 20 closes 20 with one dart.' },
        { title: 'Scoring', body: 'In standard Cricket, extra hits score while your target is closed and your opponent’s is still open. In Cut-throat, those points go to the open opponent instead.', tip: 'Closing a high-value target early can change the match.' },
        { title: 'Winning', body: 'Close every target and have at least as many points as your opponent in standard Cricket. In Cut-throat, you need no more points than your opponent.', tip: 'Watch both marks and points.' },
    ] },
    practice_atc: { label: 'Around the Clock', steps: [
        { title: 'Work around the board', body: 'Hit 1 through 20 in order, then bull. A single, double or treble counts. Move to the next number only after a hit.', tip: 'A miss leaves the same target active.' },
        { title: 'Record your darts', body: 'In Pro input, select the number you hit or tap Miss. You get three darts per visit.', tip: 'A useful drill for accuracy and focus.' },
    ] },
    practice_bobs: { label: "Bob's 27", steps: [
        { title: 'Chase the doubles', body: 'Start on 27 points and work through D1 to D20, then bull. A hit adds the double value; a target you miss with all three darts deducts it.', tip: 'The drill ends if your score falls below zero.' },
        { title: 'Strategy', body: 'Early doubles are worth little, while the later ones can lift or sink your score quickly. Aim for your best total.', tip: 'A useful checkout practice routine.' },
    ] },
    practice_121: { label: '121 checkout drill', steps: [
        { title: 'Finish 121 in nine darts', body: 'You have nine darts to check out from 121. A finish must end on a double or inner bull. Succeed and the next level starts at 122.', tip: 'Finishes above 100 require planning.' },
        { title: 'Busts', body: 'If you go below zero, leave one, or finish without a valid double, that visit is a bust and its starting score is restored.', tip: 'Use the suggested checkout route at the top.' },
    ] },
    practice_hunter: { label: 'Target Hunter', steps: [
        { title: 'Target practice', body: 'The app gives you a target such as D16, T20 or bull. Throw three darts and record how many hit. Recorded hits appear on your personal hit map.', tip: 'The map shows recorded hits, not aiming accuracy.' },
        { title: 'Why practice this way?', body: 'Review which targets you hit more often and choose a focus for your next session.', tip: 'Several visits make patterns easier to see.' },
    ] },
    career: { label: 'Career mode', steps: [
        { title: 'Championship path', body: 'Play through 15 opponents. A win unlocks the next match; after a loss, you can retry the same opponent.', tip: 'You can take the career at your own pace.' },
        { title: 'Rising difficulty', body: 'Opponents become stronger as you progress. Later bots can score more consistently and check out in combinations.', tip: 'Career matches also contribute to your statistics.' },
    ] },
    challenge: { label: 'Online challenge', steps: [
        { title: 'Play a friend online', body: 'Create a room and share its code with a friend. Both players’ results are synchronized through the cloud during the match.', tip: 'Both players need an internet connection.' },
        { title: 'Join a room', body: 'Your friend opens the Versus tab on Match Setup and enters the room code under Join Match.', tip: 'The code works while the room remains available.' },
    ] },
    setup: { label: 'Match setup', steps: [
        { title: 'Choose match rules', body: 'Choose a mode, players, starting score, and the required legs and sets. You can also set check-in and checkout rules.', tip: 'Edit each player’s name and color on their card.' },
        { title: 'Players and bots', body: 'Add up to four players for a local match. Turn on Bot if you need an opponent and choose its difficulty.', tip: 'Bot matches also contribute to your local statistics.' },
        { title: 'Leaderboard', body: 'The Leaderboard tab shows players by weekly XP. Sign in to save your profile and appear in the community view.', tip: 'Online rankings need a signed-in account.' },
    ] },
};

interface TutorialOverlayProps {
    tutorialKey: TutorialKey;
    lang: 'hu' | 'en';
    onClose: () => void;
}

const STORAGE_PREFIX = 'dartisan_tutorial_seen_';

export function TutorialOverlay({ tutorialKey, lang, onClose }: TutorialOverlayProps) {
    const [step, setStep] = useState(0);
    const overlayRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const huTutorial = TUTORIALS[tutorialKey];
    const translation = TUTORIALS_EN[tutorialKey];
    const tut = lang === 'hu' ? huTutorial : {
        label: translation.label,
        steps: huTutorial.steps.map((huStep, index) => ({ ...huStep, ...translation.steps[index] })),
    };
    const total = tut.steps.length;
    const current = tut.steps[step];
    const isLast = step === total - 1;

    const handleClose = useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_PREFIX + tutorialKey, '1');
        }
        onClose();
    }, [tutorialKey, onClose]);

    useEffect(() => {
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const siblings = Array.from(overlayRef.current?.parentElement?.children || [])
            .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlayRef.current)
            .map(element => ({ element, inert: element.inert, ariaHidden: element.getAttribute('aria-hidden') }));
        siblings.forEach(({ element }) => { element.inert = true; element.setAttribute('aria-hidden', 'true'); });
        closeButtonRef.current?.focus();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); handleClose(); return; }
            if (event.key !== 'Tab') return;
            const buttons = Array.from(overlayRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
            if (!buttons.length) return;
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            siblings.forEach(({ element, inert, ariaHidden }) => {
                element.inert = inert;
                if (ariaHidden === null) element.removeAttribute('aria-hidden');
                else element.setAttribute('aria-hidden', ariaHidden);
            });
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [handleClose]);

    useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [step]);

    return (
        <div ref={overlayRef} className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" style={{ paddingTop: 'calc(1rem + var(--app-safe-top))', paddingBottom: 'calc(1rem + var(--app-safe-bottom))' }}>
            <div role="dialog" aria-modal="true" aria-label={tut.label} className="w-full max-w-md bg-[#12141a] rounded-[2rem] border border-slate-700 shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100dvh - var(--app-safe-top) - env(safe-area-inset-bottom) - 2rem)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <LightBulbIcon className="h-5 w-5 text-cyan-400" />
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            {tut.label} – {lang === 'hu' ? 'Útmutató' : 'Guide'}
                        </span>
                    </div>
                    <button ref={closeButtonRef} onClick={handleClose} aria-label={lang === 'hu' ? 'Bezárás' : 'Close'} className="min-h-11 min-w-11 flex items-center justify-center bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>

                {/* Step content */}
                <div ref={contentRef} className="px-6 py-6 min-h-0 overflow-y-auto">
                    <div className="text-5xl text-center mb-4">{current.emoji}</div>
                    <h2 className="text-xl font-black text-white text-center uppercase italic mb-3">{current.title}</h2>
                    <p className="text-sm text-slate-300 text-center leading-relaxed mb-4">{current.body}</p>
                    {current.tip && (
                        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-4 py-2.5 flex gap-2 items-start">
                            <span className="text-cyan-400 text-sm shrink-0">💡</span>
                            <p className="text-xs text-cyan-200 font-bold leading-snug">{current.tip}</p>
                        </div>
                    )}
                </div>

                {/* Progress + navigation */}
                <div className="px-6 pb-5 shrink-0">
                    {/* Dots */}
                    <div className="flex justify-center gap-1.5 mb-4">
                        {tut.steps.map((_, i) => (
                            <button key={i} type="button" onClick={() => setStep(i)} aria-label={lang === 'hu' ? `${i + 1}. lépés` : `Step ${i + 1}`} aria-current={i === step ? 'step' : undefined}
                                className="min-h-8 min-w-8 flex items-center justify-center rounded-full">
                                <span className={`h-2 rounded-full transition-all ${i === step ? 'w-5 bg-emerald-500' : 'w-2 bg-slate-700 hover:bg-slate-500'}`} />
                            </button>
                        ))}
                    </div>
                    {/* Navigation */}
                    <div className="flex gap-2">
                        {step > 0 && (
                            <button onClick={() => setStep(s => s - 1)}
                                className="flex-1 h-12 rounded-2xl bg-slate-800 text-slate-300 font-black text-sm flex items-center justify-center gap-1 hover:bg-slate-700 transition-colors">
                                <ChevronLeftIcon className="h-4 w-4" /> {lang === 'hu' ? 'Vissza' : 'Back'}
                            </button>
                        )}
                        {isLast ? (
                            <button onClick={handleClose}
                                className="flex-1 h-12 rounded-2xl bg-emerald-500 text-slate-900 font-black text-sm uppercase tracking-wider hover:opacity-90 transition-opacity">
                                {lang === 'hu' ? 'Értem, kezdjük!' : 'Got it, let’s play!'} 🎯
                            </button>
                        ) : (
                            <button onClick={() => setStep(s => s + 1)}
                                className="flex-1 h-12 rounded-2xl bg-emerald-500 text-slate-900 font-black text-sm flex items-center justify-center gap-1 hover:opacity-90 transition-opacity">
                                {lang === 'hu' ? 'Következő' : 'Next'} <ChevronRightIcon className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <button onClick={handleClose} className="w-full min-h-11 mt-2 text-[10px] text-slate-400 hover:text-slate-200 font-bold uppercase tracking-widest transition-colors">
                        {lang === 'hu' ? 'Kihagyom (ne mutasd újra)' : 'Skip (do not show again)'}
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
