from fastapi import APIRouter, HTTPException, Body
from typing import Optional
from datetime import datetime, date, timedelta
import json
import os
import ephem
import google.generativeai as genai
from pydantic import BaseModel

# ─── Firebase Admin SDK ──────────────────────────────────────
import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    # Use GOOGLE_APPLICATION_CREDENTIALS env var (path to service account JSON)
    # OR set FIREBASE_SERVICE_ACCOUNT_JSON env var with the JSON content as string
    service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if service_account_json:
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write(service_account_json)
            tmp_path = f.name
        cred = credentials.Certificate(tmp_path)
    else:
        cred = credentials.Certificate(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json"))
    firebase_admin.initialize_app(cred)

db = firestore.client()

# ─── Gemini setup ───────────────────────────────────────────
genai.configure(api_key=os.environ["GOOGLE_AI_API_KEY"])
model = genai.GenerativeModel("gemini-2.5-flash")

router = APIRouter(prefix="/api/myspace", tags=["myspace"])

# ─── Pydantic Models ────────────────────────────────────────
class JournalEntryCreate(BaseModel):
    user_id: str
    content: str
    entry_mode: str = "free_write"
    media_urls: list = []
    voice_transcript: Optional[str] = None
    mood_score: Optional[int] = None

class TaskCreate(BaseModel):
    user_id: str
    title: str
    notes: Optional[str] = None
    category: str = "Personal"
    priority: str = "medium"
    energy_required: str = "medium"
    due_datetime: Optional[str] = None
    media_url: Optional[str] = None

class BrainDumpRequest(BaseModel):
    user_id: str
    brain_dump: str
    energy_level: int

class NoteCreate(BaseModel):
    user_id: str
    content: str
    note_type: str = "quick"
    media_url: Optional[str] = None
    voice_transcript: Optional[str] = None

# ─── Helper: Daily wellness context ─────────────────────────
def get_daily_context() -> dict:
    now = datetime.utcnow()
    hour = now.hour

    if 6 <= hour < 10:
        window = {"name": "Morning Grounding", "best_for": "intentions, body movement, gratitude", "color": "#E9C46A"}
    elif 10 <= hour < 14:
        window = {"name": "Peak Focus", "best_for": "deep work, decisions, complex tasks", "color": "#F4A261"}
    elif 14 <= hour < 18:
        window = {"name": "Creative Flow", "best_for": "creative work, communication, learning", "color": "#2A9D8F"}
    elif 18 <= hour < 22:
        window = {"name": "Wind Down", "best_for": "reflection, light tasks, relationships", "color": "#457B9D"}
    else:
        window = {"name": "Deep Rest", "best_for": "emotional processing, dream capture", "color": "#1D3557"}

    moon = ephem.Moon(now)
    phase_pct = moon.phase
    if phase_pct < 5 or phase_pct > 95:
        moon_phase = "New Moon"
    elif phase_pct < 45:
        moon_phase = "Waxing"
    elif phase_pct < 55:
        moon_phase = "Full Moon"
    else:
        moon_phase = "Waning"

    month = now.month
    season = "Spring" if month in [3,4,5] else "Summer" if month in [6,7,8] else "Autumn" if month in [9,10,11] else "Winter"

    return {
        "energy_window": window,
        "moon_phase": moon_phase,
        "season": season,
        "current_hour": hour,
        "current_date": now.date().isoformat()
    }

# ─── Helper: User profile from Firestore ──────────────────
def get_user_profile(user_id: str) -> dict:
    try:
        doc = db.collection("users").document(user_id).get()
        if doc.exists:
            data = doc.to_dict()
            return {
                "name": data.get("name", "Friend"),
                "dosha": data.get("prakriti", "Vata"),
            }
    except Exception:
        pass
    return {"name": "Friend", "dosha": "Vata"}

# ─── Helper: Recent journal themes ────────────────────────
def get_recent_themes(user_id: str) -> str:
    try:
        docs = (
            db.collection("journal_entries")
            .where("userId", "==", user_id)
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .limit(7)
            .stream()
        )
        all_tags = []
        for doc in docs:
            d = doc.to_dict()
            all_tags.extend(d.get("themeTags", []))
            if d.get("dominantEmotion"):
                all_tags.append(d["dominantEmotion"])
        from collections import Counter
        top = Counter(all_tags).most_common(5)
        return ", ".join([t[0] for t in top]) if top else "varied themes"
    except Exception:
        return "varied themes"

# ─── Helper: Journal streak ───────────────────────────────
def get_journal_streak(user_id: str) -> int:
    try:
        doc = db.collection("user_wellness_stats").document(user_id).get()
        if doc.exists:
            return doc.to_dict().get("journalStreak", 0)
    except Exception:
        pass
    return 0

# ─── Helper: Firestore timestamp ──────────────────────────
def now_ts():
    return firestore.SERVER_TIMESTAMP


# ═══════════════════════════════════════════════════════════
# JOURNAL ENDPOINTS
# ═══════════════════════════════════════════════════════════

@router.get("/context")
def get_context():
    return get_daily_context()


@router.post("/journal/analyze")
async def analyze_journal_entry(payload: JournalEntryCreate):
    user = get_user_profile(payload.user_id)
    context = get_daily_context()
    recent_themes = get_recent_themes(payload.user_id)
    streak = get_journal_streak(payload.user_id)

    prompt = f"""
You are Bodhi — the intelligent wellness companion inside OneSutra.
You are warm, specific, and grounded. You never lecture. You never use generic wellness clichés.
You speak like a calm, intelligent friend.

USER PROFILE:
- Name: {user['name']}
- Body Type (Dosha): {user['dosha']}
- Current Energy Window: {context['energy_window']['name']} — best for {context['energy_window']['best_for']}
- Moon Phase: {context['moon_phase']}
- Season: {context['season']}
- Recent themes from past 7 entries: {recent_themes}
- Current journal streak: {streak} days

TODAY'S JOURNAL ENTRY:
\"\"\"{payload.content}\"\"\"

Respond ONLY in valid JSON (no markdown, no extra text):
{{
  "reflection": "2-3 warm specific sentences referencing energy window context. NEVER use: journey, healing, amazing, incredible, beautiful soul.",
  "pattern_insight": null,
  "energy_nudge": "One practical wellness suggestion under 20 words.",
  "meditation_tip": null,
  "follow_up_prompt": "One specific question from what they wrote.",
  "daily_insight_quote": "Single most insightful sentence verbatim from their entry.",
  "mood_score": 7,
  "energy_level": 6,
  "dominant_emotion": "anxious",
  "theme_tags": ["career", "uncertainty"],
  "stress_detected": false
}}
"""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.75,
                max_output_tokens=700
            )
        )
        ai_result = json.loads(response.text)
    except Exception:
        ai_result = {
            "reflection": "Your thoughts are worth sitting with. Take a moment.",
            "pattern_insight": None,
            "energy_nudge": f"You're in your {context['energy_window']['name']} — a good time to pause and breathe.",
            "meditation_tip": None,
            "follow_up_prompt": "What feels most unresolved right now?",
            "daily_insight_quote": payload.content[:120] if payload.content else "Today I showed up.",
            "mood_score": 6,
            "energy_level": 6,
            "dominant_emotion": "reflective",
            "theme_tags": ["general"],
            "stress_detected": False
        }

    # Save to Firestore: collection "journal_entries", subcollection under user or flat with userId field
    entry_data = {
        "userId": payload.user_id,
        "entryDate": context["current_date"],
        "content": payload.content,
        "entryMode": payload.entry_mode,
        "mediaUrls": payload.media_urls,
        "voiceTranscript": payload.voice_transcript,
        "energyWindow": context["energy_window"]["name"],
        "moonPhase": context["moon_phase"],
        "season": context["season"],
        "moodScore": ai_result.get("mood_score"),
        "energyLevel": ai_result.get("energy_level"),
        "dominantEmotion": ai_result.get("dominant_emotion"),
        "themeTags": ai_result.get("theme_tags", []),
        "stressDetected": ai_result.get("stress_detected", False),
        "bodhiReflection": ai_result.get("reflection"),
        "bodhiPatternInsight": ai_result.get("pattern_insight"),
        "bodhiEnergyNudge": ai_result.get("energy_nudge"),
        "bodhiFollowUp": ai_result.get("follow_up_prompt"),
        "bodhiMeditationTip": ai_result.get("meditation_tip"),
        "dailyInsightQuote": ai_result.get("daily_insight_quote"),
        "streakDay": streak + 1,
        "isArchived": False,
        "createdAt": now_ts(),
    }

    saved_ref = db.collection("journal_entries").add(entry_data)
    entry_id = saved_ref[1].id

    # Update wellness stats
    db.collection("user_wellness_stats").document(payload.user_id).set({
        "journalStreak": streak + 1,
        "lastJournalDate": context["current_date"],
        "lastUpdated": now_ts(),
    }, merge=True)

    return {
        "entry_id": entry_id,
        "bodhi": ai_result,
        "context": context
    }


@router.get("/journal/entries/{user_id}")
def get_journal_entries(user_id: str, limit: int = 20, offset: int = 0):
    try:
        docs = (
            db.collection("journal_entries")
            .where("userId", "==", user_id)
            .where("isArchived", "==", False)
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )
        entries = []
        for doc in docs:
            d = doc.to_dict()
            d["id"] = doc.id
            # Convert Firestore timestamps for JSON serialisation
            if hasattr(d.get("createdAt"), "isoformat"):
                d["createdAt"] = d["createdAt"].isoformat()
            entries.append(d)
        return entries
    except Exception as e:
        return []


@router.get("/journal/on-this-day/{user_id}")
def get_on_this_day(user_id: str):
    today = date.today()
    results = []
    for year_offset in [1, 2, 3]:
        try:
            past_date = today.replace(year=today.year - year_offset).isoformat()
            docs = (
                db.collection("journal_entries")
                .where("userId", "==", user_id)
                .where("entryDate", "==", past_date)
                .stream()
            )
            for doc in docs:
                d = doc.to_dict(); d["id"] = doc.id
                results.append(d)
        except Exception:
            continue
    return results


@router.get("/journal/heatmap/{user_id}")
def get_mood_heatmap(user_id: str, year: int = None, month: int = None):
    import calendar
    today = date.today()
    y = year or today.year
    m = month or today.month
    start = f"{y}-{m:02d}-01"
    end = f"{y}-{m:02d}-{calendar.monthrange(y, m)[1]}"
    try:
        docs = (
            db.collection("journal_entries")
            .where("userId", "==", user_id)
            .where("entryDate", ">=", start)
            .where("entryDate", "<=", end)
            .stream()
        )
        return [{"entry_date": d.to_dict().get("entryDate"), "mood_score": d.to_dict().get("moodScore"), "dominant_emotion": d.to_dict().get("dominantEmotion")} for d in docs]
    except Exception:
        return []


# ═══════════════════════════════════════════════════════════
# TASKS ENDPOINTS
# ═══════════════════════════════════════════════════════════

@router.post("/tasks/brain-dump")
async def plan_day_from_brain_dump(payload: BrainDumpRequest):
    user = get_user_profile(payload.user_id)
    context = get_daily_context()
    today_str = datetime.utcnow().date().isoformat()

    # Pending tasks from previous days
    try:
        pending_docs = (
            db.collection("tasks")
            .where("userId", "==", payload.user_id)
            .where("isCompleted", "==", False)
            .where("taskDate", "<", today_str)
            .limit(5)
            .stream()
        )
        pending = [d.to_dict().get("title", "") for d in pending_docs]
    except Exception:
        pending = []

    prompt = f"""
You are Bodhi — the intelligent planning companion in OneSutra.
You are practical, direct, and calm. Not motivational. Not preachy.

USER PROFILE:
- Body Type (Dosha): {user['dosha']}
- Today's Self-Reported Energy (1-10): {payload.energy_level}
- Pending tasks from previous days: {', '.join(pending) if pending else 'None'}

TODAY'S ENERGY WINDOWS:
- Morning Grounding (6-10am): physical tasks, intentions, light admin
- Peak Focus (10am-2pm): deep work, decisions, analytics
- Creative Flow (2-6pm): creative work, communication, learning
- Wind Down (6-10pm): reflection, easy admin, relationships

USER'S BRAIN DUMP FOR TODAY:
\"\"\"{payload.brain_dump}\"\"\"

Respond ONLY in valid JSON:
{{
  "parsed_tasks": [
    {{
      "title": "string",
      "category": "Work|Health|Personal|Learning|Relationships|Other",
      "priority": "high|medium|low",
      "energy_required": "high|medium|low",
      "suggested_energy_window": "Morning Grounding|Peak Focus|Creative Flow|Wind Down",
      "suggested_time": "10:30 AM",
      "bodhi_note": "max 10 words why this window"
    }}
  ],
  "overload_flag": false,
  "remove_suggestion": null,
  "wellness_task": null,
  "day_summary": "string",
  "sustainability_score": 7
}}
"""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.5,
                max_output_tokens=1000
            )
        )
        result = json.loads(response.text)
    except Exception as e:
        return {"error": str(e), "parsed_tasks": [], "day_summary": "Could not parse. Try adding tasks manually."}

    # Save tasks to Firestore
    batch = db.batch()
    for task in result.get("parsed_tasks", []):
        ref = db.collection("tasks").document()
        batch.set(ref, {
            "userId": payload.user_id,
            "taskDate": today_str,
            "title": task["title"],
            "category": task.get("category", "Personal"),
            "priority": task.get("priority", "medium"),
            "energyRequired": task.get("energy_required", "medium"),
            "suggestedEnergyWindow": task.get("suggested_energy_window"),
            "bodhiNote": task.get("bodhi_note"),
            "isBodhiSuggested": False,
            "isCompleted": False,
            "timesDeferred": 0,
            "createdAt": now_ts(),
        })

    if result.get("wellness_task"):
        wt = result["wellness_task"]
        ref = db.collection("tasks").document()
        batch.set(ref, {
            "userId": payload.user_id,
            "taskDate": today_str,
            "title": wt.get("title", "Wellness break"),
            "category": "Health",
            "priority": "medium",
            "energyRequired": "low",
            "suggestedEnergyWindow": "Morning Grounding",
            "bodhiNote": wt.get("reason"),
            "isBodhiSuggested": True,
            "isCompleted": False,
            "timesDeferred": 0,
            "createdAt": now_ts(),
        })

    batch.commit()
    return result


@router.post("/tasks")
def create_task(payload: TaskCreate):
    context = get_daily_context()
    energy_to_window = {"high": "Peak Focus", "medium": "Creative Flow", "low": "Wind Down"}
    task_data = {
        "userId": payload.user_id,
        "taskDate": payload.due_datetime[:10] if payload.due_datetime else context["current_date"],
        "title": payload.title,
        "notes": payload.notes,
        "category": payload.category,
        "priority": payload.priority,
        "energyRequired": payload.energy_required,
        "suggestedEnergyWindow": energy_to_window.get(payload.energy_required, "Creative Flow"),
        "dueDatetime": payload.due_datetime,
        "mediaUrl": payload.media_url,
        "isCompleted": False,
        "timesDeferred": 0,
        "createdAt": now_ts(),
    }
    ref = db.collection("tasks").add(task_data)
    return {"id": ref[1].id, **{k: v for k, v in task_data.items() if k != "createdAt"}}


@router.get("/tasks/today/{user_id}")
def get_today_tasks(user_id: str):
    today = datetime.utcnow().date().isoformat()
    context = get_daily_context()
    try:
        docs = (
            db.collection("tasks")
            .where("userId", "==", user_id)
            .where("taskDate", "==", today)
            .stream()
        )
        tasks = []
        for doc in docs:
            d = doc.to_dict(); d["id"] = doc.id
            tasks.append(d)
    except Exception:
        tasks = []

    grouped = {
        "Morning Grounding": [], "Peak Focus": [],
        "Creative Flow": [], "Wind Down": [], "Unscheduled": []
    }
    for task in tasks:
        window = task.get("suggestedEnergyWindow") or "Unscheduled"
        grouped.setdefault(window, []).append(task)

    total = len(tasks)
    completed = sum(1 for t in tasks if t.get("isCompleted"))
    return {
        "tasks_by_window": grouped,
        "total": total,
        "completed": completed,
        "current_window": context["energy_window"],
        "completion_pct": round((completed / total * 100) if total > 0 else 0)
    }


@router.put("/tasks/{task_id}/complete")
def complete_task(task_id: str, user_id: str = Body(...)):
    context = get_daily_context()
    ref = db.collection("tasks").document(task_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Task not found")
    task = doc.to_dict()

    priority = task.get("priority", "medium")
    base_credits = {"high": 30, "medium": 20, "low": 10}.get(priority, 20)
    in_optimal = task.get("suggestedEnergyWindow") == context["energy_window"]["name"]
    karma = int(base_credits * 1.5) if in_optimal else base_credits

    ref.update({
        "isCompleted": True,
        "completedAt": now_ts(),
        "karmaCreditsEarned": karma,
        "completedInOptimalWindow": in_optimal,
    })

    # Increment karma in user_wellness_stats
    db.collection("user_wellness_stats").document(user_id).set(
        {"karmaCredits": firestore.Increment(karma)}, merge=True
    )

    return {
        "karma_earned": karma,
        "in_optimal_window": in_optimal,
        "bonus_applied": in_optimal,
        "bodhi_message": "Clean execution." if in_optimal else "Done."
    }


@router.put("/tasks/{task_id}/defer")
def defer_task(task_id: str, reason: str = Body(None), user_id: str = Body(...)):
    tomorrow = (datetime.utcnow().date() + timedelta(days=1)).isoformat()
    ref = db.collection("tasks").document(task_id)
    doc = ref.get()
    times_deferred = (doc.to_dict().get("timesDeferred") or 0) + 1 if doc.exists else 1
    ref.update({
        "taskDate": tomorrow,
        "timesDeferred": times_deferred,
        "deferredReason": reason,
    })
    bodhi_msg = f"You've moved this task {times_deferred} times. Still relevant?" if times_deferred >= 3 else None
    return {"deferred_to": tomorrow, "times_deferred": times_deferred, "bodhi_flag": bodhi_msg}


@router.get("/tasks/weekly-report/{user_id}")
def get_weekly_report(user_id: str):
    today = datetime.utcnow().date()
    week_start = (today - timedelta(days=today.weekday())).isoformat()
    try:
        docs = (
            db.collection("tasks")
            .where("userId", "==", user_id)
            .where("taskDate", ">=", week_start)
            .stream()
        )
        tasks = [d.to_dict() for d in docs]
    except Exception:
        tasks = []

    total = len(tasks)
    completed = sum(1 for t in tasks if t.get("isCompleted"))
    optimal = sum(1 for t in tasks if t.get("completedInOptimalWindow"))
    karma = sum(t.get("karmaCreditsEarned") or 0 for t in tasks)
    cat_counts: dict = {}
    for t in tasks:
        if t.get("isCompleted"):
            cat = t.get("category", "Other")
            cat_counts[cat] = cat_counts.get(cat, 0) + 1

    return {
        "total_tasks": total,
        "completed_tasks": completed,
        "completion_rate": round((completed / total * 100) if total > 0 else 0),
        "optimal_window_completions": optimal,
        "karma_earned_this_week": karma,
        "category_breakdown": cat_counts,
        "week_start": week_start
    }


# ═══════════════════════════════════════════════════════════
# NOTES ENDPOINTS
# ═══════════════════════════════════════════════════════════

@router.post("/notes")
def create_note(payload: NoteCreate):
    context = get_daily_context()
    note_data = {
        "userId": payload.user_id,
        "noteDate": context["current_date"],
        "content": payload.content,
        "noteType": payload.note_type,
        "mediaUrl": payload.media_url,
        "voiceTranscript": payload.voice_transcript,
        "createdAt": now_ts(),
    }
    ref = db.collection("notes").add(note_data)
    return {"id": ref[1].id, **{k: v for k, v in note_data.items() if k != "createdAt"}}


@router.get("/notes/today/{user_id}")
def get_today_notes(user_id: str):
    today = datetime.utcnow().date().isoformat()
    try:
        docs = (
            db.collection("notes")
            .where("userId", "==", user_id)
            .where("noteDate", "==", today)
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .stream()
        )
        result = []
        for doc in docs:
            d = doc.to_dict(); d["id"] = doc.id
            if hasattr(d.get("createdAt"), "isoformat"):
                d["createdAt"] = d["createdAt"].isoformat()
            result.append(d)
        return result
    except Exception:
        return []


@router.get("/notes/digest/{user_id}")
async def get_notes_digest(user_id: str):
    today = datetime.utcnow().date().isoformat()
    try:
        docs = (
            db.collection("notes")
            .where("userId", "==", user_id)
            .where("noteDate", "==", today)
            .stream()
        )
        notes = [d.to_dict() for d in docs]
    except Exception:
        notes = []

    if not notes:
        return {"digest": None, "has_notes": False}

    all_content = "\n".join([
        n.get("voiceTranscript") or n.get("content") or ""
        for n in notes if n.get("content") or n.get("voiceTranscript")
    ])

    prompt = f"""
You are Bodhi. The user captured these notes today:
\"\"\"{all_content}\"\"\"

Respond ONLY in JSON:
{{
  "summary": "2-3 sentences about what they captured today",
  "standout_idea": "most interesting/actionable idea (or null)",
  "suggested_tasks": ["task 1", "task 2"],
  "bodhi_message": "1 casual sentence about today's notes"
}}
"""
    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.6,
                max_output_tokens=300
            )
        )
        return {"digest": json.loads(response.text), "has_notes": True, "note_count": len(notes)}
    except Exception:
        return {"digest": None, "has_notes": True, "note_count": len(notes)}


# ─── Register in main.py ────────────────────────────────────
# from routers.myspace import router as myspace_router
# app.include_router(myspace_router)
#
# Required env vars on Render:
#   GOOGLE_AI_API_KEY              — Gemini API key
#   GOOGLE_APPLICATION_CREDENTIALS — path to Firebase service account JSON file
#   OR
#   FIREBASE_SERVICE_ACCOUNT_JSON  — full service account JSON as a string (recommended for Render)
