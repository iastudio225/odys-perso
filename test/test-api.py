#!/usr/bin/env python3
"""
Script de test pour l'API Widget Odysseus
Teste directement l'endpoint /api/widget/chat
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"  # ou https://odysseus.cooligital.africa
CLIENT_ID = "client_demo"

def test_widget_chat():
    """Teste l'endpoint /api/widget/chat"""
    
    print("=" * 60)
    print("🧪 TEST API WIDGET - ODYSSEUS")
    print("=" * 60)
    print(f"URL: {BASE_URL}/api/widget/chat")
    print(f"Client: {CLIENT_ID}")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()
    
    # Test 1: Message simple
    print("📝 Test 1: Message simple")
    print("-" * 60)
    
    payload = {
        "client_id": CLIENT_ID,
        "message": "Bonjour, j'ai besoin d'informations sur vos services.",
        "session_id": None,
        "visitor_data": {},
        "page_url": "https://example.com"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/widget/chat",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Succès!")
            print(f"Session ID: {data.get('session_id')}")
            print(f"Lead ID: {data.get('lead_id')}")
            print(f"Score: {data.get('qualification_score')}")
            print(f"Qualifié: {data.get('is_qualified')}")
            print(f"\nRéponse de l'agent:")
            print(f"{data.get('response')}")
        else:
            print(f"❌ Erreur: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    print()
    time.sleep(1)
    
    # Test 2: Message avec qualification
    print("📝 Test 2: Message avec qualification (budget + projet)")
    print("-" * 60)
    
    payload = {
        "client_id": CLIENT_ID,
        "message": "Je cherche à faire développer un site e-commerce. Mon budget est de 5000€ et j'aimerais lancer dans 2 mois. Mon email est client@entreprise.com",
        "session_id": None,
        "visitor_data": {
            "name": "Jean Dupont",
            "company": "Entreprise Test"
        },
        "page_url": "https://example.com/services"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/widget/chat",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Succès!")
            print(f"Session ID: {data.get('session_id')}")
            print(f"Lead ID: {data.get('lead_id')}")
            print(f"Score: {data.get('qualification_score')}")
            print(f"Qualifié: {'✅ OUI' if data.get('is_qualified') else '❌ NON'}")
            print(f"Action suggérée: {data.get('suggested_action')}")
            print(f"\nRéponse de l'agent:")
            print(f"{data.get('response')}")
        else:
            print(f"❌ Erreur: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    print()
    time.sleep(1)
    
    # Test 3: Configuration client
    print("📝 Test 3: Récupération configuration client")
    print("-" * 60)
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/widget/config/{CLIENT_ID}",
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Configuration reçue:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
        else:
            print(f"❌ Erreur: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    print()
    print("=" * 60)
    print("✅ Tests terminés")
    print("=" * 60)

if __name__ == "__main__":
    test_widget_chat()