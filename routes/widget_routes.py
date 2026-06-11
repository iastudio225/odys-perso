"""
Widget Chat API - Agent Commercial IA
Endpoint pour intégrer l'agent Odysseus sur des sites web clients
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Request 
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
import json
import os
import sqlite3
import httpx
from pathlib import Path

router = APIRouter(prefix="/api/widget", tags=["widget"])

# Configuration - Chemins absolus pour Docker
CONFIG_FILE = Path("/app/clients_config.json")
DB_FILE = Path("/app/data/leads.db")

# Modèles de données
class WidgetMessage(BaseModel):
    client_id: str = Field(..., description="Identifiant du client/site")
    message: str = Field(..., description="Message du visiteur")
    session_id: Optional[str] = Field(None, description="ID de session existante")
    visitor_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Données visiteur")
    page_url: Optional[str] = Field(None, description="URL de la page courante")

class WidgetResponse(BaseModel):
    response: str
    session_id: str
    lead_id: Optional[str] = None
    qualification_score: Optional[float] = None
    is_qualified: bool = False
    suggested_action: Optional[str] = None

class ClientConfig(BaseModel):
    name: str
    system_prompt: str
    llm_provider: str = "gemini"
    llm_model: str = "gemini-2.0-flash-exp"
    qualification_keywords: List[str] = []
    min_qualification_score: float = 0.6
    webhook_url: Optional[str] = None
    language: str = "fr"

# Initialisation de la base de données
def init_db():
    """Initialise la base de données des leads"""
    try:
        # S'assurer que le dossier data existe
        DB_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        print(f"🔧 Initializing widget DB at: {DB_FILE}")
        
        conn = sqlite3.connect(str(DB_FILE))
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS leads (
                id TEXT PRIMARY KEY,
                client_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                name TEXT,
                email TEXT,
                phone TEXT,
                company TEXT,
                need TEXT,
                qualification_score REAL,
                status TEXT DEFAULT 'new',
                conversation_history TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lead_id TEXT NOT NULL,
                role TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lead_id) REFERENCES leads(id)
            )
        """)
        
        conn.commit()
        conn.close()
        print(f"✅ Widget DB initialized successfully at {DB_FILE}")
    except Exception as e:
        print(f"❌ Error initializing widget DB: {e}")
        import traceback
        traceback.print_exc()

# Appeler init_db() au chargement du module
init_db()

def load_client_config(client_id: str) -> ClientConfig:
    """Charge la configuration d'un client"""
    if not CONFIG_FILE.exists():
        raise HTTPException(status_code=400, detail=f"Configuration file not found at {CONFIG_FILE}")
    
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        configs = json.load(f)
    
    if client_id not in configs:
        raise HTTPException(status_code=400, detail=f"Client {client_id} not found in configuration")
    
    return ClientConfig(**configs[client_id])

def generate_lead_id() -> str:
    """Génère un ID unique pour un lead"""
    import uuid
    return str(uuid.uuid4())[:8].upper()

def generate_session_id() -> str:
    """Génère un ID de session unique"""
    import uuid
    return str(uuid.uuid4())

def calculate_qualification_score(message: str, config: ClientConfig) -> float:
    """Calcule un score de qualification basé sur les mots-clés"""
    score = 0.0
    message_lower = message.lower()
    
    for keyword in config.qualification_keywords:
        if keyword.lower() in message_lower:
            score += 0.2
    
    if len(message) > 50:
        score += 0.1
    if len(message) > 100:
        score += 0.1
    
    if '@' in message:
        score += 0.15
    if any(char.isdigit() for char in message):
        score += 0.1
    
    return min(score, 1.0)

async def call_llm_provider(provider: str, model: str, system_prompt: str, user_message: str, conversation_history: List[Dict]) -> str:
    """Appelle le provider LLM configuré"""
    
    messages = [
        {"role": "system", "content": system_prompt},
        *conversation_history[-10:],
        {"role": "user", "content": user_message}
    ]
    
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Odysseus-Widget/1.0"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        if provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
            
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            payload = {
                "contents": [
                    {"role": "user" if msg["role"] != "system" else "model", 
                     "parts": [{"text": msg["content"]}]}
                    for msg in messages
                ],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 500
                }
            }
            
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Gemini API error: {response.text}")
            
            result = response.json()
            return result["candidates"][0]["content"]["parts"][0]["text"]
        
        elif provider == "openrouter":
            api_key = os.getenv("OPENROUTER_API_KEY")
            if not api_key:
                raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not configured")
            
            url = "https://openrouter.ai/api/v1/chat/completions"
            payload = {
                "model": model,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 500
            }
            
            headers["Authorization"] = f"Bearer {api_key}"
            headers["HTTP-Referer"] = "https://odysseus.cooligital.africa"
            
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail=f"OpenRouter API error: {response.text}")
            
            result = response.json()
            return result["choices"][0]["message"]["content"]
        
        elif provider == "groq":
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
            
            url = "https://api.groq.com/openai/v1/chat/completions"
            payload = {
                "model": model,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 500
            }
            
            headers["Authorization"] = f"Bearer {api_key}"
            
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Groq API error: {response.text}")
            
            result = response.json()
            return result["choices"][0]["message"]["content"]
        
        else:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

async def send_webhook_notification(webhook_url: str, lead_data: Dict):
    """Envoie une notification webhook au CRM"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(webhook_url, json=lead_data)
    except Exception as e:
        print(f"Webhook notification failed: {e}")

@router.post("/chat", response_model=WidgetResponse)
async def widget_chat(message_data: WidgetMessage, background_tasks: BackgroundTasks):
    """Endpoint principal pour le chat widget"""
    
    print(f"📨 Widget chat request from client: {message_data.client_id}")
    
    config = load_client_config(message_data.client_id)
    session_id = message_data.session_id or generate_session_id()
    lead_id = None
    
    conn = sqlite3.connect(str(DB_FILE))
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "SELECT id, qualification_score, conversation_history FROM leads WHERE session_id = ?",
            (session_id,)
        )
        existing_lead = cursor.fetchone()
        
        if existing_lead:
            lead_id = existing_lead[0]
            conversation_history = json.loads(existing_lead[2] or "[]")
        else:
            lead_id = generate_lead_id()
            conversation_history = []
            
            name = message_data.visitor_data.get("name")
            email = message_data.visitor_data.get("email")
            phone = message_data.visitor_data.get("phone")
            company = message_data.visitor_data.get("company")
            
            cursor.execute("""
                INSERT INTO leads (id, client_id, session_id, name, email, phone, company, need)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (lead_id, message_data.client_id, session_id, name, email, phone, company, message_data.message))
        
        qualification_score = calculate_qualification_score(message_data.message, config)
        is_qualified = qualification_score >= config.min_qualification_score
        
        suggested_action = None
        if is_qualified:
            suggested_action = "contact_urgent" if qualification_score > 0.8 else "contact_standard"
        elif len(conversation_history) > 4:
            suggested_action = "relance_douce"
        
        llm_response = await call_llm_provider(
            provider=config.llm_provider,
            model=config.llm_model,
            system_prompt=config.system_prompt,
            user_message=message_data.message,
            conversation_history=conversation_history
        )
        
        conversation_history.append({"role": "user", "content": message_data.message})
        conversation_history.append({"role": "assistant", "content": llm_response})
        
        cursor.execute("""
            UPDATE leads 
            SET qualification_score = ?, 
                conversation_history = ?,
                updated_at = CURRENT_TIMESTAMP,
                status = ?
            WHERE id = ?
        """, (qualification_score, json.dumps(conversation_history), 
              "qualified" if is_qualified else "new", lead_id))
        
        cursor.execute("""
            INSERT INTO conversations (lead_id, role, message)
            VALUES (?, ?, ?)
        """, (lead_id, "user", message_data.message))
        
        cursor.execute("""
            INSERT INTO conversations (lead_id, role, message)
            VALUES (?, ?, ?)
        """, (lead_id, "assistant", llm_response))
        
        conn.commit()
        
        if is_qualified and config.webhook_url:
            lead_data = {
                "lead_id": lead_id,
                "client_id": message_data.client_id,
                "client_name": config.name,
                "score": qualification_score,
                "message": message_data.message,
                "response": llm_response,
                "visitor_data": message_data.visitor_data,
                "page_url": message_data.page_url,
                "timestamp": datetime.now().isoformat()
            }
            background_tasks.add_task(send_webhook_notification, config.webhook_url, lead_data)
        
        return WidgetResponse(
            response=llm_response,
            session_id=session_id,
            lead_id=lead_id if not existing_lead else None,
            qualification_score=qualification_score,
            is_qualified=is_qualified,
            suggested_action=suggested_action
        )
    
    finally:
        conn.close()

@router.get("/config/{client_id}")
async def get_widget_config(client_id: str):
    """Récupère la configuration publique d'un widget"""
    try:
        config = load_client_config(client_id)
        return {
            "client_name": config.name,
            "language": config.language,
            "welcome_message": "Bonjour! Comment puis-je vous aider?"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/analytics")
async def widget_analytics(request: Request):
    """
    Endpoint pour recevoir les événements analytics du widget
    Accepte n'importe quelle structure JSON
    """
    try:
        event_data = await request.json()
        
        # Log l'événement
        print(f"📊 Analytics Event: {event_data.get('event')} - Client: {event_data.get('client_id')}")
        
        # Optionnel : Stocker en DB pour analyse ultérieure
        try:
            conn = sqlite3.connect(str(DB_FILE))
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS analytics_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    client_id TEXT,
                    session_id TEXT,
                    data TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                INSERT INTO analytics_events (event_type, client_id, session_id, data, timestamp)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                event_data.get('event'),
                event_data.get('client_id'),
                event_data.get('session_id'),
                json.dumps(event_data)
            ))
            conn.commit()
            conn.close()
        except Exception as db_error:
            print(f"Analytics DB error: {db_error}")
        
        return {"status": "ok"}
    except Exception as e:
        print(f"Analytics error: {e}")
        return {"status": "error", "message": str(e)}


# ============================================
# DASHBOARD & EXPORT
# ============================================

@router.get("/dashboard/stats")
async def get_dashboard_stats(client_id: Optional[str] = None):
    """Récupère les statistiques complètes pour le dashboard"""
    try:
        conn = sqlite3.connect(str(DB_FILE))
        cursor = conn.cursor()
        
        # Stats générales
        query = "SELECT COUNT(*) FROM leads"
        params = []
        if client_id:
            query += " WHERE client_id = ?"
            params.append(client_id)
        cursor.execute(query, params)
        total_leads = cursor.fetchone()[0]
        
        # Leads qualifiés
        query = "SELECT COUNT(*) FROM leads WHERE qualification_score >= 0.6"
        params = []
        if client_id:
            query += " AND client_id = ?"
            params.append(client_id)
        cursor.execute(query, params)
        qualified_leads = cursor.fetchone()[0]
        
        # Score moyen
        query = "SELECT AVG(qualification_score) FROM leads WHERE qualification_score IS NOT NULL"
        params = []
        if client_id:
            query += " WHERE client_id = ?"
            params.append(client_id)
        cursor.execute(query, params)
        avg_score = cursor.fetchone()[0] or 0
        
        # Leads par jour (7 derniers jours)
        query = """
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM leads
            WHERE created_at >= datetime('now', '-7 days')
        """
        params = []
        if client_id:
            query += " AND client_id = ?"
            params.append(client_id)
        query += " GROUP BY DATE(created_at) ORDER BY date"
        cursor.execute(query, params)
        leads_by_day = {row[0]: row[1] for row in cursor.fetchall()}
        
        # Top clients
        cursor.execute("""
            SELECT client_id, COUNT(*) as count, AVG(qualification_score) as avg_score
            FROM leads
            GROUP BY client_id
            ORDER BY count DESC
            LIMIT 5
        """)
        top_clients = [
            {
                "client_id": row[0],
                "leads": row[1],
                "avg_score": round(row[2] or 0, 2)
            }
            for row in cursor.fetchall()
        ]
        
        # Analytics events
        try:
            cursor.execute("""
                SELECT event_type, COUNT(*) FROM analytics_events
                GROUP BY event_type
            """)
            analytics = {row[0]: row[1] for row in cursor.fetchall()}
        except:
            analytics = {}
        
        conn.close()
        
        return {
            "total_leads": total_leads,
            "qualified_leads": qualified_leads,
            "qualification_rate": round(qualified_leads / total_leads * 100, 1) if total_leads > 0 else 0,
            "avg_score": round(avg_score, 2),
            "leads_by_day": leads_by_day,
            "top_clients": top_clients,
            "analytics": analytics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leads")
async def get_leads(
    client_id: Optional[str] = None,
    qualified: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0
):
    """Récupère la liste des leads avec filtres"""
    try:
        conn = sqlite3.connect(str(DB_FILE))
        cursor = conn.cursor()
        
        query = """
            SELECT id, client_id, session_id, name, email, phone, company, need,
                   qualification_score, status, created_at
            FROM leads
            WHERE 1=1
        """
        params = []
        
        if client_id:
            query += " AND client_id = ?"
            params.append(client_id)
        
        if qualified is not None:
            if qualified:
                query += " AND qualification_score >= 0.6"
            else:
                query += " AND qualification_score < 0.6"
        
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        leads = [
            {
                "id": row[0],
                "client_id": row[1],
                "session_id": row[2],
                "name": row[3],
                "email": row[4],
                "phone": row[5],
                "company": row[6],
                "need": row[7],
                "qualification_score": row[8],
                "status": row[9],
                "created_at": row[10]
            }
            for row in cursor.fetchall()
        ]
        
        # Total count
        count_query = "SELECT COUNT(*) FROM leads WHERE 1=1"
        count_params = []
        if client_id:
            count_query += " AND client_id = ?"
            count_params.append(client_id)
        if qualified is not None:
            if qualified:
                count_query += " AND qualification_score >= 0.6"
            else:
                count_query += " AND qualification_score < 0.6"
        
        cursor.execute(count_query, count_params)
        total = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "leads": leads,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leads/export")
async def export_leads(
    client_id: Optional[str] = None,
    format: str = "csv"
):
    """Exporte les leads en CSV ou JSON"""
    try:
        conn = sqlite3.connect(str(DB_FILE))
        cursor = conn.cursor()
        
        query = """
            SELECT id, client_id, name, email, phone, company, need,
                   qualification_score, status, conversation_history, created_at
            FROM leads
        """
        params = []
        if client_id:
            query += " WHERE client_id = ?"
            params.append(client_id)
        query += " ORDER BY created_at DESC"
        
        cursor.execute(query, params)
        leads = cursor.fetchall()
        conn.close()
        
        if format == "json":
            return {
                "leads": [
                    {
                        "id": row[0],
                        "client_id": row[1],
                        "name": row[2],
                        "email": row[3],
                        "phone": row[4],
                        "company": row[5],
                        "need": row[6],
                        "qualification_score": row[7],
                        "status": row[8],
                        "conversation": json.loads(row[9] or "[]"),
                        "created_at": row[10]
                    }
                    for row in leads
                ]
            }
        
        # CSV
        import csv
        from fastapi.responses import StreamingResponse
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "ID", "Client", "Nom", "Email", "Téléphone", "Entreprise",
            "Besoin", "Score", "Statut", "Date"
        ])
        
        # Data
        for row in leads:
            writer.writerow([
                row[0], row[1], row[2], row[3], row[4], row[5],
                row[6], row[7], row[8], row[10]
            ])
        
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=leads_{client_id or 'all'}.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leads/{lead_id}/conversation")
async def get_lead_conversation(lead_id: str):
    """Récupère l'historique de conversation d'un lead"""
    try:
        conn = sqlite3.connect(str(DB_FILE))
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT role, message, timestamp
            FROM conversations
            WHERE lead_id = ?
            ORDER BY timestamp ASC
        """, (lead_id,))
        
        messages = [
            {
                "role": row[0],
                "message": row[1],
                "timestamp": row[2]
            }
            for row in cursor.fetchall()
        ]
        
        conn.close()
        
        return {"lead_id": lead_id, "messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))