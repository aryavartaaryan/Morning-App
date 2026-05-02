# OneSutra — Dinacharya System Prompt (v4)
## Grounded in the actual codebase timing engine

---

## THE TIMING ENGINE (do not override this)

All habit times in OneSutra are **dynamic**, not fixed. Three rules govern every time window:

### Rule 1 — User Wake Time Selection
During onboarding, the user is shown **3 cards to pick their personal wake time**. The same 3 card labels appear for every Prakriti, but the **actual time shown on each card is personalized to the user's location** (via GPS Brahma Muhurta calculation):

| Card | Badge | Without GPS (default) | With GPS (location-aware) |
|------|-------|----------------------|--------------------------|
| **Best Time** `brahma_sadhak` 🕉️ | ✦ BEST TIME (gold) | 4:00 AM | Exact Brahma Muhurta for their city |
| **Better Time** `prana_riser` ⚡ | ◈ BETTER TIME (purple) | 5:00 AM | Brahma Muhurta start + 60 min |
| **Good Start** `sunrise_grace` 🌅 | ○ GOOD START (green) | 6:00 AM | Actual local sunrise time |

**Every user's time is their own.** A user in Mumbai and a user in Delhi will see different times on the exact same 3 cards because Brahma Muhurta and sunrise differ by location. The user taps one card → that exact time becomes their wake time and drives their entire morning Dinacharya schedule.

**How morning habits shift from the chosen wake time:**
Each Prakriti plan has a built-in default wake (Kapha: 5:15 AM, Pitta: 5:45 AM, Vata: 6:00 AM). The code computes the difference between the plan default and the user's chosen time, then shifts all morning habits by that delta:

```
shift = userChosenWakeMin − prakritiDefaultWakeMin
all morning habits move by shift (positive = later, negative = earlier)
```

Examples:
- **Vata** user (plan default 6:00 AM) picks **Best Time at 4:12 AM** → morning habits shift **−108 min**
- **Kapha** user (plan default 5:15 AM) picks **Good Start at 6:05 AM** → morning habits shift **+50 min**

**This means morning habit ideal times are also ultimately solar-derived:**
```
Location GPS
  → actual sunrise & Brahma Muhurta (solar)
    → wake card times personalized (solar)
      → morning habit delta shift (solar)
        → ideal meditation / cleanse / walk / breakfast times (solar)
```
Afternoon and evening habits are anchored to solar noon and sunset directly — no wake delta involved.

### Rule 2 — Solar Anchor (afternoon + evening)
The following habits are anchored to actual geographic solar noon and sunset, not a clock:

| Habit | Anchor |
|-------|--------|
| `breakfast` | Sunrise + 2 hrs → + 3 hrs |
| `lunch` | Solar noon − 15 min → + 60 min |
| `walk` (Shatapavali) | Solar noon + 15 min → + 90 min |
| `herbal_tea` | Sunset − 150 min → − 60 min |
| `evening_walk` | Sunset − 60 min → + 30 min |
| `dinner` | Sunset + 60 min → + 150 min |
| `screen_free` | Sunset + 120 min → + 210 min |
| `journaling` | Sunset + 150 min → + 210 min |
| `sleep` | Sunset + 210 min → + 300 min |

### Rule 4 — Window Overlap & Solar Slot Boundary (ALL SLOTS)

Individual habit windows are **ideal targets — not lockout gates.**
This flexibility applies to **every habit in every solar slot — morning, midday, evening, and night.**

The real philosophy:
→ Dinacharya is a continuous flow across the day, not a series of rigid alarms.
→ The user has full flexibility to complete habits within their solar slot window.
→ Habits within the same slot can overlap in time — expected and valid.
→ Running late in sequence is fine — complete them one after another.
→ The solar slot boundary is the only hard expiry.

**What the individual habit window does:**
→ Shown on card as "Ideal: HH:MM – HH:MM" so user always knows the best time
→ Drives the "On Time" / "Early" / "Late" timing chip
→ Does NOT lock or expire the habit while the solar slot is still active

**What the solar slot boundary shows on card:**
→ Shown below the ideal time as "Open until HH:MM" in dimmed text
→ User always knows exactly how much flexibility they have
→ Turns amber/orange as the slot boundary approaches

**What the solar slot boundary does (HARD EXPIRY):**
→ Once the slot ends, all unlogged habits in that slot become ❌ Missed
→ This applies equally to morning, midday, evening, and night slots

```
SOLAR SLOT BOUNDARIES (Katihar today — sunrise 5:08, noon 11:38, sunset 6:08):

BRAHMA MUHURTA  → hard expiry: sunrise (5:08 AM)
MORNING         → hard expiry: solar noon − 2 hrs (9:38 AM)
MIDDAY          → hard expiry: solar noon + 2 hrs (1:38 PM)
EVENING         → hard expiry: sunset + 2.5 hrs (8:38 PM)
NIGHT           → hard expiry: sunset + 5 hrs (11:08 PM in Katihar today)
```

**Examples across all slots — Katihar today:**

```
MORNING SLOT (hard expiry 9:38 AM):
  Ideal meditation window: 5:58–6:38 AM
  User meditates at 8:50 AM → "Late" chip, counts ✓
  User meditates at 9:45 AM → ❌ Missed (slot ended)

MIDDAY SLOT (hard expiry 1:38 PM):
  Ideal lunch window: 11:23 AM–12:38 PM
  User eats lunch at 1:20 PM → "Late" chip, counts ✓
  Ideal Shatapavali (post-lunch walk): 11:53 AM–1:08 PM
  User walks at 1:30 PM → "Late" chip, counts ✓
  User walks at 1:50 PM → ❌ Missed (slot ended)

EVENING SLOT (hard expiry 8:38 PM):
  Ideal herbal tea window: 3:30–4:30 PM
  User has tea at 7:00 PM → "Late" chip, counts ✓
  Ideal evening walk: 5:08–6:38 PM
  User walks at 8:00 PM → "Late" chip, counts ✓
  User walks at 8:45 PM → ❌ Missed (slot ended)

NIGHT SLOT (hard expiry: sunset + 5 hrs = 11:08 PM Katihar):
  Ideal dinner: 7:08–8:38 PM
  User eats at 9:30 PM → "Late" chip, counts ✓
  User eats at 11:30 PM → ❌ Missed (slot ended — harmful to health)

  Ideal screen-free: 8:08–9:48 PM
  User goes screen-free at 10:30 PM → "Late" chip, counts ✓
  User goes screen-free at 11:20 PM → ❌ Missed (slot ended)

  Ideal sleep: 9:38–10:48 PM (Katihar: sunset+210→+300)
  User sleeps at 11:00 PM → "Late" chip, counts ✓
  User sleeps at 11:15 PM → ❌ Missed (slot ended)

  Ayurvedic reason: Eating or staying awake after sunset+5 hrs
  destroys the Pitta repair window (10 PM–2 AM) and creates Ama.
  No flexibility beyond this point — health discipline is non-negotiable.
```

**Timing chip logic on every card across all slots:**
```
"Early"   → logged before window start
"On Time" → logged within window start–end
"Late"    → logged after window end, but before solar slot boundary
"Missed"  → solar slot ended and habit was not logged
```

### Rule 3 — Active Slot Detection
The current active time slot is determined by both solar phase and clock time:

| Slot Key | Condition |
|----------|-----------|
| `brahma` | sunrise − 1.6 hrs → sunrise |
| `morning` | sunrise → solar noon − 2 hrs |
| `midday` | solar noon − 2 hrs → solar noon + 2 hrs |
| `evening` | solar noon + 2 hrs → sunset + 2.5 hrs |
| `night` | sunset + 2.5 hrs → sunset + 5 hrs |

---

## CORE PHILOSOPHY

**5 core logs = streak engine. Everything else = Bodhi recommendations.**

Only 5 habits protect the daily streak by default. All other habits appear as zero-pressure Bodhi recommendations. The user can **upgrade** any recommendation to their personal streak with one tap — it then sits alongside the 5 cores in the streak engine. Downgrade anytime back to recommendation.

---

## THREE LAYERS WHERE THESE RULES APPLY

All timing, solar, flexibility, and upgrade rules described in this prompt operate across **three distinct app layers**. Each layer has a specific role:

---

### LAYER 1 — Post-Prakriti Recommendation Screen (Onboarding)

Appears immediately after the Prakriti quiz is completed.
Bodhi presents the user's personalised Dinacharya plan for the first time.

What is shown here:
→ The 5 Core Streak habits explained — gold border, streak-critical
→ Bodhi recommendations tailored to the user's Prakriti
→ Ideal times for each habit already personalised (Prakriti plan default)
   (Solar personalisation happens after location is granted — if not yet granted,
    defaults are used and updated silently when GPS is available)
→ Each habit shows its Prakriti-specific Ayurvedic reason
→ User can tap ⬆ Add to Streak on recommendations right here
→ No solar slot boundary pressure — this is an introduction, not a live tracker

---

### LAYER 2 — Habit Page (Settings / Habit Management)

The static management view. User can visit anytime.

What is shown here:
→ All 5 core habits (gold border) — can never be removed
→ All user-upgraded habits (green border + "My Habit" tag) — can be downgraded
→ All Bodhi recommendations (teal border) — can be upgraded to streak
→ Upgrade / Downgrade flows triggered from here
→ Per-habit alert toggles (turn on/off individual expiry notifications)
→ No live timing or solar data shown here — this is management only
→ Ideal times shown as static Prakriti defaults (not live solar)

---

### LAYER 3 — Daily Dinacharya Page (Home Screen — Live Solar)

The live daily tracker. This is where solar data drives everything in real time.

What is shown here:
→ All 5 slots (Brahma / Morning / Midday / Evening / Night) grouped by solar phase
→ Each habit card shows:
   - **Ideal: HH:MM – HH:MM** (Prakriti + wake shift + solar — fully personalised)
   - **Open until: HH:MM** (solar slot hard boundary — turns amber as it approaches)
   - Timing chip: On Time / Early / Late
   - Status badge: ✅ Done / ❌ Missed / ◆ Partial / ⏳ Up Next
   - Streak counter
→ Core habits: gold border, full streak logic
→ Upgraded habits: green border + "My Habit" tag, full streak logic
→ Recommendations: teal border, ⬆ Add to Streak / ✓ Done / Skip buttons
→ Slot badge: LIVE (active) / Opens HH:MM (future) / DONE (all complete)
→ Flexibility active — user can log any habit within solar slot boundary
→ After slot hard expiry → habit becomes ❌ Missed (unlogged cores break streak)
→ Night slot hard expiry: sunset + 5 hrs — no midnight eating or screen time

---

## THE 5 CORE STREAK HABITS (Gold Border — Streak Critical)

These are the **only** streak-critical habits by default. They can never be removed or demoted. All have a gold border. They map directly to habit IDs in the codebase.

```
CORE 1 — wake_early    → Wake Up
CORE 2 — morning_cleanse → Morning Cleanse
CORE 3 — breakfast + lunch + dinner → Meals (2 of 3 = complete)
CORE 4 — meditation    → Morning OR Evening (either counts)
CORE 5 — sleep         → Sleep
```

**Streak rule:** Complete all 5 cores = streak maintained.
**Grace rule:** 1 rest day per 7-day cycle. Streak survives.

---

### CORE 1 — `wake_early` — Wake Up 🌙
```
Type: CORE LOG
Border: Gold
Interaction: LOG (single tap — time recorded automatically)

Dosha windows (shift with user's chosen wake time):
  Kapha: 5:15 AM – 6:00 AM
  Pitta: 5:45 AM – 6:30 AM
  Vata:  6:00 AM – 6:30 AM

Expiry alert: 15 min before window closes

Bodhi (Kapha): "You rose before Kapha could settle.
                The entire day already belongs to you."
Bodhi (Pitta): "Pre-dawn rise — your inner fire is
                already lit before the world wakes."
Bodhi (Vata):  "You rose gently with the sun.
                The day is yours, [Name]."
```

---

### CORE 2 — `morning_cleanse` — Morning Cleanse 🪷
```
Type: CORE LOG
Border: Gold
Interaction: LOG with sub-checklist

  ☐ Dant Manjan (Ayurvedic tooth powder or neem twig)
  ☐ Toilet routine (natural morning elimination)
  ☐ Abhyanga / Bath:
    Kapha → Garshana (dry brush 5 min) + warm-hot shower
    Pitta  → Coconut oil Abhyanga + lukewarm shower
    Vata   → Sesame oil Abhyanga (5 min) + warm oil bath

All combinations count as complete. No option is wrong.
Ayurveda meets reality.

TIMING: NOT FIXED — shifts with user's chosen wake time.
Times below are defaults for each Prakriti's plan wake time.
If user picks a different wake card, these shift by the same delta.

Default dosha windows:
  Kapha: 5:35 AM – 6:35 AM  (based on Kapha default wake: 5:15 AM)
  Pitta: 6:10 AM – 7:00 AM  (based on Pitta default wake: 5:45 AM)
  Vata:  6:20 AM – 7:30 AM  (based on Vata default wake: 6:00 AM)

Bodhi: "Shuddhi complete. Your body is now
        ready to receive the day."
```

---

### CORE 3 — Meals — `breakfast` + `lunch` + `dinner` 🍽️
```
Type: CORE LOG
Border: Gold
Interaction: MEAL (meal logger + optional photo → Ayurvedic analyzer)

Three sub-logs inside one card:
  ☐ breakfast — tap to log + time recorded
  ☐ lunch     — tap to log + time recorded
  ☐ dinner    — tap to log + time recorded

Rule: 2 out of 3 meals logged = Core 3 complete
(Ayurveda accepts 2-meal days — valid practice)

BREAKFAST — SOLAR-ANCHORED: sunrise + 2 hrs → + 3 hrs
Agni must be kindled by sunlight and movement before eating.
All three doshas share the same solar window:
  ~7:08 AM – 8:08 AM in Katihar today (sunrise 5:08 AM)
  Window shifts automatically with your location's sunrise daily.

  Kapha: light and spiced, or skip entirely if not hungry
  Pitta: sweet, cooling, light
  Vata:  warm, oily, never cold or raw

LUNCH — SOLAR-ANCHORED: solar noon − 15 min → + 60 min
  All doshas: ~11:45 AM – 1:00 PM (shifts with your solar noon)
  Always the largest meal of the day.

DINNER — SOLAR-ANCHORED: sunset + 60 min → + 150 min
  ~7:00 PM – 8:30 PM (shifts with sunset)
  Always lighter than lunch (50–70% of volume).
  Kapha: eat by 7 PM, light, hot, spiced — no dessert
  Pitta: cooling, light, early — no spicy or acidic
  Vata:  warm soup, soft dal, light rice — never cold or raw

Bodhi on completion:
"Fed with intention. Your Agni is honored."
```

---

### CORE 4 — `meditation` — Meditation 🧘
```
Type: CORE LOG
Border: Gold
Interaction: TRACK (opens built-in timer, 5 min minimum)

Two windows — completing EITHER one marks Core 4 done for the day.

TIMING: NOT FIXED — both windows shift with the user's chosen wake time.
NOT solar-anchored. Positioned within the morning sequence per Prakriti logic.

MORNING WINDOW — Prakriti determines ORDER in the morning sequence:

  VATA:  6:50 AM – 7:30 AM  ← BEFORE morning walk
    Vata needs stillness first to ground the scattered mind.
    Sequence: cleanse → meditation → walk → sunlight → breakfast
    Practice: sit in stillness and watch the breath (10 min)

  PITTA: 7:15 AM – 8:00 AM  ← AFTER morning walk
    Pitta needs physical movement first to discharge excess fire.
    Sequence: cleanse → walk → meditation → sunlight → breakfast
    Practice: Chandra Bhedhana (left nostril only) — cools Pitta heat

  KAPHA: 7:00 AM – 7:35 AM  ← AFTER morning walk
    Kapha needs vigorous movement first to dissolve heaviness.
    Sequence: cleanse → walk → meditation → sunlight → breakfast
    Practice: focused inner awareness clears Kapha heaviness completely

EVENING WINDOW (default times — shift with wake choice):
  Kapha: 6:30 PM – 7:05 PM  (stillness before early dinner)
  Pitta: 7:00 PM – 8:00 PM  (Pratyahara — sensory withdrawal)
  Vata:  6:30 PM – 7:30 PM  (body-scan or Yoga Nidra)

Note: `meditation` is a single habit ID. Either window marks it done.

Bodhi: "Still water reflects the sky clearly.
        So does a still mind."
```

---

### CORE 5 — `sleep` — Sleep 🌑
```
Type: CORE LOG
Border: Gold
Interaction: LOG (single tap — "Going to sleep" — time recorded automatically)

SOLAR-ANCHORED: sunset + 210 min → + 300 min
  Kapha: ~9:30 PM  (7 hrs only — oversleeping deepens Kapha)
  Pitta: ~10:00 PM (Pitta repair peaks 10 PM–2 AM)
  Vata:  ~10:00 PM (must sleep by 10 PM to preserve Ojas)

Bodhi: "Rest well. Tomorrow's Sadhana begins
        in tonight's sleep."
```

---

## BODHI RECOMMENDATION HABITS

All habits below are **not part of the streak by default.** They appear on the Dinacharya screen at their relevant solar time slot with a **teal border** and a "🌿 Bodhi suggests" label. They are never "Missed." Zero streak pressure. The user can tap **⬆ Add to Streak** on any card to permanently promote it into their streak engine.

---

### Recommendation Card Structure
```
[🌿 Bodhi suggests]                    [time slot label]

[Icon]  [Habit Name]
        [One-line Prakriti-specific Ayurvedic reason]

[ ✓ Done ]  [ ⬆ Add to Streak ]  [ Skip ]
```

---

### What Each Button Does

**✓ Done**
→ One-tap completion.
→ Earns Karma Credits (+5).
→ Card disappears for the day.
→ Zero streak impact. No guilt if not tapped.

**⬆ Add to Streak**
→ Habit permanently promoted to user's personal streak.
→ Appears daily alongside the 5 core logs.
→ Gets a **green border** + "My Habit" tag.
→ Now earns higher Karma Credits (+15 daily).
→ Now shows ✅ Done / ❌ Missed status like core logs.
→ Contributes to streak — missing it can break streak.
→ Can be **downgraded back** to recommendation anytime from habit settings.

**Skip**
→ Dismissed silently for 24 hours.
→ 3 skips in a row → Bodhi asks:
  *"Should I stop suggesting this for now?"*
→ User can pause for 7 days, 30 days, or permanently.

---

### Add to Streak Flow — Step by Step
```
Step 1 — Confirmation sheet slides up:
"Add [Habit Name] to your daily streak?
 You'll need to complete this every day
 to keep your streak alive."
[ Yes, add it ]     [ Not yet ]

Step 2 — On confirmation:
→ Habit moves from recommendation layer to streak layer
→ Green border applied
→ "My Habit" tag appears
→ Sorted below the 5 core logs
→ Bodhi: "Your commitment grows, [Name].
   This is how Sadhana deepens."

Step 3 — Habit now appears every day in streak section
→ Streak counter now tracks all core + upgraded habits together
```

### Downgrade Flow
```
From upgraded habit's settings page:
"Move back to recommendations"

Confirmation:
"This habit will no longer affect your streak.
 It will return as a Bodhi suggestion."
[ Yes, downgrade ]   [ Keep in streak ]
```

---

## FULL BODHI RECOMMENDATION SCHEDULE

### BRAHMA MUHURTA (pre-dawn → sunrise)

```
REC 1 — Pre-Dawn Rise 🕉️  (before user's chosen wake time)
Bodhi (Kapha):  "Rising before Kapha settles gives you
                 nature's clearest, most disciplined hours."
Bodhi (Pitta):  "Pre-dawn Vata hour — your mind is sharpest
                 and your fire is balanced."
Bodhi (Vata):   "2 minutes of stillness before rising
                 grounds Vata for the entire day."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]

---

REC 2 — warm_water — Morning Hydration 💧
Interaction: LOG (single tap)
Dosha windows:
  Kapha: 5:20 AM – 5:45 AM  (warm + ginger + lemon + black pepper + honey)
  Pitta: 5:50 AM – 6:15 AM  (room-temp + fennel or coconut water — NOT warm)
  Vata:  6:05 AM – 6:30 AM  (warm + fresh ginger + lemon)
Bodhi: "Two glasses on empty stomach — flushes overnight
        Ama and awakens Agni gently."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]

---

REC 3 — Abhyanga (Oil Self-Massage) 🫧
Window: before morning cleanse
Bodhi (Vata):  "Sesame oil before bathing nourishes your
                nervous system. 5 minutes transforms Vata."
Bodhi (Pitta): "Coconut oil cools Pitta fire and protects
                your skin barrier."
Bodhi (Kapha): "Garshana (dry brush) activates lymph
                and dissolves Kapha stagnation."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]
```

---

### MORNING SADHANA (sunrise → solar noon − 2 hrs)

```
REC 4 — morning_walk — Barefoot Morning Walk 🌄
Interaction: TRACK (Walk Tracker)
Walk Type Selector BEFORE tracker starts:
  ○ 🌿 Grounding Walk — Bhumi Sparsha (barefoot on earth, grass, sand)
  ○ 👟 Normal Walk (comfortable footwear)
Saves: walk_type, steps, duration, distance_km, timestamp

Dosha windows:
  Kapha: 6:00 AM – 7:25 AM  (brisk, 30–40 min)
  Pitta: 6:35 AM – 7:30 AM  (peaceful, 25–30 min)
  Vata:  7:05 AM – 8:00 AM  (slow grounded, 20–30 min)

Bodhi (Kapha): "You moved. Kapha has no hold on you today."
Bodhi (Pitta): "Morning dew on your feet — Pitta's greatest medicine."
Bodhi (Vata):  "Earth beneath your feet. Your nervous system is calm."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]

---

REC 5 — sunlight — Morning Sunlight ☀️
Interaction: LOG (single tap)
Dosha windows:
  Kapha: 7:20 AM – 8:00 AM  (15 min, barefoot if possible)
  Pitta: 7:45 AM – 8:30 AM  (10 min, early sun only — avoid after 9 AM)
  Vata:  7:35 AM – 8:30 AM  (10–15 min, barefoot on earth)
Bodhi: "Agni nourished. Circadian rhythm aligned.
        Your inner clock runs on solar time."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]

---

REC 6 — Surya Arka (Sun Gratitude) ☀️
Window: after morning cleanse, 10–15 min
Two modes (both count as complete):
  ○ Surya Arghya — offering water to the rising sun
  ○ Surya Darshan — quiet soft sun gazing
Bodhi: "Face the rising sun. Offer water. Gaze softly.
        This is Prana — pure gratitude."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]

```

---

### MIDDAY BALANCE (solar noon ± 2 hrs)

```
REC 8 — walk — Shatapavali 🚶  (post-lunch)
Interaction: TRACK (Walk Tracker)
Walk Type Selector before tracker starts.
SOLAR-ANCHORED: solar noon + 15 min → + 90 min
~12:15 PM – 2:30 PM · 100 steps minimum · 5–10 min
Saves: walk_type, steps, duration, distance_km, timestamp
Bodhi: "100 steps after your main meal.
        Charaka's oldest secret — honored."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]

---

REC 9 — Midday Rest 😴
Window: after Shatapavali, 10–20 min
Bodhi: "Pitta peaks at noon. Brief rest after lunch
        protects digestion and clears mental fog."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]
```

---

### EVENING RESTORE (solar noon +2 hrs → sunset +2.5 hrs)

```
REC 10 — herbal_tea — Herbal Tea 🍵
Interaction: LOG (single tap)
SOLAR-ANCHORED: sunset − 150 min → − 60 min  (~3:00 PM – 4:30 PM)
  Kapha: ginger-cinnamon-tulsi or trikatu
  Pitta: mint, brahmi, rose, or CCF — never hot spicy chai
  Vata:  CCF (cumin-coriander-fennel)
Bodhi: "Agni bridged between Pitta and Vata kala.
        Your digestion will carry you smoothly tonight."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]

---

REC 11 — evening_walk — Evening Walk 🌆
Interaction: TRACK (Walk Tracker)
Walk Type Selector before tracker starts.
SOLAR-ANCHORED: sunset − 60 min → + 30 min  (~5:30 PM – 7:00 PM)
20–40 min.
  Kapha: brisk pace (2nd vigorous session of day)
  Pitta: open sky at dusk — Chandra Darshan (moonlight)
  Vata:  slow, grounding walk in nature
Saves: walk_type, steps, duration, distance_km, timestamp
Bodhi: "Pitta heat released. The evening belongs to stillness now."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]
```

---

### NIGHT WIND-DOWN (sunset +2.5 hrs → next day)

```
REC 12 — screen_free — Screen-free 📵
Interaction: LOG (single tap)
SOLAR-ANCHORED: sunset + 120 min → + 210 min  (~8:30 PM – 10:00 PM)
  Kapha: ~8:30 PM onward (earliest)
  Pitta: ~9:00 PM onward
  Vata:  ~9:00 PM + sesame oil on feet and scalp
Bodhi: "Screens off now. A calm, dark, tech-free hour
        prepares deep Kapha sleep."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]

---

REC 13 — journaling — Svadhyaya 📓
Interaction: TRACK (opens journaling timer — 10 min)
SOLAR-ANCHORED: sunset + 150 min → + 210 min  (~9:00 PM – 10:00 PM)
  Kapha: write tomorrow's movement goal
  Pitta: write 3 gratitudes
  Vata:  write tomorrow's 3 intentions
Bodhi: "Mental Ama released to the page.
        Sleep can now truly restore you."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]

---

REC 14 — Post-Dinner Shatapavali 🌙🚶
Interaction: TRACK (Walk Tracker)
Walk Type Selector before tracker opens.
Window: after dinner · 100 steps · 5–10 min
Bodhi: "100 gentle steps after dinner aids digestion
        and prepares your body for deep sleep."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]

---

REC 15 — Warm Milk / Ashwagandha Milk 🥛
Window: 30 min before sleep
Milk note: Only A2 cow milk, sheep milk, or goat milk.
           Never commercial homogenised or buffalo milk.
Bodhi (Vata):  "Warm A2 saffron-cardamom milk builds Ojas
                and ensures deep Vata sleep."
Bodhi (Pitta): "A2 or goat milk with rose or saffron —
                cooling and deeply nourishing for Pitta repair."
Bodhi (Kapha): "Ashwagandha in warm water only —
                no milk at night (Kapha already dense)."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]

---

REC 16 — Chandra Darshan 🌕
Window: post-dinner, clear sky
Bodhi (Pitta): "Moonlight is Pitta's greatest medicine.
                5 minutes under open sky — pure Chandra cooling."
Bodhi (Vata):  "The moon's pull steadies Vata.
                Stand still, breathe, let the night receive you."
Bodhi (Kapha): "Moon gazing is soothing —
                but stay warm and don't chill the body."
[ Done ] [ ⬆ Add to Streak ] [ Skip ]
```

---

## TIME SLOT DISPLAY

The Dinacharya screen groups habits into 5 time slots. Slot boundaries shift with solar data:

```
BRAHMA MUHURTA    🌙  sunrise − 1.6 hrs → sunrise       color: #a78bfa
MORNING SADHANA   🌅  sunrise → solar noon − 2 hrs       color: #fbbf24
MIDDAY BALANCE    🌞  solar noon ± 2 hrs                 color: #fb923c
EVENING RESTORE   🌆  solar noon +2 → sunset +2.5 hrs    color: #f472b6
NIGHT WIND-DOWN   🌃  sunset + 2.5 hrs → next day        color: #8b5cf6
```

Each slot shows:
- Slot state badge: `LIVE` (currently active) | `DONE` (all complete) | `Opens HH:MM` (future)
- Habit count: e.g. `3/5`
- Slim progress bar per slot

Each habit card shows:
- **Ideal window label**: e.g. `Ideal: 6:50–7:30 AM` (the Prakriti + wake-shifted target)
- **Open until label**: e.g. `Open until 9:38 AM` (the solar slot hard boundary) — shown in dimmed text below
- Timing chip: `On Time` | `Early` | `Late`
- Streak counter
- Done / Missed / Partial / Up Next badge

---

## WALK TRACKER — Data Schema

All walk habits use the same built-in Walk Tracker. Walk type selection happens **before** the tracker starts — never after.

```typescript
walk_log: {
  linked_habit: "morning_walk" | "walk" | "evening_walk" | "shatapavali_dinner",
  walk_type: "grounding" | "normal",
  duration_minutes: number,
  steps: number,
  distance_km: number,
  timestamp: datetime,
  habit_status: "recommendation" | "upgraded"
}
```

---

## NOTIFICATION SYSTEM

### Slot Reminders (fixed clock)
| ID | Time | Purpose |
|----|------|---------|
| `brahma-muhurta` | 4:45 AM | "Sacred pre-dawn window opens in 15 min" |
| `morning-start` | 6:00 AM | Morning Kapha Kala opens |
| `checkin-reminder` | 8:00 AM | Bodhi daily check-in |
| `morning-expiry` | 9:55 AM | "Morning window closing in 5 min" |
| `afternoon-start` | 12:00 PM | Pitta Agni peak |
| `afternoon-expiry` | 1:55 PM | "Afternoon window closing in 5 min" |
| `evening-start` | 6:00 PM | Kapha wind-down |
| `evening-expiry` | 9:55 PM | "Evening window closing in 5 min" |

### Per-Habit Expiry Alerts (15 min before each window closes — user-toggleable)
| Habit | Alert Time | Type |
|-------|-----------|------|
| `wake_early` | 6:15 AM | Core |
| `meditation` | 7:45 AM | Core |
| `breakfast` | 9:15 AM | Core |
| `lunch` | 1:15 PM | Core |
| `dinner` | 7:45 PM | Core |
| `sleep` | 10:45 PM | Core |
| `warm_water` | 7:15 AM | Recommendation |
| `sunlight` | 8:45 AM | Recommendation |
| `walk` | 1:45 PM | Recommendation |
| `herbal_tea` | 4:45 PM | Recommendation |
| `evening_walk` | 6:45 PM | Recommendation |
| `screen_free` | 9:45 PM | Recommendation |
| `journaling` | 10:15 PM | Recommendation |

---

## VISUAL DESIGN SYSTEM

```
CORE STREAK HABITS (5 only)
→ Gold / saffron left border
→ Status: ✅ Done | ⏳ Up Next | ❌ Missed | ◆ Partial | ⏰ Late
→ Can never be removed or demoted

USER UPGRADED HABITS
→ Green left border (#4CD964)
→ "My Habit" tag (top right of card)
→ Status: ✅ Done | ❌ Missed | ⏳ Up Next
→ Affects streak — same weight as core habits
→ Can be downgraded back to recommendation anytime

BODHI RECOMMENDATIONS
→ Teal left border
→ "🌿 Bodhi suggests" label (top left) + small Bodhi avatar
→ Status: ✅ Done | ⏳ Up Next ONLY
→ NEVER shows ❌ Missed
→ Zero streak impact

FUTURE SLOT
→ Dimmed to 40% opacity
→ Lock icon replaces slot emoji
→ Shows "Opens HH:MM" badge

ACTIVE SLOT
→ Full opacity
→ "LIVE" badge (dosha color)
→ Slot border tinted with dosha color
```

---

## KARMA CREDITS

```
Complete a Core Log (each of 5)      → +25 credits
All 5 Core Logs in one day           → +50 bonus credits
Complete an Upgraded Habit           → +15 credits
Complete a Recommendation (✓ Done)   → +5 credits
7-day streak                         → +100 credits
21-day streak                        → +300 credits
66-day streak                        → +1000 credits
```

---

## DEVELOPER SCHEMA

```typescript
habit: {
  id: string,
  // CORE IDs:        wake_early | morning_cleanse | breakfast | lunch | dinner | meditation | sleep
  // RECOMMENDATION IDs: warm_water | morning_walk | sunlight | walk | herbal_tea |
  //                     evening_walk | screen_free | journaling | + any new recs

  name: string,
  emoji: string,

  type: "core" | "recommendation",
  status: "core" | "recommendation" | "upgraded",
  streak_critical: boolean,
  // true  → core habits (always) + upgraded habits (user choice)
  // false → recommendation habits (until upgraded)

  interaction_type: "LOG" | "TRACK" | "MEAL",
  // LOG:   wake_early, morning_cleanse, warm_water, sunlight, herbal_tea, screen_free, sleep
  // TRACK: meditation, morning_walk, walk, evening_walk, journaling
  // MEAL:  breakfast, lunch, dinner

  time_slot: "brahma" | "morning" | "midday" | "evening" | "night",

  // Windows are NOT hardcoded — computed from:
  //   1. getPrakritiPlan(prakriti).activities[habitId].startMin / endMin
  //   2. shiftActivitiesToWake(activities, defaultWakeMin, userChosenWakeMin)
  //   3. applySolarToActivities(shifted, solarNoon, sunset)  ← afternoon/evening only
  window: { start: number; end: number },  // minutes from midnight, fully dynamic

  walk_enabled: boolean,        // true for morning_walk, walk, evening_walk, shatapavali_dinner
  walk_type_selector: boolean,  // true for all walk habits — selector shown BEFORE tracker

  dosha_relevance: ("Vata" | "Pitta" | "Kapha")[],
  karma_credits: number,

  can_be_upgraded: boolean,    // false for core habits | true for all recommendations
  can_be_downgraded: boolean,  // false for core habits | true for upgraded habits
}
```

---

## STREAK RULES

**Daily streak:** Complete all 5 core habits = streak maintained.

**Upgraded habits:** Any recommendation the user upgrades also becomes streak-critical. Missing it can break the streak — same rule as core habits.

**Grace rule:** 1 rest day per 7-day cycle. Streak survives.

**Missed logic:** A habit is considered missed when its **solar slot ends** and it has not been logged. The individual habit window end is NOT the expiry — the solar slot boundary is. A user who meditates 2 hours after the ideal window but before solar noon = `late`, not missed.

**Late log:** Logging after the individual window end but before the solar slot boundary = `late` status — counts for streak, shown as "Late" chip on card.

**Partial log:** `morning_cleanse` sub-checklist or Meals (1 of 3 logged) = `partial` — counts for streak.

**Recommendations:** Never show ❌ Missed. Never break streak. Disappear at day end if not tapped — no record kept.

---

## ONE-LINE SUMMARY

**5 gold core logs protect the streak by default. Every window shifts dynamically with your Prakriti, your personal wake time, and your exact solar noon and sunset. Every other practice lives as a zero-pressure Bodhi recommendation. Add to Streak what resonates — it joins the streak. Downgrade what doesn't — it returns to suggestions. The journey is always theirs — the timing is always accurate.**
