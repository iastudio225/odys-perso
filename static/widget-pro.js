/**
 * Odysseus Widget Pro v2.0
 * Agent Commercial IA - Production Ready
 * Features: Multi-langue, Upload, Analytics, RDV, Anti-spam
 */

(function(window, document) {
    'use strict';
    
    // Fonction pour injecter le CSS dynamiquement
    function injectCSS() {
        if (document.getElementById('odysseus-widget-css')) return;
        
        const link = document.createElement('link');
        link.id = 'odysseus-widget-css';
        link.rel = 'stylesheet';
        link.href = '/static/widget-pro.css';
        document.head.appendChild(link);
    }
    
    // Configuration
    const CONFIG = {
        API_URL: window.ODEYSSUES_API_URL || document.currentScript?.dataset?.apiUrl || '/api/widget',
        CLIENT_ID: document.currentScript?.dataset?.clientId || 'client_demo',
        POSITION: document.currentScript?.dataset?.position || 'bottom-right',
        THEME: document.currentScript?.dataset?.theme || 'auto',
        LANGUAGE: document.currentScript?.dataset?.language || 'auto',
        ENABLE_SOUND: document.currentScript?.dataset?.sound !== 'false',
        ENABLE_ANALYTICS: document.currentScript?.dataset?.analytics !== 'false',
        ENABLE_UPLOAD: document.currentScript?.dataset?.upload === 'true',
        ENABLE_BOOKING: document.currentScript?.dataset?.booking === 'true',
        MAX_FILE_SIZE: 5 * 1024 * 1024,
        ALLOWED_FILES: ['image/*', 'application/pdf'],
        RATE_LIMIT: 10,
        ANIMATION_SPEED: 300
    };
    
    // État global
    const state = {
        sessionId: null,
        leadId: null,
        isOpen: false,
        messageCount: 0,
        lastMessageTime: Date.now(),
        language: 'fr',
        visitorData: {},
        conversation: [],
        isTyping: false,
        uploadProgress: 0
    };
    
    // Traductions
    const I18N = {
        fr: {
            welcome: "Bonjour ! Je suis votre assistant virtuel. Comment puis-je vous aider aujourd'hui ?",
            placeholder: "Écrivez votre message...",
            send: "Envoyer",
            upload: "Joindre un fichier",
            booking: "Prendre rendez-vous",
            typing: "écrit...",
            error: "Désolé, une erreur est survenue. Veuillez réessayer.",
            rateLimit: "Trop de messages envoyés. Veuillez patienter quelques instants.",
            fileTooLarge: "Le fichier est trop volumineux (max 5MB).",
            fileTypeNotAllowed: "Type de fichier non autorisé.",
            uploadSuccess: "Fichier envoyé avec succès.",
            bookingTitle: "Prendre un rendez-vous",
            bookingButton: "Choisir un créneau",
            close: "Fermer",
            poweredBy: "Propulsé par Odysseus AI"
        },
        en: {
            welcome: "Hello! I'm your virtual assistant. How can I help you today?",
            placeholder: "Type your message...",
            send: "Send",
            upload: "Attach a file",
            booking: "Book an appointment",
            typing: "is typing...",
            error: "Sorry, an error occurred. Please try again.",
            rateLimit: "Too many messages. Please wait a moment.",
            fileTooLarge: "File is too large (max 5MB).",
            fileTypeNotAllowed: "File type not allowed.",
            uploadSuccess: "File uploaded successfully.",
            bookingTitle: "Book an appointment",
            bookingButton: "Choose a time slot",
            close: "Close",
            poweredBy: "Powered by Odysseus AI"
        },
        es: {
            welcome: "¡Hola! Soy su asistente virtual. ¿Cómo puedo ayudarle?",
            placeholder: "Escriba su mensaje...",
            send: "Enviar",
            upload: "Adjuntar archivo",
            booking: "Reservar cita",
            typing: "está escribiendo...",
            error: "Lo sentimos, ha ocurrido un error. Inténtelo de nuevo.",
            rateLimit: "Demasiados mensajes. Espere un momento.",
            fileTooLarge: "El archivo es demasiado grande (máx. 5MB).",
            fileTypeNotAllowed: "Tipo de archivo no permitido.",
            uploadSuccess: "Archivo subido con éxito.",
            bookingTitle: "Reservar una cita",
            bookingButton: "Elegir un horario",
            close: "Cerrar",
            poweredBy: "Impulsado por Odysseus AI"
        }
    };
    
    function detectLanguage() {
        if (CONFIG.LANGUAGE !== 'auto') return CONFIG.LANGUAGE;
        const browserLang = navigator.language.slice(0, 2);
        return I18N[browserLang] ? browserLang : 'fr';
    }
    
    function t(key) {
        return I18N[state.language][key] || I18N.fr[key];
    }
    
    function trackEvent(event, data = {}) {
        if (!CONFIG.ENABLE_ANALYTICS) return;
        
        const eventData = {
            event,
            client_id: CONFIG.CLIENT_ID,
            session_id: state.sessionId,
            lead_id: state.leadId,
            timestamp: new Date().toISOString(),
            ...data
        };
        
        navigator.sendBeacon?.(`${CONFIG.API_URL}/analytics`, JSON.stringify(eventData));
        console.log('📊 Analytics:', eventData);
    }
    
    function checkRateLimit() {
        const now = Date.now();
        if (now - state.lastMessageTime < 60000) {
            state.messageCount++;
            if (state.messageCount > CONFIG.RATE_LIMIT) {
                return false;
            }
        } else {
            state.messageCount = 1;
            state.lastMessageTime = now;
        }
        return true;
    }
    
    function createWidget() {
        state.language = detectLanguage();
        const texts = I18N[state.language];
        
        const widgetHTML = `
            <div id="odysseus-widget-container" class="odysseus-widget odysseus-widget-${CONFIG.POSITION}">
                <button id="odysseus-widget-toggle" class="odysseus-widget-toggle" aria-label="${texts.send}">
                    <svg class="odysseus-icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span id="odysseus-notification-badge" class="odysseus-notification-badge" style="display: none;">1</span>
                </button>
                
                <div id="odysseus-widget-window" class="odysseus-widget-window">
                    <div class="odysseus-widget-header">
                        <div class="odysseus-widget-header-info">
                            <div class="odysseus-widget-avatar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="odysseus-widget-title">Assistant Virtuel</h3>
                                <span class="odysseus-widget-status">En ligne</span>
                            </div>
                        </div>
                        <div class="odysseus-widget-header-actions">
                            ${CONFIG.ENABLE_BOOKING ? `
                                <button id="odysseus-booking-btn" class="odysseus-header-btn" title="${texts.booking}">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                </button>
                            ` : ''}
                            <button id="odysseus-close-btn" class="odysseus-header-btn" title="${texts.close}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <div id="odysseus-messages" class="odysseus-messages">
                        <div class="odysseus-message bot">
                            <div class="odysseus-message-avatar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path>
                                </svg>
                            </div>
                            <div class="odysseus-message-content">
                                <p>${texts.welcome}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="odysseus-widget-input-container">
                        ${CONFIG.ENABLE_UPLOAD ? `
                            <div class="odysseus-upload-wrapper">
                                <input type="file" id="odysseus-file-input" class="odysseus-file-input" accept="${CONFIG.ALLOWED_FILES.join(',')}" style="display: none;">
                                <button id="odysseus-upload-btn" class="odysseus-upload-btn" title="${texts.upload}">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                                    </svg>
                                </button>
                                <div id="odysseus-upload-progress" class="odysseus-upload-progress" style="display: none;">
                                    <div class="odysseus-progress-bar"></div>
                                </div>
                            </div>
                        ` : ''}
                        <input 
                            type="text" 
                            id="odysseus-input" 
                            class="odysseus-input" 
                            placeholder="${texts.placeholder}" 
                            autocomplete="off"
                            aria-label="${texts.placeholder}"
                        >
                        <button id="odysseus-send-btn" class="odysseus-send-btn" aria-label="${texts.send}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="odysseus-widget-footer">
                        <span>${texts.poweredBy}</span>
                    </div>
                </div>
                
                ${CONFIG.ENABLE_BOOKING ? `
                    <div id="odysseus-booking-modal" class="odysseus-modal" style="display: none;">
                        <div class="odysseus-modal-content">
                            <div class="odysseus-modal-header">
                                <h3>${texts.bookingTitle}</h3>
                                <button class="odysseus-modal-close">&times;</button>
                            </div>
                            <div class="odysseus-modal-body">
                                <p>Intégration calendrier ici (Calendly, Google Calendar...)</p>
                                <button class="odysseus-btn-primary">${texts.bookingButton}</button>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', widgetHTML);
    }
    
    function initEvents() {
        const toggleBtn = document.getElementById('odysseus-widget-toggle');
        const closeBtn = document.getElementById('odysseus-close-btn');
        const windowEl = document.getElementById('odysseus-widget-window');
        const sendBtn = document.getElementById('odysseus-send-btn');
        const input = document.getElementById('odysseus-input');
        const messages = document.getElementById('odysseus-messages');
        
        toggleBtn.addEventListener('click', () => {
            state.isOpen = !state.isOpen;
            windowEl.classList.toggle('odysseus-open', state.isOpen);
            toggleBtn.classList.toggle('odysseus-active', state.isOpen);
            
            if (state.isOpen) {
                input.focus();
                trackEvent('widget_opened');
            } else {
                trackEvent('widget_closed');
            }
        });
        
        closeBtn.addEventListener('click', () => {
            state.isOpen = false;
            windowEl.classList.remove('odysseus-open');
            toggleBtn.classList.remove('odysseus-active');
            trackEvent('widget_closed');
        });
        
        async function sendMessage() {
            const message = input.value.trim();
            if (!message) return;
            
            if (!checkRateLimit()) {
                addMessage(t('rateLimit'), 'error');
                trackEvent('rate_limit_exceeded');
                return;
            }
            
            addMessage(message, 'user');
            input.value = '';
            
            trackEvent('message_sent', { message_length: message.length });
            
            showTyping();
            
            try {
                const response = await fetch(`${CONFIG.API_URL}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client_id: CONFIG.CLIENT_ID,
                        message,
                        session_id: state.sessionId,
                        visitor_data: state.visitorData,
                        page_url: window.location.href
                    })
                });
                
                hideTyping();
                
                if (!response.ok) throw new Error('API error');
                
                const data = await response.json();
                
                state.sessionId = data.session_id;
                if (data.lead_id) state.leadId = data.lead_id;
                
                addMessage(data.response, 'bot');
                
                if (data.is_qualified) {
                    trackEvent('lead_qualified', {
                        score: data.qualification_score,
                        action: data.suggested_action
                    });
                }
                
            } catch (error) {
                hideTyping();
                addMessage(t('error'), 'error');
                trackEvent('error', { error: error.message });
            }
        }
        
        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        if (CONFIG.ENABLE_UPLOAD) {
            const uploadBtn = document.getElementById('odysseus-upload-btn');
            const fileInput = document.getElementById('odysseus-file-input');
            
            uploadBtn.addEventListener('click', () => fileInput.click());
            
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                if (file.size > CONFIG.MAX_FILE_SIZE) {
                    alert(t('fileTooLarge'));
                    trackEvent('upload_error', { reason: 'file_too_large' });
                    return;
                }
                
                const isValidType = CONFIG.ALLOWED_FILES.some(type => {
                    if (type.endsWith('/*')) {
                        return file.type.startsWith(type.replace('/*', '/'));
                    }
                    return file.type === type;
                });
                
                if (!isValidType) {
                    alert(t('fileTypeNotAllowed'));
                    trackEvent('upload_error', { reason: 'invalid_type' });
                    return;
                }
                
                trackEvent('file_uploaded', { filename: file.name, size: file.size });
            });
        }
        
        if (CONFIG.ENABLE_BOOKING) {
            const bookingBtn = document.getElementById('odysseus-booking-btn');
            const modal = document.getElementById('odysseus-booking-modal');
            const modalClose = modal.querySelector('.odysseus-modal-close');
            
            bookingBtn.addEventListener('click', () => {
                modal.style.display = 'flex';
                trackEvent('booking_modal_opened');
            });
            
            modalClose.addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        }
    }
    
    function addMessage(text, sender) {
        const messages = document.getElementById('odysseus-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `odysseus-message ${sender}`;
        
        const avatarSVG = sender === 'bot' 
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
        
        messageDiv.innerHTML = `
            <div class="odysseus-message-avatar">${avatarSVG}</div>
            <div class="odysseus-message-content">
                <p>${escapeHtml(text)}</p>
            </div>
        `;
        
        messages.appendChild(messageDiv);
        messages.scrollTop = messages.scrollHeight;
        
        if (sender === 'bot' && CONFIG.ENABLE_SOUND && state.isOpen) {
            playNotificationSound();
        }
        
        if (!state.isOpen && sender === 'bot') {
            updateNotificationBadge();
        }
    }
    
    function showTyping() {
        const messages = document.getElementById('odysseus-messages');
        const typingDiv = document.createElement('div');
        typingDiv.id = 'odysseus-typing';
        typingDiv.className = 'odysseus-message bot odysseus-typing';
        typingDiv.innerHTML = `
            <div class="odysseus-message-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path>
                </svg>
            </div>
            <div class="odysseus-message-content">
                <div class="odysseus-typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        messages.appendChild(typingDiv);
        messages.scrollTop = messages.scrollHeight;
    }
    
    function hideTyping() {
        const typing = document.getElementById('odysseus-typing');
        if (typing) typing.remove();
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function playNotificationSound() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    }
    
    function updateNotificationBadge() {
        const badge = document.getElementById('odysseus-notification-badge');
        const count = parseInt(badge.textContent) || 0;
        badge.textContent = count + 1;
        badge.style.display = 'block';
    }
    
    // Init
    function init() {
        injectCSS();  // ← Injection du CSS ici
        createWidget();
        initEvents();
        trackEvent('widget_loaded');
        console.log('✅ Odysseus Widget Pro initialized');
    }
    
    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})(window, document);