import type { DartsDna } from './dartsDna';

export type CoachMode = 'tactics' | 'broadcast' | 'rival';

export function createLocalNarrative(mode: CoachMode, lang: 'hu' | 'en', dna: DartsDna): string {
  if (dna.matches === 0) return lang === 'hu'
    ? 'Még nincs mentett meccsed. Játssz néhány 501-es meccset, és itt a saját számaidból készül összefoglaló. A Nyomáslabor addig is használható.'
    : 'No recorded matches yet. Play a few 501 matches to get a summary based on your own results. The Pressure Lab is ready now.';

  const number = (value: number | null, digits = 1) => value === null ? '—' : new Intl.NumberFormat(lang === 'hu' ? 'hu-HU' : 'en-US', {
    maximumFractionDigits: digits,
  }).format(value);
  const focusHu = dna.focus === 'doubles' ? 'a dupla kiszállók' : dna.focus === 'opening' ? 'az első kilenc nyíl' : 'a ponttermelés';
  const focusEn = dna.focus === 'doubles' ? 'double finishes' : dna.focus === 'opening' ? 'your first nine darts' : 'scoring';
  const sampleHu = dna.confidence === 'low' ? 'Ez még kevés meccs, ezért a minták változhatnak. ' : '';
  const sampleEn = dna.confidence === 'low' ? 'This is a small sample, so patterns may change. ' : '';

  if (mode === 'tactics') {
    const targetHu = dna.weakestTarget ? `A célzott nyilaknál ${dna.weakestTarget.target} most ${number(dna.weakestTarget.hits / dna.weakestTarget.attempts * 100, 0)}%-os; erre legalább 8 kísérlet ad alapot.` : '';
    const targetEn = dna.weakestTarget ? `Your aimed darts hit ${dna.weakestTarget.target} ${number(dna.weakestTarget.hits / dna.weakestTarget.attempts * 100, 0)}% of the time, based on at least eight attempts.` : '';
    return lang === 'hu'
      ? `${dna.matches} mentett meccsed alapján a háromnyilas átlagod ${number(dna.average)}, az első kilenc nyílé ${number(dna.first9Average)}. ${sampleHu}\n\nA következő edzés fókusza: ${focusHu}. ${targetHu} Kezdj 10 perc célzott gyakorlással, utána játssz egy 501-es meccset, és hasonlítsd össze az új eredményt.`
      : `Across ${dna.matches} recorded matches, your three-dart average is ${number(dna.average)} and first-nine average is ${number(dna.first9Average)}. ${sampleEn}\n\nNext practice focus: ${focusEn}. ${targetEn} Start with ten minutes of targeted practice, then play a 501 match and compare the result.`;
  }

  if (mode === 'broadcast') {
    const trendHu = dna.momentum === null ? 'A trendhez még több összehasonlítható meccs kell.'
      : `Az utolsó öt meccs átlaga ${number(Math.abs(dna.momentum))} ponttal ${dna.momentum >= 0 ? 'magasabb' : 'alacsonyabb'} az előző öténél.`;
    const trendEn = dna.momentum === null ? 'More comparable matches are needed for a trend.'
      : `The last five matches average ${number(Math.abs(dna.momentum))} points ${dna.momentum >= 0 ? 'higher' : 'lower'} than the previous five.`;
    return lang === 'hu'
      ? `Dartisan-stúdió, a számok beszélnek: ${dna.matches} meccs, ${number(dna.winRate, 0)}% győzelem és ${number(dna.average)}-as háromnyilas átlag. ${trendHu} ${sampleHu}A következő történetet a pályán írod meg.`
      : `Dartisan studio, the numbers tell the story: ${dna.matches} matches, ${number(dna.winRate, 0)}% wins and a ${number(dna.average)} three-dart average. ${trendEn} ${sampleEn}The next chapter is yours to play.`;
  }

  const target = Math.min(180, Math.max(30, Math.ceil(((dna.average ?? 27) + 3) / 5) * 5));
  return lang === 'hu'
    ? `Kihívlak a következő 501-re: célozz meg legalább ${target} pontot három nyílra átlagban. A jelenlegi mintád ${number(dna.average)}, ezért ez valódi, mérhető előrelépés lenne. ${sampleHu}Ha sikerül, új célt kapsz.`
    : `Your next 501 challenge: aim for a three-dart average of at least ${target}. Your current pattern is ${number(dna.average)}, so that would be a measurable step forward. ${sampleEn}Hit it and earn a harder target.`;
}
