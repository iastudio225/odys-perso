// test/widget-test.js - Compatible CSP (pas de inline handlers)
(function() {
    'use strict';
    
    let currentClient = 'client_demo';
    
    function selectClient(clientId) {
        currentClient = clientId;
        
        // Mettre à jour l'UI
        document.querySelectorAll('.client-card').forEach(card => {
            card.classList.remove('active');
        });
        const activeCard = document.querySelector(`[data-client="${clientId}"]`);
        if (activeCard) {
            activeCard.classList.add('active');
        }
        
        // Recharger le widget avec le nouveau client
        reloadWidget(clientId);
        
        console.log(`✅ Client sélectionné: ${clientId}`);
    }
    
    function reloadWidget(clientId) {
        // Supprimer l'ancien widget s'il existe
        const oldContainer = document.getElementById('odysseus-widget-container');
        if (oldContainer) {
            oldContainer.remove();
        }
        
        // Supprimer l'ancien script widget
        const oldScript = document.querySelector('script[data-widget="odysseus"]');
        if (oldScript) {
            oldScript.remove();
        }
        
        // Créer et ajouter le nouveau script
        const script = document.createElement('script');
        script.src = '/static/widget.js';
        script.setAttribute('data-client-id', clientId);
        script.setAttribute('data-widget', 'odysseus');
        document.body.appendChild(script);
    }
    
    async function testAPI() {
        const responseDiv = document.getElementById('api-response');
        responseDiv.style.display = 'block';
        responseDiv.textContent = 'Envoi de la requête...';
        
        try {
            const response = await fetch('/api/widget/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    client_id: currentClient,
                    message: "Bonjour, je cherche un site web pour mon entreprise. Budget environ 3000€.",
                    session_id: null,
                    visitor_data: {
                        name: "Test User",
                        email: "test@example.com"
                    },
                    page_url: window.location.href
                })
            });
            
            const data = await response.json();
            
            responseDiv.innerHTML = `
<strong>✅ Réponse reçue:</strong>

<strong>Client:</strong> ${currentClient}
<strong>Session ID:</strong> ${data.session_id}
<strong>Lead ID:</strong> ${data.lead_id || 'N/A'}
<strong>Score qualification:</strong> ${data.qualification_score}
<strong>Qualifié:</strong> ${data.is_qualified ? '✅ Oui' : '❌ Non'}
<strong>Action suggérée:</strong> ${data.suggested_action || 'Aucune'}

<strong>Réponse de l'agent:</strong>
${data.response}
            `;
            
        } catch (error) {
            responseDiv.innerHTML = `<strong>❌ Erreur:</strong>\n${error.message}`;
        }
    }
    
    // Attacher les écouteurs d'événements après le chargement du DOM
    document.addEventListener('DOMContentLoaded', function() {
        // Écouteurs pour les cartes clients
        document.querySelectorAll('.client-card').forEach(card => {
            card.addEventListener('click', function() {
                const clientId = this.getAttribute('data-client');
                if (clientId) {
                    selectClient(clientId);
                }
            });
        });
        
        // Écouteur pour le bouton test API
        const testButton = document.getElementById('test-api-button');
        if (testButton) {
            testButton.addEventListener('click', testAPI);
        }
        
        console.log('🎯 Widget test page initialized');
    });
    
    // Charger le widget initial au chargement complet
    window.addEventListener('load', () => {
        reloadWidget(currentClient);
    });
})();