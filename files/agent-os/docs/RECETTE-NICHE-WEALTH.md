# Recette de niche — Wealth (« <Lieu>'s $XXM Mansions Are Sliding Into the Ocean — And Nobody Can Stop It »)

Source : les **13 chaînes** fournies par Alex (Jenni Peterson, Sinking Fortunes, Mansion Meltdown, Wealth vs Nature, Trophy Liability, Global Weather Network, Luxury Edge, babyporcelana0979, jktim, Simon Uncovered, Simon Hammer, China Under Stress, Fault Line), scannées **en entier** par le Labo de niche (`scripts/niche-lab.js`, API Data YouTube : ~370 vidéos listées avec vues, durée, tags, description) et **4 vidéos par chaîne décortiquées image par image** (les 3 plus vues + la plus récente : téléchargement 480p, coupes FFmpeg, 1 image / 2 s, Qwen 3.7 Flash plan par plan, synthèse narrative Qwen 3.7 Plus). Données : `data/lab/`, miroir dans la Banque de Niches « Wealth » (`nmuchytyw`). Agrégat : `node scripts/niche-lab.js --niche Wealth --digest` ou encart 🔬 de la Banque.

## 1. Le format en une phrase

Une **enquête « faceless » de 15-25 min** sur une fortune immobilière identifiable (mansions d'un lieu précis, prix en millions) que **la nature ou un mécanisme humain rend invendable** (érosion, glissement, inondation, feu, sol artificiel, assurance qui se retire, loi qui interdit le mur). Voix off journalistique et froide, **b-roll de stock en alternance stricte opulence / destruction**, **chiffres chocs et aphorismes incrustés en gros sur l'image** (le code n°1), coupures de presse locales, cartes de section sobres, CTA à 1 min, conclusion fataliste avec une question. **Aucun avatar chez les concurrents** : le présentateur IA en lipsync est le différenciateur de notre machine.

Trois sous-familles dans la banque, même grammaire :
- **Mansions vs nature** (10 chaînes : Jenni Peterson, Sinking Fortunes, Mansion Meltdown, Wealth vs Nature, Trophy Liability, Luxury Edge, babyporcelana0979, Simon Uncovered, Simon Hammer, Fault Line) — le cœur de la niche.
- **Méga-projets / Chine qui s'effondrent** (jktim, China Under Stress) — même titre « … Is Already Falling Apart — Engineers Are Calling It a Scam », mêmes overlays, cible ingénierie.
- **Catastrophes en direct** (Global Weather Network, 30 k abonnés, 121 vidéos, jusqu'à 1,8 M vues) — actualité météo « LATEST UPDATES », capitales et chiffres de victimes ; hors machine, mais ses miniatures et titres montrent l'appétit du public pour le chiffre choc + le lieu.

## 2. Chiffres qui pilotent la machine (mesurés)

| Mesure | Valeur (**42 vidéos décortiquées**, 370 titres) | Réglage machine |
|---|---|---|
| Durée | 15-24 min, **médiane 19,2 min** (1 upload/jour, 9 à 121 vidéos par chaîne) | `durationMin` 20 (démo : 5) |
| Débit | **~172 mots/min** (sous-titres auto). Inworld lit à ~137 : le script est dimensionné sur le débit **réel** du TTS | `measuredWpm` (auto-mesuré), `wpm` 170 pour repère |
| Rythme visuel | **10,8 plans/min**, médiane **5 s** | `shotSeconds` 4,5 |
| Nature des plans | **stock vidéo 67 %**, photo 8 %, **texte plein écran 12 %**, graphique 5 %, capture d'écran 2 %, IA 5 % | `mixBroll` 80, `motionPct` 15 |
| Texte incrusté | **53 % des plans** portent un texte (chiffre, aphorisme, lieu, titre presse) | `overlayPct` 55, `lowerThirds` on |
| Caméra | fixe 58 %, pan droite 13 %, zoom in 13 %, zoom out 9 %, tilt/dolly 3 %, pan gauche 1 % | zoom/pan alternés, amplitude 10 % |
| Avatar | **1,4 %** (et ce sont des interviewés dans des extraits de JT, pas un présentateur) | hook ≤ 10 s + 2-3 passages de 10 s + CTA |
| Hook | 12-18 s, formule « walk-in » (voir §3) | outline `hook.verbatim` |
| CTA | **1 seul, à 1:00-1:30** (après le hook, avant l'enquête), 10-20 s | `ctaAfterSection` 1 |
| Sections | 7-9 blocs de 1,5-3 min | `sectionCount` = durée / 1,3 |
| Vues (chaînes) | moyennes 12 k → 149 k / vidéo ; top : Miami Star Island 487 k, Key Biscayne 420 k, Mar-a-Lago 403 k, Malibu hillside 358 k, Porsche Tower 286 k | — |

## 3. Narration (ce qu'il faut recopier)

1. **Hook « walk-in » (12-18 s)** : « *If you drive south on Highway 12 through Hatteras Island on a calm morning in the fall of 2026 and look east toward the Atlantic, you will see something that is not supposed to exist.* » / « *If you walk the private lane through Lagonita on a clear September morning past homes that last sold for 12, 18, $27 million, you will see something that does not appear in any of the listing photos.* » — deuxième personne, lieu précis, heure/saison, direction du regard, puis **l'anomalie en une image** et **les prix tout de suite**. Jamais « in this video ».
2. **Enquête en 7 temps** (ordre constant) : contexte/histoire du lieu et du marché → **mécanique** vulgarisée par une analogie (le gâteau d'argile, l'éponge, l'île qui migre) → événement déclencheur daté → **le piège** (loi 1977 anti-seawall, exclusion « earth movement », permis refusé, amende 1 M$, rachat public) → étude de cas nommée (Victoria Beach, Marguerite Drive, Sheep Pond Road) → **krach économique** (« the listing price says mansion, the buyer's spreadsheet says tear down ») → conclusion.
3. **Ton** : journalistique, analytique, froid, implacable, un peu cynique face à l'arrogance de l'argent ; mélange troisième personne / « you » ; phrases posées de 10-20 mots ; une question rhétorique par section maximum ; vocabulaire technique vulgarisé (coastal squeeze, ambulatory boundary, bentonite).
4. **Aphorismes** (1-2 par section, repris en texte incrusté) : « *The island migrates, the houses do not* », « *Nourishment is not a solution. It is a payment plan* », « *That is not a market. That is triage* », « *The trophies became liabilities* », « *Slowing is not stopping* », « *Pay enough and you get to live where the ocean used to be* ».
5. **Densité** : 2-4 chiffres / 100 mots — prix de vente successifs, pieds par an, pouces par semaine, % assurés (0 %), coûts de déménagement (400-800 k$), amendes, dates.
6. **Rétention** : boucle ouverte dès le titre (« nobody can stop it » → la vidéo passe 15 min à le prouver), **escalade de l'absurde** (déménager, murer, ensabler, assurer : chaque solution échoue), promesse différée, alternance de rythme (luxe calme / océan violent).
7. **CTA (1:00-1:30, une fois)** : « *If you enjoy long-form breakdowns of luxury real estate colliding with physics, engineering, and money… hit subscribe. It's free and it keeps the channel going.* »
8. **Conclusion** : fataliste et philosophique (« *It is not real estate. It is a process.* »), dernier chiffre, **question polarisante** pour les commentaires (« Should California make it easier to build seawalls, or protect the public beach? »).

## 4. Composition visuelle (relevé image par image)

### 4.1 Le b-roll
- **Alternance stricte** : opulence (drone sur mansions, piscines, yachts, intérieurs blancs, couchers de soleil) ↔ destruction/menace (vagues violentes, falaise qui cède, débris, tempête, fissures, inondation, pompes) — jamais trois plans du même registre.
- Extraits de **JT locaux** (KTLA, CBS LA, Fox 11, GMA) et captures d'articles pour crédibiliser (« preuve visuelle constante, éviter l'effet fake »).
- Ambiance : nuageux, crépusculaire, mer agitée ; lumière chaude réservée au luxe.
- Requêtes stock types : aerial mansion coastline, luxury house cliff, waves crashing seawall, beach erosion aerial, flooded street luxury cars, storm surge houses, construction crane coast, insurance documents desk, drone island estates, collapsed deck beach.

### 4.2 Le texte incrusté (le code n°1)
- Sur **53 % des plans**. **Sans-serif grasse** (Montserrat Black / Impact), blanc ou jaune, rouge pour l'alerte, sur bande sombre ou image assombrie. Animations sobres : fade, slide-up, typewriter, compteur.
- Trois familles : **kicker** = chiffre choc ou aphorisme en capitales (« $8 K / WEEK », « 32 TOTAL COLLAPSES SINCE 2020 », « 0% HAD LAND MOVEMENT INSURANCE », « THE ISLAND MIGRATES, THE HOUSES DO NOT ») ; **bandeau** = lieu/date/nom (« MARGUERITE DRIVE », « CAPE HATTERAS », « 1977 THE HARD CUTOFF DATE ») ; **titre presse** = manchette en capitales avec source (« OCEANFRONT HOMES RED-TAGGED AFTER STORM DAMAGE — CBS LOS ANGELES »).
- Cartes plein écran rares (5 %) : titre de section (« THE LAGUNA PROBLEM », « THE ZERO-SUM GAME ») ou liste de vulnérabilités (« RAIN FROM ABOVE / TIDE FROM THE SIDE / GROUNDWATER FROM BELOW ») ; petits graphiques (largeur de plage −50 %, odds El Niño 90 %).

### 4.3 La caméra
Plans **fixes majoritaires** (« pour laisser le texte respirer »), **pan droite** pour révéler l'étendue de la côte, **zoom arrière** pour révéler, **zoom avant** pour dramatiser un dégât. Amplitude faible.

### 4.4 Titres, miniatures, packaging
- **Titre** (150 relevés) : `<Lieu>'s $<N>M <Homes|Mansions|Estates> Are <Sliding|Falling|Washing|Sinking|Crumbling|Going> Into <the Ocean|the Sea|Underwater> — And <Nobody|Owners|the State|California> <Can't Stop It|Won't Help|Can't Save Them>`. Variantes : « … Lost Their Seawalls — And Nobody Can Stop It », « Two Hurricanes Buried Casey Key's $20M Homes — Now the State Won't Help », « … Is Sinking Into the Ocean — And Nobody Can Stop It » (tours), « … Is Already Falling Apart — Engineers Are Calling It a Scam » (Chine). Toujours un tiret cadratin, 60-95 caractères.
- **Miniature — le code le plus strict de la niche** (relevé sur les 8 miniatures les plus vues des chaînes « mansions » : Luxury Edge, Trophy Liability, Jenni Peterson, babyporcelana) :
  1. **Fond** : une **vue aérienne drone** photoréaliste, toujours. Une propriété de luxe clairement lisible en péril immédiat — eau jusqu'aux fenêtres, falaise effondrée sous la terrasse, vague géante qui explose contre la propriété, carcasse brûlée. Luxe ET menace visibles d'un seul coup d'œil (piscine, verre, colonnes, palmiers / eau gris-vert, terre à nu, écume, débris). Ciel de tempête, palette froide désaturée, fort contraste. Aucun personnage, aucune flèche, aucun emoji, aucun cadre.
  2. **Bandeau « BREAKING » incrusté en bas à gauche, sur deux lignes** :
     - ligne 1 : étiquette **rouge « BREAKING »** + boîte **blanche** avec le **LIEU en noir** (« MIAMI », « KEY BISCAYNE », « MALIBU », « PALOS VERDES », « NEWPORT », « LAGUNA BEACH », « OUTER BANKS ») ;
     - ligne 2 : boîte **blanche** avec **2-3 mots en noir ultra-gras condensé** (Impact) : « MIAMI ALERT », « ALMOST GONE », « MALIBU ALERT », « MANSIONS SLIDING », « MANSION COLLAPSE », « OUTER BANKS ALERT ». Jamais de ponctuation, jamais de chiffre.
  3. **Le texte n'est JAMAIS demandé au modèle d'image** (aucun générateur n'écrit proprement) : la machine génère le fond sans texte, puis compose le bandeau avec la composition Remotion `WealthThumb` (`npx remotion still`). Le quart bas-gauche du fond est volontairement gardé « simple » (eau, sol, écume) pour que le bandeau se détache.
  4. Les **références i2i** sont les miniatures concurrentes **du bon format** — filtrées sur « un montant en dollars + un verbe de chute » dans le titre, sinon le top de la banque est trusté par les chaînes météo dont le code visuel n'a rien à voir.
- **Description** : récit chiffré en un paragraphe, question, abonnement, disclaimer (approximations, stock + IA).
- **Tags** : lieux, « luxury real estate », « coastal erosion », « uninsurable homes », « rich people problems », « expensive mistakes », « natural disaster ».

## 5. Ce qui fait monter les vues

- Le **lieu célèbre + le chiffre** : Miami/Star Island (487 k), Malibu (358 k), Key Biscayne (420 k), Mar-a-Lago (403 k), Palos Verdes (246 k), Newport (205 k). Les lieux secondaires (Watch Hill 14 k, Naples 6 k) plafonnent.
- Le **retournement institutionnel** dans le titre (« California Won't Help », « the City Cut Their Power », « Insurers Are Walking Away », « the $8M Fix Failed »).
- La **récence** : ces chaînes ont 1-4 mois, 1 vidéo/jour, 10-20 vidéos → 12 k à 149 k vues moyennes. Le format est en fenêtre.
- Ce qui marche moins : les sujets sans somme au titre, les lieux inconnus, les vidéos sans retournement.

## 6. Traduction en machine (`wealth`)

| Élément | Implémentation |
|---|---|
| Input | sujet (cas + lieu + angle, ou 💡 idée tirée de la banque), avatar (onglet Avatars), langue + moteur de voix + voix, durée, parité b-roll/IA, % motion, % textes incrustés, passages avatar, intro face caméra, musique, sous-titres, modèle IA, mode, publication |
| Script | 1 outline (titre à la formule, hook walk-in verbatim, N sections avec beat/faits/chiffre-clé/`avatar`, idée de miniature) → sections écrites en parallèle (5), CTA canonique inséré après la section 1 |
| Voix | Inworld (défaut) ou ElevenLabs v3 par section → concat → Whisper mot-à-mot → découpage sur le sens (cible 6 s) |
| Plan visuel | carte de titre 3 s par section (sauf hook) ; avatar = les **10 premières secondes maximum** du hook, du CTA et des N sections marquées (coupe sur une fin de phrase, jamais plus — consigne Alex), le reste en plans |
| Direction visuelle | Claude par section : b-roll / IA / motion + 3 requêtes Pexels concrètes + caméra + overlay {kicker ⅔, lower, headline} avec alternance opulence/destruction ; motion **poussé** : `dossier` (chemise CONFIDENTIAL + photo agrafée + fiche dactylographiée + tampon) pour présenter un lieu/bien/personne, `compare` (avant/après côte à côte), stat, list, quote ; `rebalance()` impose les parts réglées |
| Assets | Pexels avec **boucle de vérification Qwen 3.7 Flash** (3 images du clip notées 0-10 face à la description et au texte dit ; rejet < 6 : texte/logo, portrait, hors sujet, personne qui parle → candidat suivant, requête suivante, photo, puis IA ; jusqu'à 6-8 candidats, ~0,001 $ chacun), Kie t2i (style photoréaliste cinéma, prompts adaptés si refus), photos de dossier vérifiées de la même façon, Remotion `WealthMotion` (toutes les cartes en une passe, images copiées dans `remotion/public/<run>/`), lipsync `veed/lipsync` sur la tranche exacte de la voix, Suno |
| Montage | FFmpeg : zoompan (zoom+/pan→/zoom−/pan← alternés, amplitude 10 %) sur vidéo et image, boucle si b-roll court, concat, garde de durée, voix + musique 12 %, overlays PNG à l'instant voulu, bouton CTA, sous-titres optionnels |
| Packaging | titre à la formule, description codée, tags, miniature i2i ancrée sur les miniatures concurrentes top-vues |

## 7. Vidéos produites par la machine (contrôle)

| Run | Sujet | Durée | Coût | Plans | b-roll / IA / motion | Textes incrustés | Vérif. b-roll |
|---|---|---|---|---|---|---|---|
| `wmucir9gu` | Nantucket, $2,3 M vendue $200 K | 5:54 | 1,28 $ | 50 | 58 / 26 / 16 % | 0 (bug corrigé depuis) | — |
| `wmucl8nj3` | Pacific Palisades, assureurs partis avant le feu | 5:00 | 0,84 $ | 40 | 58 / 33 / 10 % | 16 planifiés, perdus au montage (bug Windows) | 6,3/10 |
| `wmucmoc6g` | **Sylt, l'État rachète la plage chaque année** | **5:04** | **0,73 $** | 44 | **70 / 18 / 11 %** | **24 (55 %)** | **6,6/10, 1 sous seuil** |

La troisième est la référence : toutes les briques y sont à l'image (avatar en décor de bureau ≤ 10 s, cartes de section, chiffres animés, aphorismes et bandeaux incrustés, bouton d'abonnement, musique, miniature au code concurrent).

## 8. État du scan — TERMINÉ

Scan complet le 22 septembre 2026 : **13 chaînes**, 370 vidéos listées, **48 vidéos téléchargées et décortiquées image par image** (42 avec synthèse narrative complète), **9 744 plans analysés**, 146 000 mots de transcript. Durée : 3 h 32. **Coût total : 0,92 $.**

Les chiffres du §2 sont l'agrégat de ce scan. Pour les recalculer après un ajout de chaîne :

```bash
node scripts/niche-lab.js --niche "Wealth" --digest
```

Ils s'affichent aussi dans l'encart 🔬 de la Banque de Niches (page Banque → niche Wealth).
