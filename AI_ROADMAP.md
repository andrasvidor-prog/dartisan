# Dartisan AI: funkciók és költségek

Frissítve: 2026. november 14. Az összegek **becslések egy használatra**, USD-ben, kizárólag az OpenAI API-ra. A Firebase- és Railway-használat külön tétel. A `0 $` azt jelenti, hogy a funkció nem küld kérést az OpenAI-nak; a készülék és az adatbázis erőforrásait ettől még használhatja.

## Ármodell a becsléshez

- Rövid szöveges válasz: GPT-6 Luna, 1000–2000 bemeneti és 200–600 kimeneti token: **0,0002–0,0005 $/kérés**.
- Részletes elemzés: GPT-6 Luna, 3000–5000 bemeneti és 500–1000 kimeneti token: **0,0006–0,0010 $/kérés**.
- Erősebb modell választható prémium módban: GPT-6.1 Terra, 2000 bemeneti és 500 kimeneti token: körülbelül **0,0045 $/kérés**. Ezt nem kell alapértelmezetté tenni.
- Hangfelismerés: GPT-Transcribe **0,0045 $/perc**. Folyamatos élő beszélgetés GPT-Live-1-gyel **0,05 $/perc**, plusz a háttérmodell és eszközök használata.
- A készülék szövegfelolvasása: **0 $ OpenAI-költség**. Szintetikus hang és képgenerálás árához külön mintahívás és az aktuális kalkulátor szükséges.
- Ha 3 játékos mindennap 8 új rövid elemzést kér 30 napon át, a fenti Luna-becslés körülbelül **0,14–0,36 $/hó**. A szerver, adatbázis, képek és hang nincs ebben az összegben.

Árforrások: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [GPT-6.1 Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [API-árak](https://developers.openai.com/api/docs/pricing), [GPT-Transcribe](https://developers.openai.com/api/docs/models/gpt-transcribe), [költési korlátok](https://developers.openai.com/api/docs/guides/spend-limits). Az árak és modellek változhatnak.

## 1. hullám – a játékból származó adatok, kis költség

| # | Funkció | Élmény és érték | Becsült API-költség | Állapot |
| --- | --- | --- | --- | --- |
| 1 | Darts DNS | Játékprofil a mentett átlagból, első 9 nyílból, kiszállóból és célzott találatokból | 0 $ | Helyben kész |
| 2 | Nyomáslabor | Egy gombbal dupla-, 121-es és Boss-kihívás | 0 $ | Helyben kész |
| 3 | Taktikai dosszié | Konkrét erősségek, gyenge pontok és következő edzés | Helyi szöveg: 0 $; élő AI: 0,0002–0,0006 $ | Helyi változat kész, élő AI kulcsra vár |
| 4 | Meccsfilm | A valós statisztikákat sportközvetítés stílusában meséli el | Helyi szöveg: 0 $; élő AI: 0,0002–0,0006 $ | Helyi változat kész, élő AI kulcsra vár |
| 5 | Rivális hang | Személyre szabott, játékos meccselőzetes | Helyi szöveg: 0 $; élő AI: 0,0002–0,0006 $ | Helyi változat kész, élő AI kulcsra vár |
| 6 | Fantomellenfél | A saját korábbi köreid ritmusa ellen játszol | 0 $ | Kész a következő befejezett X01 meccstől; eltérő helyzetben a szokásos bot folytatja |
| 7 | Fordulópont-visszajátszás | A meccs legfontosabb három körét emeli ki | 0 $ | Kész a következő befejezett X01 meccstől; helyi idővonal és kiemelések |
| 8 | Kiszálló-útvonal térkép | Több szabályosan ellenőrzött kiszálló vagy előkészítés 1–3 nyílra | 0 $ | Kész; interaktív maradék, nyílszám és kiszállószabály |
| 9 | Gyenge szektorok edzése | Saját célzási adatokból választott 30 nyilas feladat | 0 $ | Kész; találati arány, visszavonás, eredmény és célzott mérés |
| 10 | Személyes szintlépési cél | Aktuális hétre számolt cél a mentett meccsekből | 0 $ | Kész; X01 meccsekből hétfőn újraszámolva |

## 2. hullám – különleges edző és meccsélmény

| # | Funkció | Élmény és érték | Becsült API-költség |
| --- | --- | --- | --- |
| 11 | „Mi lett volna, ha?” | Másik kiszállóút vagy célpont hatásának szimulálása | 0 $; magyarázat 0,0002–0,0005 $ |
| 12 | Edzői csere a legszünetben | Egy rövid, adatból indokolt taktikai javaslat | 0,0002–0,0005 $ / kérés |
| 13 | Ellenfél-felderítő | Korábbi meccsekből gyűjtött erősségek és minták | 0 $; prózai elemzés 0,0006–0,0010 $ |
| 14 | Győzelmi recept | Az eddigi legjobb meccsek közös mintáit keresi | 0 $; magyarázat 0,0002–0,0005 $ |
| 15 | Személyre szabott négyhetes terv | Mérhető feladat, terhelés és újratervezés | 0 $ algoritmussal vagy 0,0006–0,0010 $ / új terv |
| 16 | Edzés közbeni adaptáció | A következő célpont az előző körök alapján változik | 0 $ |
| 17 | Mentális nyomásszimulátor | Kevés nyíl, időkeret, virtuális ellenfél és visszajelzés | 0 $ |
| 18 | Saját stílusú bot | A játékos korábbi pontszámaihoz hasonló ellenfél | 0 $; részletes eseménynapló kell |
| 19 | Edzői sajtótájékoztató | A meccs végén kérdések és rövid, stílusos válaszok | 0,0002–0,0005 $ / válasz |
| 20 | Karrier-sztori | A valós eredményekből épülő, választható epizód | 0,0006–0,0010 $ / epizód |
| 21 | Személyes mérföldkő-kártya | Hiteles rekord és megosztható rövid történet | 0 $; szöveg 0,0002–0,0005 $ |
| 22 | Darts-kvíz a saját hibákból | Kiszállószámolás gyakorlása valós nehézségi szinten | 0 $ |
| 23 | Kéthetes fejlődési jelentés | Trendek, bizonytalanság és konkrét új cél | 0 $; narráció 0,0006–0,0010 $ |
| 24 | Kommentátor személyiségek | Választható sportos, humoros, nyugodt, taktikus szöveg | 0,0002–0,0005 $ / kérés |

## 3. hullám – hang, kamera és kreatív extrák

| # | Funkció | Élmény és érték | Becsült API-költség |
| --- | --- | --- | --- |
| 25 | Hangos pontbevitel | „Tripla húsz, húsz, dupla tíz” felismerése és megerősítése | 0 $ készülékfelismeréssel, vagy ~0,0045 $/perc átírással |
| 26 | Hangos edző | Felolvasott tanács a készülék hangjával | 0 $ a szöveg ára fölött |
| 27 | Élő AI-kommentátor | Folyamatos beszélgetés a meccs alatt | ~0,05 $/perc + háttérhívások; csak külön bekapcsolva |
| 28 | Dobásvideó-elemzés | Testtartás és mozdulat összehasonlítása időben | képkockaszámtól és felbontástól függ; mintafájl után mérhető |
| 29 | Kamerás találatfelismerés | Tábla kalibrálása és nyílhely becslése | képkockaszámtól függ; külön pontossági próba kell |
| 30 | Saját karrierposzter | A valós csúcsokból egyedi vizuális emlék | képgenerálás minőségétől/felbontástól függ; kalkulátorral mérendő |
| 31 | Rivalizálás előzetese | Két barát statisztikájából meccsbevezető | 0,0002–0,0006 $ / szöveg |
| 32 | Élő meccskártya TV-re | Nagy képernyős, a meccshez igazodó grafika | 0 $ |
| 33 | Közösségi kihíváskészítő | Fair szabályokkal heti egyedi kihívás | 0 $ sablonból vagy 0,0002–0,0005 $ / új kihívás |
| 34 | Két nyelvű narráció | Magyar és angol meccsösszefoglaló | 0,0004–0,0010 $ / két változat |
| 35 | Videós highlight-reel | Valódi meccseseményekből rövid klip | tárhely, feldolgozás és esetleges videómodell alapján mérendő |

## Bevezetési szabályok

1. Az OpenAI-kulcs kizárólag szerveroldali titok legyen; soha ne kerüljön a webes vagy iOS buildbe.
2. Az AI csak explicit gombnyomásra induljon. Minden funkció mutassa a várható költséget és a felhasználói keretet.
3. A fontos döntések (pont, kiszálló, nyertes, XP, online eredmény) determinisztikus kódból jöjjenek. Az AI magyarázzon és javasoljon, de ne írja át őket.
4. A modell csak a szükséges statisztikákat kapja meg. Hang és videó feltöltéséhez külön adatkezelési döntés kell.
5. A valódi költséget az első 20–50 kérés után a szolgáltatói usage adatokból kell újrabecsülni. Állítsunk be OpenAI-projektszintű kemény havi limitet, például 5 $-t; a szerveres napi limit önmagában nem abszolút költési plafon.
6. A funkciók megjelenését mobilon, tableten és laptopon, valamint valódi meccsadatokkal kell elfogadni élesítés előtt.
