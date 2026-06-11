// test/widget-test.js
(function() {
    'use strict';
    
    let currentClient = 'client_demo';
    
    function selectClient(clientId) {
        currentClient = clientId;
        
        // Mettre à jour l'UI
        document.querySelectorAll('.client-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-client="${clientId}"]`).classList.add('active');
        
        // Recharger le widget avec le nouveau client
        reloadWidget(clientId);
        
        console.log(`Client sélectionné: ${clientId}`);
    }
    
    function reloadWidget(clientId) {
        // Supprimer l'ancien widget s'il existe
        const oldContainer = document.getElementById('odysseus-widget-container');
        if (oldContainer) {
            oldContainer.remove();
        }
        
        // Supprimer l'ancien script
        const oldScript = document.querySelector('script[data-widget="odysseus"]');
        if (oldScript) {
            oldScript.remove();
        }
        
        // Créer et ajouter le nouveau script
        const script = document.createElement('script');
        script.src = '/static/widget.js';
        script.dataset.clientId = clientId;
        script.dataset.widget = 'odysseus';
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
                <strong>✅ Réponse reçue:</strong><br><br>
                <strong>Client:</strong> ${currentClient}<br>
                <strong>Session ID:</strong> ${data.session_id}<br>
                <strong>Lead ID:</strong> ${data.lead_id || 'N/A'}<br>
                <strong>Score qualification:</strong> ${data.qualification_score}<br>
                <strong>Qualifié:</strong> ${data.is_qualified ? '✅ Oui' : '❌ Non'}<br>
                <strong>Action suggérée:</strong> ${data.suggested_action || 'Aucune'}<br><br>
                <strong>Réponse de l'agent:</strong><br>
                ${data.response}
            `;
            
        } catch (error) {
            responseDiv.innerHTML = `<strong>❌ Erreur:</strong><br>${error.message}`;
        }
    }
    
    // Exposer les fonctions globalement
    window.selectClient = selectClient;
    window.testAPI = testAPI;
    
    // Charger le widget initial
    window.addEventListener('load', () => {
        reloadWidget(currentClient);
    });
})();