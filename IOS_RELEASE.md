# Dartisan iOS – helyi fejlesztés és kiadás

Az iOS-projekt a `ios/App/App.xcodeproj` fájlban van. Az alkalmazás a Next.js statikus `out` mappáját csomagolja be. A `com.vidorandras.dartisan` alkalmazásazonosító **ideiglenes**: a végleges azonosítót a kiadást végző Apple Developer-fiókkal egyeztetni kell az első App Store-feltöltés előtt.

## Helyi építés

1. `npm ci`
2. `npm run build`
3. `npm run ios:assets`
4. `npm run ios:sync`
5. `npm run ios:open`

Az Xcode-ban az `App` sémát válaszd. Szimulátorhoz nem kell fejlesztői tagság. Saját iPhone-on való próbához a `Signing & Capabilities` részen válaszd a saját, ingyenes `Personal Team` csapatodat és az automatikus aláírást. Az iPhone-on szükség lehet a Fejlesztői mód bekapcsolására. A webes kód minden módosítása után újra kell futtatni a `build` és `ios:sync` lépéseket; az ikon vagy indulókép módosítása után az `ios:assets` lépést is.

## Amit már ellenőriztem

- A Next.js statikus build és a Capacitor-szinkron sikeres.
- Az Xcode szimulátoros fordítása sikeres.
- Az app elindul iPhone 17e és iPad Air 11-inch (M4) szimulátoron; az első képernyő látható.
- A Dartisan saját ikonja és sötét indulóképe bekerült az iOS-projektbe.

Ez indulási próba, nem teljes iOS-funkcióteszt. A bejelentkezést, online játékot és fióktörlést még külön, valódi készüléken is tesztelni kell.

## Kiadás előtti kötelező munka

1. A Google- és Apple-belépést natív iOS-folyamattal megoldani. A jelenlegi webes felugróablakos belépés iOS-alkalmazásban nincs igazolva, az Apple-gomb jelenleg kikapcsolt.
2. Az e-mailes belépőlink visszatérését az alkalmazásba beállítani. A jelenlegi kód a böngésző eredetét használja, ami a becsomagolt iOS-alkalmazásban nem megfelelő visszatérési cím.
3. A fióktörlést élesben működővé tenni. A jelenlegi gomb Firebase Cloud Functiont hív, amely az ingyenes Spark csomagban nem fut; a Railway oldali hitelesített kiszolgáló lehet az egyik megoldás.
4. Nyilvános adatkezelési tájékoztatót és támogatási elérhetőséget közzétenni; az App Store adatkezelési válaszait kitölteni.
5. Teljes iPhone- és iPad-funkciótesztet végezni: belépés, kijelentkezés, meccs, mentés és folytatás, online két kliens, fióktörlés, offline viselkedés, forgatás, billentyűzet és kisegítő lehetőségek.
6. A végleges alkalmazásazonosítót, aláírást és Apple-belépés beállításait a kiadást végző fiókban létrehozni; TestFlight-próba után feltölteni az App Store-ba.

A saját ingyenes Apple-fiók megfelelő a helyi fejlesztéshez. A bátyád fizetős Apple Developer-fiókja a végső Apple-szolgáltatásokhoz, a TestFlighthoz és a bolti kiadáshoz szükséges. A fiók jelszavát nem kell megosztani.
