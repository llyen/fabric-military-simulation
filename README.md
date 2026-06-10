# 🎖️ fabric-military-simulation

**Real-time 3D digital twin Poligonu Drawsko Pomorskie** zbudowany na
**Microsoft Fabric** poprzez [Project Rayfin](https://github.com/microsoft/rayfin)
(Backend-as-a-Service for the agentic era).

Towarzyszy [`fabric-military-demo`](../fabric-military-demo) — bierze ten sam
fikcyjny scenariusz **OPERATION IRONSHIELD** i pokazuje go nie jako tabelę KQL,
tylko jako **żywą scenę 3D** z proceduralnym terenem, sektorami, pojazdami,
żołnierzami, dronami, trackami radarowymi, dynamiczną pogodą i cyklem dzień/noc.

> ⚠️ **Disclaimer** — całość jest fikcją technologiczną stworzoną w celach
> edukacyjnych i demonstracyjnych. Wszystkie dane są generowane proceduralnie.

---

## ✨ Co tu zobaczysz

- 🌍 **Proceduralny teren 16 × 16 km** wokół Drawska Pomorskiego (simplex noise,
  shading per-vertex: trawa / las / błoto / skała / śnieg na grani).
- 🟢🟡🔴🔵 **Sektory Alpha / Bravo / Charlie / Delta** — kolorowane wg roli
  (rear / forward / contested / observation), z bardzo subtelnymi półprzezroczystymi
  kopułami i etykietami billboardowanymi.
- 🛡️ **~21 pojazdów Blue Force** — szczegółowe modele 3D:
  - **BWP Borsuk** — kadłub + przesuwająca się tekstura gąsienic + obrotowa wieża z lufą
  - **Rosomak 8×8** — kołowy z animowanymi obrotami kół i kolejnymi parami osi
  - **Krab 155 mm** — haubica samobieżna z dużą wieżą + długą lufą + hamulcem wylotowym
  - Każdy: pył spod kół przy jeździe, antena, pip statusu, persistent heading + płynne skręty.
- 🪖 **~54 żołnierzy** jako pełne humanoidalne figurki — hełm, kamizelka taktyczna,
  karabin, animacja chodu (`walking` / `running`), pozycja `prone` (taktyczne kładzenie się
  w kontestowanych sektorach), `down` (ranni — czerwony hełm + alert MEDEVAC w feedzie).
  Kolor munduru zmienia się wraz z poziomem stresu (HR-driven).
- 🚁 **4 drony ISR** ze szczegółowymi modelami:
  - **FlyEye** — bezzałogowiec ze stałym płatem (kadłub, podwójny boom ogonowy, śmigło,
    gimbal kamery, lampki nawigacyjne); banuje w zakrętach.
  - **Warmate** — amunicja krążąca X-quad z 4 wirującymi rotorami + głowicą bojową.
  - Gdy `observationType=target_lock` → pulsująca aureola + opadający stożek sensora.
- 📡 **Tracki radarowe** — wrogie/nieznane spawnują się w fazie *Detection*: pulsujący
  pierścień na ziemi + obracający się octahedron (ikona zagrożenia).
- 🔵 **Detection lines** — przerywane cyan linie od najbliższego sojuszniczego drona
  do każdego trackingu (visualizacja: który sensor obserwuje cel).
- 🔴 **Threat lines** — czerwone przerywane linie od najbliższego pojazdu Blue Force
  do każdego wrogiego trackingu (instant threat picture).
- 🎯 **Dekoracje poligonu** (`PoligonProps.tsx`):
  - **~1800 drzew** instanced (pień + korona) rozmieszczone na bazie maski lasu
  - **Drogi gruntowe** jako płaskie wstęgi przylegające do terenu (Catmull-Rom + perpendicular ribbon)
  - **Bunkry** z workami z piaskiem i siatką maskującą, na linii kontaktu
  - **Wieże obserwacyjne** w sektorze Delta (4 nogi, X-bracing, dach, lampa ostrzegawcza)
  - **Tor strzelecki** z sylwetkami typu E + ziemnym bermem
  - **Helipad** z literą "H" w Alpha
  - **Koszary** z masztem flagowym i polską flagą biało-czerwoną
  - **Kratery po wybuchach** (skupisko w Bravo + rozproszone)
- 🌦️ **Dynamiczna pogoda** — mgła per sektor, wiatr, w fazie *Logistics*
  pojawia się deszcz.
- 🌅 **Cykl dzień/noc** — kolor nieba, intensywność słońca, mgła wieczorna, gwiazdy nocą.
- 🖥️ **HUD** — zegar misji, T+, licznik zagrożeń, status sektorów,
  ticker zdarzeń (threat / medevac / logistics / ew / info), legenda,
  **panel sterowania prędkością symulacji** (pauza, slider 0–8×, presety).

---

## 🏗️ Architektura

```
┌──────────────────────┐        ┌─────────────────────────┐
│  fabric-military-    │        │ rayfin/                 │
│  demo (JSONL seed)   │ seed→  │  rayfin.yml             │
│  generate_datasets   │        │  data/                  │
│  .py                 │        │   ├ Sector.ts           │
└──────────────────────┘        │   ├ Vehicle.ts          │
                                │   ├ Soldier.ts          │
                                │   ├ Drone.ts            │
                                │   ├ RadarTrack.ts       │
                                │   ├ WeatherCell.ts      │
                                │   └ SimEvent.ts         │
                                └────────────┬────────────┘
                                             │  rayfin up
                                             ▼
                          ┌────────────────────────────────────┐
                          │  Microsoft Fabric                  │
                          │   • SQL DB (auto-provisioned)      │
                          │   • Data API (GraphQL/REST)        │
                          │   • Auth (Fabric SSO)              │
                          │   • Static hosting                 │
                          └────────────┬───────────────────────┘
              simulator/simulator.ts ──┤              ▲
              (Node, 1 Hz tick)        │              │ poll 1 Hz
                                       ▼              │
                          ┌────────────────────────────────────┐
                          │  React + Vite + Three.js (R3F)     │
                          │   ├ Terrain (simplex noise)        │
                          │   ├ PoligonProps (las, drogi…)     │
                          │   ├ SectorOverlay                  │
                          │   ├ Vehicles / Soldiers / Drones   │
                          │   ├ RadarTracks                    │
                          │   ├ ThreatLines + DetectionLines   │
                          │   ├ Sky (day/night + fog)          │
                          │   └ HUD + SpeedControl             │
                          └────────────────────────────────────┘
```

---

## 📁 Struktura

```
fabric-military-simulation/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── rayfin/
│   ├── rayfin.yml                # Fabric services config (auth + data + static)
│   ├── tsconfig.json
│   └── data/
│       ├── schema.ts             # Re-exports all entities
│       ├── Sector.ts             # 4 sektory poligonu
│       ├── Vehicle.ts            # Pojazdy Blue Force
│       ├── Soldier.ts            # Żołnierze + biometria
│       ├── Drone.ts              # FlyEye / Warmate
│       ├── RadarTrack.ts         # Wrogie/nieznane tracki
│       ├── WeatherCell.ts        # Pogoda per sektor
│       └── SimEvent.ts           # Append-only event log
├── simulator/
│   ├── simulator.ts              # Pętla 1 Hz → Rayfin (live)
│   ├── world.ts                  # Headless model (mirror mockSim.ts)
│   └── seed.ts                   # Import ../fabric-military-demo/datasets
└── src/
    ├── main.tsx
    ├── main.css
    ├── App.tsx
    ├── types.ts                  # Shapes (bez decoratorów) — używane wszędzie
    ├── data/
    │   └── sectors.ts            # Stałe geo zgodne z generate_datasets.py
    ├── utils/
    │   ├── geo.ts                # lat/lon ↔ world meters
    │   └── terrain.ts            # simplex heightmap (seed=42)
    ├── services/
    │   ├── rayfinClient.ts       # Singleton + auto-fallback do mocka
    │   └── mockSim.ts            # In-browser symulator 4× speed
    ├── hooks/
    │   └── useBattlefield.ts     # Polling Rayfin LUB subscribe na mock
    └── scene/
        ├── BattlefieldScene.tsx  # R3F Canvas, kamera, OrbitControls
        ├── Terrain.tsx           # Heightmap + vertex colors
        ├── SectorOverlay.tsx     # Subtelne kopuły + etykiety billboardowe
        ├── PoligonProps.tsx      # Las, drogi, bunkry, wieże, helipad, koszary, kratery
        ├── Vehicles.tsx          # BWP / Rosomak / Krab — szczegółowe modele
        ├── Soldiers.tsx          # Humanoidalne figurki z animacją chodu
        ├── Drones.tsx            # FlyEye (fixed-wing) / Warmate (X-quad)
        ├── RadarTracks.tsx       # Pingi naziemne + ikona-octahedron
        ├── ThreatLines.tsx       # Czerwone linie hostile→Blue Force
        ├── DetectionLines.tsx    # Cyan linie drone→radar track
        ├── Sky.tsx               # Dzień/noc, mgła, słońce/księżyc
        ├── HUD.tsx               # Overlay 2D
        └── SpeedControl.tsx      # Pauza + slider prędkości symulacji
```

---

## 🚀 Szybki start

### 1. Tryb mock (offline, zero zależności od Fabric)

Idealny do prezentacji „na sucho" — symulator działa w przeglądarce.

```bash
cd fabric-military-simulation
npm install
npm run dev:mock
```

Otwórz <http://localhost:5173>. Po ~1 min misji pojawią się hostile tracks
w sektorze Bravo, po ~3 min Blue Force ruszy do kontaktu.

### 2. Tryb Fabric (pełny digital twin)

Wymaga workspace w Microsoft Fabric oraz zainstalowanego CLI Rayfin.

```bash
cd fabric-military-simulation
npm install
npx rayfin up                        # provisioning DB, Auth, Data API, hosting
npm run simulate:seed                # (opcjonalnie) zasiej z fabric-military-demo
npm run simulate &                   # pętla 1 Hz pisząca do Rayfin
npm run dev                          # frontend + auto env z `rayfin env`
```

> ℹ️ **Seed i symulacja na hostingu Fabric** — backend hostowany w Fabric pozwala
> wyłącznie na Fabric SSO (brokered, przeglądarkowy), więc encji z
> `@role('authenticated')` nie da się zapisać headless przez Data API
> (`simulate:seed` / `simulate` używają email+hasło lub session JWT). Zamiast tego:
>
> - `npm run simulate:seed:sql` — **statyczny** seed (Sectors + WeatherCells z
>   definicji świata oraz Vehicles/Soldiers/Drones z `../fabric-military-demo/datasets`)
>   pisany **wprost do bazy SQL Fabric** tokenem Entra, z pominięciem Data API.
> - `npm run simulate:sql` — **żywa** symulacja: seeduje proceduralny świat
>   (sektory, pojazdy, żołnierze, drony, pogoda), a następnie co tick przesuwa
>   obiekty i dopisuje tory radarowe wprost do SQL. To jest sposób na „działającą”
>   symulację (ruch obiektów) na hostingu Fabric — `npm run simulate` (Data API)
>   jest tam blokowany przez Fabric SSO. Zostaw proces uruchomiony, a aplikacja
>   (poll co 1 s) pokaże ruch na żywo.
>
> Wymagane raz: `az login --tenant <fabricTenantId>` oraz wcześniejszy `rayfin up`
> (tworzy `rayfin/.deployments.json`). `simulate:seed` / `simulate` (password auth)
> działają w lokalnym `rayfin up` dev.

Front automatycznie poll'uje Rayfin co 1 s (`useBattlefield.ts`); sceny
i HUD aktualizują się w żywo. Brak zmiennych `VITE_RAYFIN_*` → graceful
fallback do mocka (z ostrzeżeniem w konsoli).

### 3. Deploy do Fabric (statyczny hosting)

```bash
npm run build:fabric
npx rayfin up                        # zsynchronizuje także dist/ na hosting
```

URL aplikacji znajdziesz w outpucie `rayfin up`.

---

## 🎮 Sterowanie

| Akcja                      | Skrót / Element UI                          |
| -------------------------- | ------------------------------------------- |
| Obrót kamery               | LPM + drag                                  |
| Pan                        | PPM + drag (lub Shift + LPM)                |
| Zoom                       | Scroll                                      |
| Pauza / wznowienie         | Przycisk ▶ / ❚❚ w panelu SIM CONTROL (PD)   |
| Prędkość symulacji         | Slider w panelu SIM CONTROL: 0×, ½×, 1×, 2×, 4×, 8× |
| Reset (mock)               | Twardy reload (Ctrl+Shift+R)                |

---

## 🎬 Scenariusz fazowy

Symulator (zarówno mock w przeglądarce, jak i Node) odwzorowuje fazy z
oryginalnego scenariusza IRONSHIELD:

| T+ minuty | Faza         | Co widać w wizualizacji                                |
| --------- | ------------ | ------------------------------------------------------ |
| 0–1       | Normal       | Patrol; drony krążą, sektory zielone                   |
| 1–3       | Detection    | Spawn hostile tracks w Bravo, czerwone pingi + alerty  |
| 3–6       | Engagement   | Pojazdy Blue ruszają, drony przechodzą w `target_lock` |
| 6–9       | BDA          | Tracki znikają (attrition), liczniki maleją            |
| 9+        | Logistics    | Konwój, deszcz, alerty paliwo/amunicja                 |

W trybie mock 1 minuta misji = ~15 s wall-clock (TICK_MS = 250, SIM_DT = 1 s).

---

## 🔌 Jak to się ma do `fabric-military-demo`?

| `fabric-military-demo`                              | `fabric-military-simulation`                           |
| --------------------------------------------------- | ------------------------------------------------------ |
| Real-Time Intelligence (Eventstream → KQL → RTD)    | Digital twin / wizualizacja 3D na bazie Fabric (Rayfin) |
| Generuje statyczne JSONL dla 7 strumieni            | Czyta te JSONL przez `simulate:seed` i animuje w 3D    |
| Demo *„jak Fabric agreguje dane sensoryczne"*       | Demo *„jak te dane mogą wyglądać dla operatora"*       |
| Setup w Fabric Workspace (lakehouse + eventhouse)   | Setup w Fabric przez `rayfin up` (DB + API + hosting)  |

Te dwa repo są komplementarne — jedno pokazuje warstwę **danych**, drugie
warstwę **prezentacji** dla tej samej fikcyjnej operacji.

---

## 📜 Licencja

[MIT](../fabric-military-demo/LICENSE) — taka sama jak `fabric-military-demo`.
