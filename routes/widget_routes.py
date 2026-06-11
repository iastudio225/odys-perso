"""
Widget Chat API - Agent Commercial IA
Endpoint pour intégrer l'agent Odysseus sur des sites web clients
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
import json
import os
import sqlite3
import httpx
from pathlib import Path

# Après (avec dépendances vides pour bypasser l'auth)
router = APIRouter(
    prefix="/api/widget", 
    tags=["widget"],
    dependencies=[]  # Pas d'authentification requise
)

# Configuration
CONFIG_FILE = Path(__file__).parent.parent / "clients_config.json"
# Utiliser le dossier data/ qui est monté en volume (persistant)
DB_FILE = Path(__file__).parent.parent / "data" / "leads.db"

# Modèles de données
class WidgetMessage(BaseModel):
    client_id: str = Field(..., description="Identifiant du client/site")
    message: str = Field(..., description="Message du visiteur")
    session_id: Optional[str] = Field(None, description="ID de session existante")
    visitor_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Données visiteur (nom, email, etc.)")
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
    llm_provider: str = "gemini"  # gemini, openrouter, groq
    llm_model: str = "gemini-2.0-flash-exp"
    qualification_keywords: List[str] = []
    min_qualification_score: float = 0.6
    webhook_url: Optional[str] = None
    language: str = "fr"

# Gestion de la base de données
def init_db():
    """Initialise la base de données des leads"""
    # S'assurer que le dossier data existe
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    
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
    print(f"✅ Widget DB initialized at {DB_FILE}")

def load_client_config(client_id: str) -> ClientConfig:
    """Charge la configuration d'un client"""
    if not CONFIG_FILE.exists():
        raise HTTPException(status_code=400, detail=f"Configuration file not found for client: {client_id}")
    
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
    
    # Score basé sur les mots-clés de qualification
    for keyword in config.qualification_keywords:
        if keyword.lower() in message_lower:
            score += 0.2
    
    # Score basé sur la longueur du message (engagement)
    if len(message) > 50:
        score += 0.1
    if len(message) > 100:
        score += 0.1
    
    # Score basé sur la présence d'informations de contact
    if '@' in message:
        score += 0.15
    if any(char.isdigit() for char in message):
        score += 0.1
    
    return min(score, 1.0)

async def call_llm_provider(provider: str, model: str, system_prompt: str, user_message: str, conversation_history: List[Dict]) -> str:
    """Appelle le provider LLM configuré"""
    
    # Construire les messages pour l'API
    messages = [
        {"role": "system", "content": system_prompt},
        *conversation_history[-10:],  # Garder les 10 derniers messages
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

    init_db()

@router.post("/chat", response_model=WidgetResponse)
async def widget_chat(message_data: WidgetMessage, background_tasks: BackgroundTasks):
    """
    Endpoint principal pour le chat widget
    Reçoit un message et renvoie la réponse de l'agent IA
    """
    
    # Charger la configuration du client
    config = load_client_config(message_data.client_id)
    
    # Générer ou récupérer les IDs
    session_id = message_data.session_id or generate_session_id()
    lead_id = None
    
    # Connexion DB
    conn = sqlite3.connect(str(DB_FILE))
    cursor = conn.cursor()
    
    try:
        # Vérifier si le lead existe déjà
        cursor.execute(
            "SELECT id, qualification_score, conversation_history FROM leads WHERE session_id = ?",
            (session_id,)
        )
        existing_lead = cursor.fetchone()
        
        if existing_lead:
            lead_id = existing_lead[0]
            conversation_history = json.loads(existing_lead[2] or "[]")
        else:
            # Créer un nouveau lead
            lead_id = generate_lead_id()
            conversation_history = []
            
            # Extraire les données du visiteur
            name = message_data.visitor_data.get("name")
            email = message_data.visitor_data.get("email")
            phone = message_data.visitor_data.get("phone")
            company = message_data.visitor_data.get("company")
            
            cursor.execute("""
                INSERT INTO leads (id, client_id, session_id, name, email, phone, company, need)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (lead_id, message_data.client_id, session_id, name, email, phone, company, message_data.message))
        
        # Calculer le score de qualification
        qualification_score = calculate_qualification_score(message_data.message, config)
        is_qualified = qualification_score >= config.min_qualification_score
        
        # Déterminer l'action suggérée
        suggested_action = None
        if is_qualified:
            suggested_action = "contact_urgent" if qualification_score > 0.8 else "contact_standard"
        elif len(conversation_history) > 4:
            suggested_action = "relance_douce"
        
        # Appeler le LLM
        llm_response = await call_llm_provider(
            provider=config.llm_provider,
            model=config.llm_model,
            system_prompt=config.system_prompt,
            user_message=message_data.message,
            conversation_history=conversation_history
        )
        
        # Mettre à jour l'historique de conversation
        conversation_history.append({"role": "user", "content": message_data.message})
        conversation_history.append({"role": "assistant", "content": llm_response})
        
        # Sauvegarder dans la DB
        cursor.execute("""
            UPDATE leads 
            SET qualification_score = ?, 
                conversation_history = ?,
                updated_at = CURRENT_TIMESTAMP,
                status = ?
            WHERE id = ?
        """, (qualification_score, json.dumps(conversation_history), 
              "qualified" if is_qualified else "new", lead_id))
        
        # Sauvegarder le message dans la table conversations
        cursor.execute("""
            INSERT INTO conversations (lead_id, role, message)
            VALUES (?, ?, ?)
        """, (lead_id, "user", message_data.message))
        
        cursor.execute("""
            INSERT INTO conversations (lead_id, role, message)
            VALUES (?, ?, ?)
        """, (lead_id, "assistant", llm_response))
        
        conn.commit()
        
        # Envoyer notification webhook si lead qualifié
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
    """Récupère la configuration publique d'un widget (sans les prompts sensibles)"""
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