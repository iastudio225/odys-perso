// test/dashboard.js
(function() {
    'use strict';
    
    let currentClientId = '';
    
    async function loadStats() {
        try {
            const url = currentClientId 
                ? `/api/widget/dashboard/stats?client_id=${currentClientId}`
                : '/api/widget/dashboard/stats';
            
            const response = await fetch(url);
            const stats = await response.json();
            
            document.getElementById('totalLeads').textContent = stats.total_leads;
            document.getElementById('qualifiedLeads').textContent = stats.qualified_leads;
            document.getElementById('qualificationRate').textContent = stats.qualification_rate + '%';
            document.getElementById('avgScore').textContent = stats.avg_score;
            
            renderChart(stats.leads_by_day);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    async function loadLeads() {
        try {
            const url = currentClientId
                ? `/api/widget/leads?client_id=${currentClientId}&limit=50`
                : '/api/widget/leads?limit=50';
            
            const response = await fetch(url);
            const data = await response.json();
            
            renderLeadsTable(data.leads);
        } catch (error) {
            console.error('Error loading leads:', error);
        }
    }
    
    function renderChart(leadsByDay) {
        const chart = document.getElementById('leadsChart');
        chart.innerHTML = '';
        
        const days = Object.keys(leadsByDay).sort();
        const maxLeads = Math.max(...Object.values(leadsByDay), 1);
        
        days.forEach(day => {
            const count = leadsByDay[day];
            const height = (count / maxLeads) * 100;
            
            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.height = height + '%';
            bar.innerHTML = `
                <div class="chart-bar-value">${count}</div>
                <div class="chart-bar-label">${day.slice(5)}</div>
            `;
            
            chart.appendChild(bar);
        });
    }
    
    function renderLeadsTable(leads) {
        const tbody = document.getElementById('leadsTableBody');
        
        if (leads.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">Aucun lead trouvé</td></tr>';
            return;
        }
        
        tbody.innerHTML = leads.map(lead => {
            const scoreClass = lead.qualification_score >= 0.6 ? 'score-high' : 
                              lead.qualification_score >= 0.3 ? 'score-medium' : 'score-low';
            
            return `
                <tr>
                    <td>${new Date(lead.created_at).toLocaleDateString('fr-FR')}</td>
                    <td>${lead.client_id}</td>
                    <td>${lead.name || '-'}</td>
                    <td>${lead.email || '-'}</td>
                    <td>${lead.company || '-'}</td>
                    <td><span class="score-badge ${scoreClass}">${(lead.qualification_score * 100).toFixed(0)}%</span></td>
                    <td>
                        <button class="action-btn btn-view" data-lead-id="${lead.id}">Voir</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Attacher les événements
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => {
                showConversation(btn.dataset.leadId);
            });
        });
    }
    
    async function showConversation(leadId) {
        try {
            const response = await fetch(`/api/widget/leads/${leadId}/conversation`);
            const data = await response.json();
            
            const content = document.getElementById('conversationContent');
            content.innerHTML = data.messages.map(msg => `
                <div class="message ${msg.role}">
                    <div class="message-role">${msg.role === 'user' ? '👤 Visiteur' : '🤖 Agent'}</div>
                    <div>${msg.message}</div>
                </div>
            `).join('');
            
            document.getElementById('conversationModal').classList.add('active');
        } catch (error) {
            console.error('Error loading conversation:', error);
        }
    }
    
    function exportData(format) {
        const url = currentClientId
            ? `/api/widget/leads/export?client_id=${currentClientId}&format=${format}`
            : `/api/widget/leads/export?format=${format}`;
        
        window.open(url, '_blank');
    }
    
    // Event listeners
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('clientFilter').addEventListener('change', (e) => {
            currentClientId = e.target.value;
            loadStats();
            loadLeads();
        });
        
        document.getElementById('refreshBtn').addEventListener('click', () => {
            loadStats();
            loadLeads();
        });
        
        document.getElementById('exportCsvBtn').addEventListener('click', () => exportData('csv'));
        document.getElementById('exportJsonBtn').addEventListener('click', () => exportData('json'));
        
        document.getElementById('closeModal').addEventListener('click', () => {
            document.getElementById('conversationModal').classList.remove('active');
        });
        
        // Initial load
        loadStats();
        loadLeads();
    });
})();