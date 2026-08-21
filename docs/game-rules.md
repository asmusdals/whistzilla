# Whistzilla – officielle spilleregler

> **Status:** Autoritativt regelsæt for Whistzilla
> **Spillere:** 4
> **Kort:** 52 almindelige kort + 3 jokere
>
> Regler markeret med **⚠️ AFKLARES** er endnu ikke endeligt besluttet og skal bekræftes, før den pågældende funktion implementeres endeligt.

> **Implementeringsmandat, 2026-08-21:** Whistzilla må implementere den foreløbige forståelse eller udgangsregel, som står under et `⚠️ AFKLARES`-punkt. Implementeringen skal fortsat mærkes som foreløbig og kunne ændres, når reglerne senere er drøftet. Markeringen er derfor ikke et generelt stop for udvikling. Hvis et punkt ikke beskriver nogen foreløbig adfærd, må implementeringen fortsat ikke opfinde en regel uden input.

---

# 1. Grundlæggende opsætning

## 1.1 Spillere

Der spilles altid med præcis **4 spillere**.

Alle fire spillere deltager i hvert spil.

Spillet og turene går med uret.

---

## 1.2 Vært og regnskab

Værten fører regnskab.

Whistzilla fører kun regnskab i **point**.

Appen skal ikke beregne pengebeløb eller værdien af et point.

---

## 1.3 Kort

Der spilles med:

- 52 almindelige spillekort
- 3 jokere

I alt:

**55 kort**

Hver spiller får:

**13 kort**

De resterende:

**3 kort**

udgør bytterne/katten.

---

# 2. Kortgiver

## 2.1 Første kortgiver

I første spil er spilleren efter værten kortgiver.

---

## 2.2 Rotation

Efter hvert spil går rollen som kortgiver én plads videre med uret.

---

## 2.3 Kortgivning

Kortgiveren bestemmer selv, hvordan kortene fordeles, så længe:

- hver spiller får præcis 13 kort
- der bliver præcis 3 byttere

---

## 2.4 Der skal tages af eller bankes

Inden kortene gives, skal der enten:

- tages af, eller
- bankes

Dette foretages af spilleren umiddelbart før kortgiveren i spillerækkefølgen.

---

# 3. Spillerækkefølge

Spilleren umiddelbart til venstre for kortgiveren betegnes her som **spiller 1**.

Derefter følger med uret:

- spiller 1
- spiller 2
- spiller 3
- spiller 4 (kortgiveren)

Denne rækkefølge bruges ved starten af meldingen.

---

# 4. Meldinger

## 4.1 Første melding

**Spilleren til venstre for kortgiveren starter altid meldingen.**

Denne spiller må ikke melde pas.

Den lavest mulige åbningsmelding er:

**7 almindelige**

Spilleren behøver ikke starte med 7 almindelige og må gerne starte med en højere melding.

---

## 4.2 Pas

Efter åbningsmeldingen må de øvrige spillere melde pas.

Når en spiller har meldt pas, er spilleren ude af meldingen resten af det pågældende spil.

Der gives derfor **ikke om**, blot fordi de øvrige spillere passer.

Eksempel:

- spiller 1: 7 almindelige
- spiller 2: pas
- spiller 3: pas
- spiller 4: pas

Spiller 1 vinder meldingen med 7 almindelige.

---

## 4.3 Melderækkefølge

Meldingen starter hos spiller 1 og fortsætter:

1. spiller 1
2. spiller 2
3. spiller 3
4. spiller 4

Der **meldes tilbage** mellem aktive bydere.

Det betyder, at to spillere melder mod hinanden, indtil den ene melder pas.

Den tilbageværende spiller fortsætter derefter mod den næste spiller i rækkefølgen.

Dette fortsætter, indtil kun den vindende melder er tilbage.

---

# 5. Tilgængelige meldinger

Der kan meldes:

- 7 almindelige
- 7 halve
- 7 gode
- 7 vip
- 8 almindelige
- 8 halve
- 8 gode
- 8 vip
- 9 almindelige
- 9 halve
- 9 gode
- 9 vip
- 10 almindelige
- 10 halve
- 10 gode
- 10 vip
- 11 almindelige
- 11 halve
- 11 gode
- 11 vip
- 12 almindelige
- 12 halve
- 12 gode
- 12 vip
- 13 almindelige
- 13 halve
- 13 gode
- 13 vip
- Sol
- Ren sol
- Bordlægger
- Super bordlægger
- Pas

Åbningsspilleren kan ikke melde pas.

---

# 6. Meldingshierarki

## 6.1 Numeriske meldinger

Ved samme antal stik er hierarkiet fra lavest til højest:

**Almindelige < Halve < Gode < Vip**

Eksempel:

**9 almindelige < 9 halve < 9 gode < 9 vip**

En højere numerisk melding slår alle meldinger på det foregående niveau.

Derfor gælder eksempelvis:

**9 vip < 10 almindelige**

Det betyder, at den næste spiller altid skal afgive en **højere melding** end den nuværende melding.

Man kan ikke overtage en identisk melding.

---

# 7. Specialmeldinger og hierarki

Specialmeldingerne rangerer:

**Sol < Ren sol < Bordlægger < Super bordlægger**

Derudover gælder følgende grænser:

## 7.1 Sol

Sol kan slås af:

**9 gode eller højere**

---

## 7.2 Ren sol

Ren sol kan slås af:

**10 gode eller højere**

---

## 7.3 Bordlægger

Bordlægger kan slås af:

**11 gode eller højere**

---

## 7.4 Super bordlægger

Super bordlægger er den højeste melding.

**Super bordlægger kan ikke slås af nogen anden melding.**

---

## 7.5 Flere specialmeldinger

Der kan kun være **én vinder af meldingen**.

Flere spillere spiller derfor ikke Sol, Ren sol, Bordlægger eller Super bordlægger samtidig.

Hvis spiller 1 eksempelvis melder Sol, skal spiller 2 overgå denne melding for fortsat at deltage.

Spiller 2 kan eksempelvis melde Ren sol.

Spiller 2 kan ikke blot "gå med" i spiller 1's Sol.

---

# 8. Almindelige

Ved meldingen **Almindelige** vælger melderen selv trumf.

Alle fire kulører kan vælges:

- klør
- ruder
- hjerter
- spar

Der skal vælges en trumf.

Almindelige kan altså ikke spilles uden trumf.

---

# 9. Halve

Ved **Halve** vælger melderen et makkeres.

Spilleren, der har makkeresset:

1. bliver melderens makker
2. vælger trumf
3. foretager bytningen

Trumfen må ikke være samme kulør som makkeresset.

Makkeren kan derfor vælge mellem de tre øvrige kulører.

---

## 9.1 Makkeresset ligger i bytterne

Hvis det valgte makkeres ligger blandt bytterne, er melderen:

**selvmakker**

Melderen vælger i dette tilfælde selv trumf.

---

# 10. Gode

Ved **Gode** er:

**Klør altid trumf.**

---

# 11. Vip

Ved **Vip** bestemmes trumfen ved at vende bytterne.

Kortene vendes **ét ad gangen**.

Melderen kan stoppe, når melderen ønsker det.

Det senest relevante vendte kort bestemmer trumfkuløren efter Vip-reglerne.

---

## 11.1 Første vendte kort

Hvis det første vendte kort eksempelvis er:

**7♥**

kan hjerter vælges som trumf.

Melderen kan også fortsætte med at vippe.

---

## 11.2 Joker efter et almindeligt kort

Hvis eksempelvis følgende vendes:

1. hjerter
2. joker

kan det foregående kort bruges til at bestemme trumf.

I dette eksempel bliver trumfen derfor hjerter.

**⚠️ AFKLARES:** Bekræft præcis jokeradfærd i denne situation.

---

## 11.3 Joker som første vendte kort

**⚠️ AFKLARES:** Det er endnu ikke endeligt besluttet, hvad der sker, hvis det allerførste kort, der vendes i Vip, er en joker.

Foreløbig mulighed:

Jokeren springes over, og næste bytter vendes.

Denne adfærd må ikke betragtes som endelig, før reglen er bekræftet.

---

## 11.4 Tre jokere

Hvis alle tre byttere er jokere:

**spilles der uden trumf.**

---

# 12. Bytning

En spiller kan bytte kort med bytterne efter reglerne for den pågældende kontrakt.

De kort, spilleren ønsker at aflevere, lægges fra hånden, og spilleren tager tilsvarende byttere op, så spilleren fortsat har 13 kort.

**⚠️ AFKLARES:** Det skal bekræftes, om en spiller frit kan vælge at bytte 0, 1, 2 eller 3 kort, eller om der gælder en "alt eller intet"-regel.

Foreløbig bør engine-arkitekturen kunne understøtte begge muligheder.

---

## 12.1 Bytning i Vip

Der skal byttes i Vip.

**⚠️ AFKLARES:** Det skal bekræftes, om spilleren kun skal tage de byttere, der faktisk er blevet vendt under Vip, eller om andre regler gælder.

Den foreløbige forståelse er:

**De vendte byttere skal tages.**

---

## 12.2 Kasserede kort

Kort, som en spiller afleverer under bytningen, bliver ikke nye byttere for andre spillere.

---

# 13. Valg af makker

I spil med makker vælger melderen et **makkeres**.

Spilleren, der har det pågældende es, bliver melderens makker.

---

## 13.1 Makker og trumf

Der må ikke meldes til det es, der har samme kulør som trumfen.

---

## 13.2 Tidspunkt for valg af makker

**⚠️ AFKLARES:** Det skal endeligt bekræftes, præcis hvornår makkeresset vælges i forhold til fastlæggelse af trumf og bytning.

Den foreløbige forståelse er, at trumf fastlægges først, hvorefter et lovligt makkeres vælges, og dette sker før bytningen.

Halve følger sine særlige regler.

---

# 14. Hvis der skal meldes til en konge

Hvis melderen har alle de esser, der ellers lovligt kunne kaldes, skal melderen i stedet kalde en **konge**.

Hvis melderen har alle fire esser, kan melderen vælge en lovlig konge.

Hvis melderen har de tre esser, der ikke er trumf, skal der ligeledes meldes til en konge.

---

## 14.1 Konge i bytterne

Hvis den kaldte konge ligger i bytterne, gælder samme princip som ved et makkeres i bytterne:

**Melderen bliver selvmakker.**

---

# 15. Selvmakker

Hvis det kaldte makkerkort ligger blandt bytterne, er melderen makker med sig selv.

Der spilles dermed:

**1 mod 3**

---

# 16. Hvornår afsløres makkeren?

I:

- Almindelige
- Gode
- Vip

er makkerens identitet skjult, indtil makkeresset bliver spillet.

I **Halve** bliver makkeren nødvendigvis kendt tidligere, fordi makkeren skal vælge trumf og foretage bytningen.

---

# 17. Makkeresset

Makkeresset skal falde første gang makkeressets kulør bliver spillet.

Dette gælder også, hvis makkeren selv spiller kuløren ud.

**⚠️ AFKLARES:** Hvis makkeren har både makkeresset og andre kort i samme kulør, skal det bekræftes, om makkeren altid er tvunget til at spille selve esset første gang kuløren spilles.

---

## 17.1 Makkeresset kan trumfes

Det er tilladt at trumfe det es, der er meldt til.

Hvis en spiller ikke kan bekende makkeressets kulør og ellers lovligt kan spille trumf, kan spilleren altså trumfe stikket.

---

# 18. Udspil

## 18.1 Første udspil

**Spilleren til venstre for kortgiveren spiller ALTID det allerførste kort i spillet.**

Dette gælder uanset:

- hvem der vandt meldingen
- hvem der er melder
- hvem der er makker
- hvilken kontrakt der spilles

Dette er en central regel.

---

## 18.2 Joker som første kort

**Det allerførste kort i spillet må aldrig være en joker.**

Spilleren til venstre for kortgiveren skal derfor vælge et ikke-jokerkort som spillets første kort.

Denne begrænsning gælder spillets første udspil.

Jokere kan senere spilles ud efter jokerreglerne.

---

# 19. Bekendelsespligt

Hvis en kulør bliver spillet ud, skal de øvrige spillere bekende kulør, hvis de kan.

Eksempel:

Hvis hjerter spilles ud, og en spiller har mindst ét hjerterkort, skal spilleren spille hjerter.

---

## 19.1 Renonce

Hvis spilleren ikke har den udspillede kulør, må spilleren frit:

- spille en anden kulør
- spille trumf
- spille en joker efter jokerreglerne

Der er **ingen tvungen trumf**.

---

# 20. Vinderen af et normalt stik

Hvis ingen trumf spilles, vinder det højeste kort i den udspillede kulør.

Hvis én eller flere trumfer spilles, vinder den højeste trumf.

Kort i andre ikke-trumfkulører kan ikke vinde stikket.

Jokere følger deres særlige regler.

---

# 21. Næste udspil

Vinderen af et stik spiller ud til det næste stik.

Dette fortsætter, indtil alle 13 stik er spillet.

---

# 22. Jokere

## 22.1 Joker spillet ud

Når en joker **spilles ud som første kort i et stik**, er jokeren et sikkert stik.

Spilleren, der spillede jokeren ud, vinder stikket.

Undtagelsen er spillets allerførste udspil, hvor en joker ikke må spilles.

---

## 22.2 Joker spillet på et eksisterende stik

Hvis en joker spilles efter, at en anden spiller allerede har spillet ud til stikket, er jokeren:

**værdiløs i forhold til at vinde stikket.**

Jokeren vinder altså ikke stikket.

---

## 22.3 Joker og bekendelsespligt

**⚠️ AFKLARES:** Den foreløbige forståelse er, at jokeren ikke har nogen kulør og derfor behandles særskilt i forhold til bekendelsespligten.

Det skal bekræftes præcist, hvornår en joker må spilles, hvis spilleren ellers kan bekende den udspillede kulør.

---

# 23. Kortenes rang – normale spil

I normale kontrakter er esset det højeste kort.

Fra højest til lavest:

**Es > Konge > Dame > Knægt > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2**

---

# 24. Kortenes rang – specialspil

I:

- Sol
- Ren sol
- Bordlægger
- Super bordlægger

er esset det laveste kort.

Fra højest til lavest:

**Konge > Dame > Knægt > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2 > Es**

---

# 25. Trumf i specialspil

**⚠️ AFKLARES:** Det skal præciseres, om Sol, Ren sol, Bordlægger og Super bordlægger spilles med eller uden trumf.

Dette må ikke gættes af implementeringen.

---

# 26. Sol

I Sol forsøger melderen at undgå stik.

Melderen vinder Sol ved at få:

**0 eller 1 stik**

Melderen bliver væltet, når melderen får sit:

**2. stik**

Sol er **1 mod 3**.

Der er ingen makker.

---

# 27. Ren sol

I Ren sol må melderen få:

**0 stik**

Hvis melderen får sit første stik, er Ren sol tabt.

Ren sol er **1 mod 3**.

---

# 28. Bordlægger

I Bordlægger må melderen få:

**0 stik**

Hvis melderen får sit første stik, er Bordlægger tabt.

Når melderen har spillet **sit første kort**, lægger melderen sine resterende kort åbent på bordet, så alle spillere kan se dem.

---

# 29. Super bordlægger

I Super bordlægger må melderen få:

**0 stik**

Alle spillere lægger deres kort åbent på bordet **inden det første udspil**.

De tre spillere, der spiller mod melderen, må tale sammen om:

- deres kort
- mulige udspil
- strategi
- hvordan de forsøger at vælte melderen

Super bordlægger er den højeste mulige melding og kan ikke overgås.

---

# 30. Information og fair play

Bots og coaching-systemet må kun bruge information, som den pågældende spiller lovligt kunne kende på det pågældende tidspunkt.

Dette omfatter:

- spillerens egen hånd
- tidligere spillede kort
- offentligt viste kort
- meldinger
- kendt trumf
- afsløret makker
- information, der logisk kan udledes af tidligere spil

Bots og coaching-systemet må ikke bruge skjulte modspillerkort til at træffe beslutninger.

---

# 31. Pointsystem

Whistzilla fører point.

Der beregnes ikke automatisk pengeværdi.

---

# 32. Stikværdi

Numeriske kontrakter har følgende stikværdi:

| Melding     |   7 |   8 |   9 |  10 |  11 |  12 |  13 |
| ----------- | --: | --: | --: | --: | --: | --: | --: |
| Almindelige |   1 |   2 |   4 |   8 |  16 |  32 |  64 |
| Halve       |   2 |   4 |   8 |  16 |  32 |  64 | 128 |
| Gode        |   2 |   4 |   8 |  16 |  32 |  64 | 128 |
| 1. Vip      |   3 |   6 |  12 |  24 |  48 |  96 | 192 |
| 2. Vip      |   4 |   8 |  16 |  32 |  64 | 128 | 256 |
| 3. Vip      |   6 |  12 |  24 |  48 |  96 | 192 | 384 |

Stikværdien fordobles altså for hvert trin fra 7 til 13.

Ved Vip afhænger stikværdien også af, hvor mange gange der er vippet.

---

# 33. Point ved vundet numerisk kontrakt

Når melderholdet gennemfører kontrakten, beregnes point som:

**Point = stikværdi × (antal vundne stik − 6)**

---

## 33.1 Eksempel

Der er meldt:

**9 Gode**

Stikværdien er:

**8**

Hvis melderholdet får 9 stik:

**8 × (9 − 6) = 24 point**

Hvis melderholdet får 10 stik:

**8 × (10 − 6) = 32 point**

Hvis melderholdet får 11 stik:

**8 × (11 − 6) = 40 point**

Man får altså også betaling for overstik.

---

# 34. Point ved tabt numerisk kontrakt

Når melderholdet ikke når det antal stik, der blev meldt, beregnes antallet af manglende stik:

**Manglende stik = meldt antal stik − faktisk antal stik**

Derefter beregnes tabet som:

**Tab = stikværdi × (manglende stik + 1)**

Resultatet registreres som negative point for det tabende hold.

---

## 34.1 Eksempel – ét stik fra

Der er meldt:

**9 Gode**

Stikværdi:

**8**

Melderholdet får kun:

**8 stik**

Der mangler 1 stik.

Tab:

**8 × (1 + 1) = 16 point**

---

## 34.2 Eksempel – to stik fra

Der er meldt:

**9 Gode**

Stikværdi:

**8**

Melderholdet får kun:

**7 stik**

Der mangler 2 stik.

Tab:

**8 × (2 + 1) = 24 point**

---

# 35. Fordeling af point i makkerspil

Ved et almindeligt spil med melder + makker mod to modspillere:

Hvis melderholdet eksempelvis vinder **32 point**:

- melder: +32
- makker: +32
- modspiller 1: −32
- modspiller 2: −32

Hvis melderholdet taber, vendes fortegnene tilsvarende.

Pointsystemet er dermed zero-sum i almindeligt makkerspil.

---

# 36. Selvmakker og point

**⚠️ AFKLARES:** Det skal bekræftes præcist, hvordan point fordeles ved selvmakker.

Foreløbig forventning:

Da én spiller spiller mod tre modspillere, modtager eller betaler selvmakker tre gange den normale pointværdi, mens hver modspiller modtager eller betaler én gang pointværdien.

Denne regel skal bekræftes før endelig implementering.

---

# 37. Point for specialmeldinger

Grundværdierne er:

| Specialmelding   | Point |
| ---------------- | ----: |
| Sol              |    16 |
| Ren sol          |    32 |
| Bordlægger       |    64 |
| Super bordlægger |   128 |

---

# 38. Tab af specialmelding

**⚠️ AFKLARES:** Det skal bekræftes, hvordan point beregnes, hvis melderen bliver væltet i:

- Sol
- Ren sol
- Bordlægger
- Super bordlægger

Den foreløbige antagelse er, at kontraktens normale pointværdi anvendes med modsat fortegn, men dette er **ikke endeligt bekræftet**.

Codex må derfor ikke låse den endelige pointberegning for tabte specialmeldinger, før reglen er afklaret.

---

# 39. Coaching og anbefalinger

Whistzilla skal senere kunne analysere:

- meldinger
- valg af trumf
- bytning
- hvert enkelt kortudspil

Anbefalingerne skal baseres på **praktisk stærk Whist-strategi**.

Systemet behøver ikke forsøge at opnå matematisk perfekt spil.

---

# 40. Coaching må ikke snyde

Når coaching-systemet vurderer et valg, må det kun anvende information, som spilleren havde adgang til på beslutningstidspunktet.

Det skal skelne mellem:

### Kendt information

Eksempelvis:

- egen hånd
- spillede kort
- kendt trumf
- offentligt viste kort

### Information spilleren kunne huske

Tidligere spillede kort må anvendes i analysen.

Dette er vigtigt, fordi kort-hukommelse er en del af at lære Whist.

### Infereret information

Systemet må foretage strategiske sandsynlighedsvurderinger ud fra spillets forløb.

### Skjult information

Modspillernes skjulte kort må **aldrig** anvendes som grundlag for en anbefaling.

---

# 41. Bot-strategi

Bots skal følge præcis samme informationsbegrænsninger.

En stærkere bot må være bedre til:

- kort-hukommelse
- sandsynlighedsvurdering
- strategisk inference
- meldinger
- trumfstyring
- samarbejde med makker
- vurdering af risiko
- planlægning af kommende stik

En stærkere bot må **ikke** blive stærkere ved at få adgang til skjulte kort.

---

# 42. Autoritativ regelkilde

Denne fil er den autoritative regelkilde for Whistzilla.

Hvis:

- kode
- kommentarer
- andre dokumenter
- eksterne Whist-regler
- tidligere prompts

er i konflikt med denne fil, gælder denne fil.

Codex må ikke automatisk indføre regler fra andre Whist-varianter.

---

# 43. Håndtering af uklare regler

Hvis Codex støder på en regel, der:

- mangler
- er tvetydig
- modsiger en anden regel
- er markeret `⚠️ AFKLARES`

må Codex ikke selv opfinde en permanent regel.

Codex skal i stedet:

1. identificere problemet
2. dokumentere det
3. bede om afklaring, hvis reglen er nødvendig for den aktuelle milepæl
4. først derefter implementere den endelige adfærd
5. tilføje automatiske tests for den afklarede regel

---

# 44. Åbne regelspørgsmål

Følgende regler mangler stadig endelig bekræftelse:

1. **Vip:** Hvad sker der, hvis den første bytter, der vendes, er en joker?
2. **Vip:** Bekræft præcis betydningen af en joker, der kommer efter et almindeligt vendt kort.
3. **Bytning:** Kan man frit bytte 0, 1, 2 eller 3 kort, eller gælder "alt eller intet"?
4. **Vip-bytning:** Skal alle vendte byttere tages op?
5. **Makkeres:** Præcis hvornår vælges makkeresset i forhold til trumf og bytning?
6. **Makkeres:** Er makkeren altid tvunget til at spille selve makkeresset første gang kuløren spilles, selv hvis makkeren har andre kort i kuløren?
7. **Joker:** Må en joker spilles i stedet for at bekende en kulør, som spilleren faktisk har?
8. **Specialspil:** Spilles Sol, Ren sol, Bordlægger og Super bordlægger med eller uden trumf?
9. **Selvmakker:** Bekræft den præcise pointfordeling ved selvmakker.
10. **Tabt specialmelding:** Bekræft pointberegningen ved tabt Sol, Ren sol, Bordlægger og Super bordlægger.

Disse spørgsmål bør afklares med spillergruppen senere.

Ingen af dem må gættes eller ændres stiltiende af implementeringen.
