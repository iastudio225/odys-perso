/**
 * Odysseus Widget - Agent Commercial IA
 * Script à intégrer sur les sites clients
 * Usage: <script src="https://your-vps.com/static/widget.js" data-client-id="client123"></script>
 */

(function() {
    'use strict';
    
    // Configuration
        // Utiliser une URL relative par défaut (pour les tests locaux)
    // En production, surcharger avec window.ODEYSSUES_API_URL ou data-api-url
    const WIDGET_API_URL = window.ODEYSSUES_API_URL 
    || document.currentScript?.dataset?.apiUrl 
    || '/api/widget';  // URL relative par défaut

    const CLIENT_ID = document.currentScript?.dataset?.clientId || 'default';
    const WIDGET_POSITION = document.currentScript?.dataset?.position || 'bottom-right'; // bottom-right, bottom-left, embedded
    
    // État du widget
    let sessionId = null;
    let leadId = null;
    let isWidgetOpen = false;
    let visitorData = {};
    
    // Styles CSS
    const widgetStyles = `
        <style>
            #odysseus-widget-container {
                position: fixed;
                ${WIDGET_POSITION.includes('left') ? 'left: 20px;' : 'right: 20px;'}
                bottom: 20px;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            }
            
            #odysseus-widget-button {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            
            #odysseus-widget-button:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 16px rgba(0,0,0,0.2);
            }
            
            #odysseus-widget-button svg {
                width: 30px;
                height: 30px;
                fill: white;
            }
            
            #odysseus-widget-chat {
                position: absolute;
                ${WIDGET_POSITION.includes('left') ? 'left: 0;' : 'right: 0;'}
                bottom: 80px;
                width: 380px;
                max-width: calc(100vw - 40px);
                height: 550px;
                max-height: calc(100vh - 100px);
                background: white;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                display: none;
                flex-direction: column;
                overflow: hidden;
                animation: slideUp 0.3s ease;
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            #odysseus-widget-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 16px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            #odysseus-widget-title {
                font-size: 16px;
                font-weight: 600;
                margin: 0;
            }
            
            #odysseus-widget-close {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            #odysseus-widget-messages {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: #f8f9fa;
            }
            
            .odysseus-message {
                margin-bottom: 16px;
                display: flex;
                ${WIDGET_POSITION.includes('left') ? 'flex-direction: row;' : 'flex-direction: row-reverse;'}
                animation: messageSlide 0.3s ease;
            }
            
            @keyframes messageSlide {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .odysseus-message-avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                ${WIDGET_POSITION.includes('left') ? 'margin-right: 12px;' : 'margin-left: 12px;'}
            }
            
            .odysseus-message-avatar svg {
                width: 20px;
                height: 20px;
                fill: white;
            }
            
            .odysseus-message-content {
                max-width: 75%;
                padding: 12px 16px;
                border-radius: 16px;
                font-size: 14px;
                line-height: 1.5;
            }
            
            .odysseus-message.user .odysseus-message-content {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                ${WIDGET_POSITION.includes('left') ? 'border-bottom-right-radius: 4px;' : 'border-bottom-left-radius: 4px;'}
            }
            
            .odysseus-message.bot .odysseus-message-content {
                background: white;
                color: #333;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                ${WIDGET_POSITION.includes('left') ? 'border-bottom-left-radius: 4px;' : 'border-bottom-right-radius: 4px;'}
            }
            
            #odysseus-widget-input-container {
                padding: 16px 20px;
                background: white;
                border-top: 1px solid #e9ecef;
                display: flex;
                gap: 12px;
            }
            
            #odysseus-widget-input {
                flex: 1;
                padding: 12px 16px;
                border: 2px solid #e9ecef;
                border-radius: 24px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.3s;
            }
            
            #odysseus-widget-input:focus {
                border-color: #667eea;
            }
            
            #odysseus-widget-send {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s;
            }
            
            #odysseus-widget-send:hover {
                transform: scale(1.05);
            }
            
            #odysseus-widget-send:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .odysseus-typing {
                display: flex;
                gap: 4px;
                padding: 12px 16px;
            }
            
            .odysseus-typing-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #999;
                animation: typingBounce 1.4s infinite;
            }
            
            .odysseus-typing-dot:nth-child(2) {
                animation-delay: 0.2s;
            }
            
            .odysseus-typing-dot:nth-child(3) {
                animation-delay: 0.4s;
            }
            
            @keyframes typingBounce {
                0%, 60%, 100% {
                    transform: translateY(0);
                }
                30% {
                    transform: translateY(-10px);
                }
            }
            
            @media (max-width: 480px) {
                #odysseus-widget-chat {
                    width: calc(100vw - 20px);
                    height: calc(100vh - 100px);
                    bottom: 70px;
                    ${WIDGET_POSITION.includes('left') ? 'left: 10px;' : 'right: 10px;'}
                }
            }
        </style>
    `;
    
    // HTML du widget
    const widgetHTML = `
        <div id="odysseus-widget-container">
            <div id="odysseus-widget-chat">
                <div id="odysseus-widget-header">
                    <h3 id="odysseus-widget-title">Assistant Virtual</h3>
                    <button id="odysseus-widget-close" title="Fermer">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
                        </svg>
                    </button>
                </div>
                <div id="odysseus-widget-messages">
                    <div class="odysseus-message bot">
                        <div class="odysseus-message-avatar">
                            <svg viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>
                        </div>
                        <div class="odysseus-message-content">
                            Bonjour! Je suis votre assistant virtuel. Comment puis-je vous aider aujourd'hui?
                        </div>
                    </div>
                </div>
                <div id="odysseus-widget-input-container">
                    <input type="text" id="odysseus-widget-input" placeholder="Écrivez votre message..." autocomplete="off">
                    <button id="odysseus-widget-send" title="Envoyer">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <button id="odysseus-widget-button" title="Discuter avec nous">
                <svg viewBox="0 0 20 20">
                    <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
                    <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"/>
                </svg>
            </button>
        </div>
    `;
    
    // Créer le widget
    function createWidget() {
        const container = document.createElement('div');
        container.innerHTML = widgetStyles + widgetHTML;
        document.body.appendChild(container);
        
        // Éléments DOM
        const widgetButton = document.getElementById('odysseus-widget-button');
        const widgetChat = document.getElementById('odysseus-widget-chat');
        const widgetClose = document.getElementById('odysseus-widget-close');
        const widgetInput = document.getElementById('odysseus-widget-input');
        const widgetSend = document.getElementById('odysseus-widget-send');
        const widgetMessages = document.getElementById('odysseus-widget-messages');
        
        // Ouvrir/fermer le widget
        widgetButton.addEventListener('click', () => {
            isWidgetOpen = !isWidgetOpen;
            widgetChat.style.display = isWidgetOpen ? 'flex' : 'none';
            if (isWidgetOpen) {
                widgetInput.focus();
            }
        });
        
        widgetClose.addEventListener('click', () => {
            isWidgetOpen = false;
            widgetChat.style.display = 'none';
        });
        
        // Envoyer un message
        async function sendMessage() {
            const message = widgetInput.value.trim();
            if (!message) return;
            
            // Désactiver l'input
            widgetInput.value = '';
            widgetInput.disabled = true;
            widgetSend.disabled = true;
            
            // Ajouter le message utilisateur
            addMessage(message, 'user');
            
            // Afficher l'indicateur de frappe
            showTyping();
            
            try {
                // Appel API
                const response = await fetch(`${WIDGET_API_URL}/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        client_id: CLIENT_ID,
                        message: message,
                        session_id: sessionId,
                        visitor_data: visitorData,
                        page_url: window.location.href
                    })
                });
                
                if (!response.ok) {
                    throw new Error('API error');
                }
                
                const data = await response.json();
                
                // Sauvegarder la session
                sessionId = data.session_id;
                if (data.lead_id) {
                    leadId = data.lead_id;
                }
                
                // Cacher l'indicateur de frappe
                hideTyping();
                
                // Ajouter la réponse
                addMessage(data.response, 'bot');
                
                // Collecter les données du visiteur si disponibles
                if (data.is_qualified && !visitorData.collected) {
                    collectVisitorData();
                }
                
            } catch (error) {
                console.error('Widget error:', error);
                hideTyping();
                addMessage('Désolé, une erreur est survenue. Veuillez réessayer.', 'bot');
            } finally {
                widgetInput.disabled = false;
                widgetSend.disabled = false;
                widgetInput.focus();
            }
        }
        
        widgetSend.addEventListener('click', sendMessage);
        widgetInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Ajouter un message à la conversation
        function addMessage(text, sender) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `odysseus-message ${sender}`;
            
            const avatarSVG = sender === 'bot' 
                ? '<svg viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>'
                : '<svg viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>';
            
            messageDiv.innerHTML = `
                <div class="odysseus-message-avatar">${avatarSVG}</div>
                <div class="odysseus-message-content">${escapeHtml(text)}</div>
            `;
            
            widgetMessages.appendChild(messageDiv);
            widgetMessages.scrollTop = widgetMessages.scrollHeight;
        }
        
        // Afficher l'indicateur de frappe
        function showTyping() {
            const typingDiv = document.createElement('div');
            typingDiv.className = 'odysseus-message bot';
            typingDiv.id = 'odysseus-typing-indicator';
            typingDiv.innerHTML = `
                <div class="odysseus-message-avatar">
                    <svg viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>
                </div>
                <div class="odysseus-message-content">
                    <div class="odysseus-typing">
                        <div class="odysseus-typing-dot"></div>
                        <div class="odysseus-typing-dot"></div>
                        <div class="odysseus-typing-dot"></div>
                    </div>
                </div>
            `;
            widgetMessages.appendChild(typingDiv);
            widgetMessages.scrollTop = widgetMessages.scrollHeight;
        }
        
        // Cacher l'indicateur de frappe
        function hideTyping() {
            const typingIndicator = document.getElementById('odysseus-typing-indicator');
            if (typingIndicator) {
                typingIndicator.remove();
            }
        }
        
        // Échapper le HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Collecter les données du visiteur
        function collectVisitorData() {
            // Cette fonction peut être étendue pour collecter plus d'informations
            if (!visitorData.collected) {
                visitorData.collected = true;
                visitorData.page_url = window.location.href;
                visitorData.timestamp = new Date().toISOString();
            }
        }
    }
    
    // Initialiser le widget quand le DOM est prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createWidget);
    } else {
        createWidget();
    }
    
})();