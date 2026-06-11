// test/widget-pro-test.js - Page de démo du widget Pro (CSP compliant)
(function() {
    'use strict';
    
    let widgetConfig = {
        clientId: 'client_demo',
        position: 'bottom-right',
        language: 'auto',
        sound: true,
        analytics: true,
        upload: false,
        booking: false
    };
    
    let stats = {
        messages: 0,
        leads: 0,
        sessions: new Set()
    };
    
    function loadWidget() {
        widgetConfig.clientId = document.getElementById('clientId').value;
        widgetConfig.position = document.getElementById('position').value;
        widgetConfig.language = document.getElementById('language').value;
        widgetConfig.sound = document.getElementById('enableSound').checked;
        widgetConfig.analytics = document.getElementById('enableAnalytics').checked;
        widgetConfig.upload = document.getElementById('enableUpload').checked;
        widgetConfig.booking = document.getElementById('enableBooking').checked;
        
        // Supprimer l'ancien widget
        const oldWidget = document.querySelector('script[data-widget="odysseus-pro"]');
        if (oldWidget) oldWidget.remove();
        
        const oldContainer = document.getElementById('odysseus-widget-container');
        if (oldContainer) oldContainer.remove();
        
        // Créer le nouveau script
        const script = document.createElement('script');
        script.src = '/static/widget-pro.js';
        script.setAttribute('data-client-id', widgetConfig.clientId);
        script.setAttribute('data-position', widgetConfig.position);
        script.setAttribute('data-language', widgetConfig.language);
        script.setAttribute('data-sound', widgetConfig.sound);
        script.setAttribute('data-analytics', widgetConfig.analytics);
        script.setAttribute('data-upload', widgetConfig.upload);
        script.setAttribute('data-booking', widgetConfig.booking);
        script.setAttribute('data-widget', 'odysseus-pro');
        
        document.body.appendChild(script);
        
        updateIntegrationCode();
        logActivity(`Widget chargé: ${widgetConfig.clientId} (${widgetConfig.position})`);
    }
    
    function updateIntegrationCode() {
        const code = `<script src="https://odysseus.cooligital.africa/static/widget-pro.js"
        data-client-id="${widgetConfig.clientId}"
        data-position="${widgetConfig.position}"
        data-language="${widgetConfig.language}"
        data-sound="${widgetConfig.sound}"
        data-analytics="${widgetConfig.analytics}"
        data-upload="${widgetConfig.upload}"
        data-booking="${widgetConfig.booking}"
><\/script>`;
        
        document.getElementById('integrationCode').textContent = code;
    }
    
    function copyCode() {
        const code = document.getElementById('integrationCode').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('copyBtn');
            btn.textContent = '✅ Copié !';
            btn.classList.add('copied');
            
            setTimeout(() => {
                btn.textContent = '📋 Copier le code';
                btn.classList.remove('copied');
            }, 2000);
        });
    }
    
    function logActivity(message) {
        const log = document.getElementById('activityLog');
        const time = new Date().toLocaleTimeString('fr-FR');
        const entry = document.createElement('div');
        entry.textContent = `[${time}] ${message}`;
        entry.style.marginBottom = '5px';
        entry.style.padding = '5px';
        entry.style.background = 'white';
        entry.style.borderRadius = '4px';
        
        log.insertBefore(entry, log.firstChild);
        
        while (log.children.length > 10) {
            log.removeChild(log.lastChild);
        }
    }
    
    // Écouter les événements du widget
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'odysseus-widget-event') {
            const { event: eventName, data } = event.data;
            
            switch(eventName) {
                case 'message_sent':
                    stats.messages++;
                    document.getElementById('statMessages').textContent = stats.messages;
                    logActivity(`Message envoyé`);
                    break;
                    
                case 'lead_qualified':
                    stats.leads++;
                    document.getElementById('statLeads').textContent = stats.leads;
                    logActivity(`Lead qualifié (score: ${data.score})`);
                    break;
                    
                case 'widget_opened':
                    if (data && data.session_id) {
                        stats.sessions.add(data.session_id);
                        document.getElementById('statSessions').textContent = stats.sessions.size;
                    }
                    logActivity('Widget ouvert');
                    break;
                    
                case 'widget_closed':
                    logActivity('Widget fermé');
                    break;
                    
                case 'file_uploaded':
                    logActivity(`Fichier uploadé: ${data.filename}`);
                    break;
                    
                case 'booking_modal_opened':
                    logActivity('Modal RDV ouvert');
                    break;
            }
        }
    });
    
    // Initialisation après chargement du DOM
    document.addEventListener('DOMContentLoaded', () => {
        logActivity('Page de démo chargée');
        updateIntegrationCode();
        
        // Attacher les event listeners
        document.getElementById('loadWidgetBtn').addEventListener('click', loadWidget);
        document.getElementById('copyBtn').addEventListener('click', copyCode);
    });
})();