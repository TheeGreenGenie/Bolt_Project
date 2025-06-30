// analysis-display.js - Clean presentation logic
class AnalysisDisplay {
    static render(analysis, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="analysis-container">
                ${this.renderHeader(analysis)}
                <div class="analysis-grid">
                    ${this.renderSWOT(analysis.swot)}
                    ${this.renderFinancial(analysis.financial)}
                </div>
                <div class="analysis-grid">
                    ${this.renderMarket(analysis.market)}
                    ${this.renderCompetitors(analysis.competitors)}
                </div>
                <div class="analysis-grid">
                    ${this.renderLicenses(analysis.licenses)}
                    ${this.renderActionItems(analysis.actionItems)}
                </div>
            </div>
        `;
    }

    static renderHeader(analysis) {
        return `
            <div class="analysis-header">
                <h1>${analysis.businessName}</h1>
                <div class="business-type">Business Analysis Report</div>
                <div class="business-type">Generated ${new Date().toLocaleDateString()}</div>
            </div>
        `;
    }

    static renderSWOT(swot) {
        return `
            <div class="analysis-card">
                <div class="card-title">SWOT Analysis</div>
                <div class="swot-grid">
                    <div class="swot-section strengths">
                        <h4>Strengths</h4>
                        <ul>${swot.strengths.map(item => `<li>${item}</li>`).join('')}</ul>
                    </div>
                    <div class="swot-section weaknesses">
                        <h4>Weaknesses</h4>
                        <ul>${swot.weaknesses.map(item => `<li>${item}</li>`).join('')}</ul>
                    </div>
                    <div class="swot-section opportunities">
                        <h4>Opportunities</h4>
                        <ul>${swot.opportunities.map(item => `<li>${item}</li>`).join('')}</ul>
                    </div>
                    <div class="swot-section threats">
                        <h4>Threats</h4>
                        <ul>${swot.threats.map(item => `<li>${item}</li>`).join('')}</ul>
                    </div>
                </div>
            </div>
        `;
    }

    static renderFinancial(financial) {
        return `
            <div class="analysis-card">
                <div class="card-title">Financial Projections</div>
                <div class="financial-grid">
                    <div class="financial-section">
                        <h4>Weekly Expenses</h4>
                        ${Object.entries(financial.weeklyExpenses).map(([key, value]) => 
                            `<div class="expense-item">
                                <span>${this.formatLabel(key)}</span>
                                <span>$${this.formatNumber(value)}</span>
                            </div>`
                        ).join('')}
                    </div>
                    <div class="financial-section">
                        <h4>Weekly Revenue</h4>
                        <div class="revenue-item">
                            <span>Conservative</span>
                            <span>$${this.formatNumber(financial.weeklyRevenue.projectedLow)}</span>
                        </div>
                        <div class="revenue-item">
                            <span>Optimistic</span>
                            <span>$${this.formatNumber(financial.weeklyRevenue.projectedHigh)}</span>
                        </div>
                        <div class="revenue-item">
                            <span>Average Projected</span>
                            <span>$${this.formatNumber(financial.weeklyRevenue.averageProjected)}</span>
                        </div>
                        <div style="margin-top: 15px;">
                            <strong>Revenue Streams:</strong>
                            <ul style="margin: 10px 0 0 20px;">
                                ${financial.weeklyRevenue.revenueStreams.map(stream => `<li>${stream}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    static renderCompetitors(competitors) {
        return `
            <div class="analysis-card">
                <div class="card-title">Key Competitors</div>
                <div class="competitors-grid">
                    ${competitors.map(competitor => `
                        <div class="competitor-card">
                            <h4>${competitor.name}</h4>
                            <div class="competitor-stats">
                                <span><strong>Revenue:</strong> ${competitor.annualRevenue}</span>
                                <span><strong>Market Share:</strong> ${competitor.marketShare}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div>
                                    <strong>Strengths:</strong>
                                    <ul style="margin: 5px 0 0 20px; font-size: 0.9rem;">
                                        ${competitor.strengths.map(strength => `<li>${strength}</li>`).join('')}
                                    </ul>
                                </div>
                                <div>
                                    <strong>Weaknesses:</strong>
                                    <ul style="margin: 5px 0 0 20px; font-size: 0.9rem;">
                                        ${competitor.weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    static renderLicenses(licenses) {
        return `
            <div class="analysis-card">
                <div class="card-title">Required Licenses & Permits</div>
                <div class="licenses-grid">
                    ${licenses.map(license => `
                        <div class="license-card">
                            <h4>${license.name}</h4>
                            <div class="license-details">
                                <span><strong>Cost:</strong> ${license.cost}</span>
                                <span><strong>Time:</strong> ${license.timeToObtain}</span>
                                <span><strong>Authority:</strong> ${license.authority}</span>
                                ${license.required ? '<span style="background: #e74c3c; color: white;"><strong>Required</strong></span>' : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    static renderMarket(market) {
        return `
            <div class="analysis-card">
                <div class="card-title">Market Overview</div>
                <div class="market-stats">
                    <div class="market-stat">
                        <h4>Market Size</h4>
                        <div class="value">${market.size}</div>
                    </div>
                    <div class="market-stat">
                        <h4>Growth Rate</h4>
                        <div class="value">${market.growthRate}</div>
                    </div>
                </div>
                <div class="market-lists">
                    <div class="market-list">
                        <h4>Target Customers</h4>
                        <ul>${market.targetCustomers.map(customer => `<li>${customer}</li>`).join('')}</ul>
                    </div>
                    <div class="market-list">
                        <h4>Market Trends</h4>
                        <ul>${market.marketTrends.map(trend => `<li>${trend}</li>`).join('')}</ul>
                    </div>
                    <div class="market-list">
                        <h4>Market Barriers</h4>
                        <ul>${market.barriers.map(barrier => `<li>${barrier}</li>`).join('')}</ul>
                    </div>
                </div>
            </div>
        `;
    }

    static renderActionItems(actionItems) {
        return `
            <div class="analysis-card">
                <div class="card-title">Recommended Action Items</div>
                <div class="action-items">
                    ${actionItems.map(item => `
                        <div class="action-item">
                            <div class="priority-badge ${item.priority.toLowerCase()}">${item.priority}</div>
                            <div class="action-details">
                                <h4>${item.task}</h4>
                                <div class="action-meta">
                                    <span><strong>Timeline:</strong> ${item.timeline}</span>
                                    <span><strong>Estimated Cost:</strong> ${item.cost}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    static renderGenerateOption() {
        return `
            <div class="generate-analysis-container">
                <h2>No Analysis Available</h2>
                <p>Generate a comprehensive business analysis based on your conversations with our AI consultant.</p>
                <button id="generate-analysis-btn" class="btn-generate">Generate Analysis</button>
            </div>
        `;
    }

    static formatLabel(key) {
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    static formatNumber(num) {
        return typeof num === 'number' ? num.toLocaleString() : num;
    }
}

// Make available globally
window.NewAnalysisDisplay = AnalysisDisplay;