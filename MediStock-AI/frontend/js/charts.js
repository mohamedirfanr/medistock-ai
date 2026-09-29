/**
 * MediStock AI - Chart.js Visualizations Controller
 * Renders modern healthcare analytics: Monthly Demand, Stock vs Demand,
 * Risk Distribution, and Top Consumed Medicines.
 * Supports both direct API data arrays and local simulation fallback.
 */

const ChartManager = {
  // Brand color references
  colors: {
    primary: "#0284c7",
    primaryLight: "rgba(2, 132, 199, 0.15)",
    secondary: "#0d9488",
    secondaryLight: "rgba(13, 148, 136, 0.15)",
    danger: "#ef4444",
    dangerLight: "rgba(239, 68, 68, 0.15)",
    success: "#10b981",
    warning: "#f59e0b",
    slateGrid: "#e2e8f0",
    textMuted: "#64748b"
  },

  // Active chart instances to prevent canvas re-use errors
  instances: {},

  _destroyExisting(canvasId) {
    if (this.instances[canvasId]) {
      try {
        this.instances[canvasId].destroy();
      } catch (e) {}
      delete this.instances[canvasId];
    }
  },

  /**
   * 1. Monthly Medicine Demand Chart (Line Chart with historical + forecast)
   */
  renderMonthlyDemandChart(canvasId, items = null) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    this._destroyExisting(canvasId);

    const medicines = items || (window.medistockData ? window.medistockData.getEnrichedMedicines() : []);
    
    // Sum demands across all medicines for Jan, Feb, Mar, Apr, May (predicted)
    let totalJan = 0, totalFeb = 0, totalMar = 0, totalApr = 0, totalMay = 0;
    medicines.forEach(m => {
      totalJan += Number(m.jan) || 0;
      totalFeb += Number(m.feb) || 0;
      totalMar += Number(m.mar) || 0;
      totalApr += Number(m.apr) || 0;
      totalMay += Number(m.predictedDemand ?? m.predicted_demand) || 0;
    });

    this.instances[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels: ["January", "February", "March", "April", "May (AI Forecast)"],
        datasets: [
          {
            label: "Historical Demand",
            data: [totalJan, totalFeb, totalMar, totalApr, null],
            borderColor: this.colors.primary,
            backgroundColor: this.colors.primaryLight,
            borderWidth: 3,
            pointBackgroundColor: this.colors.primary,
            pointBorderColor: "#fff",
            pointRadius: 5,
            pointHoverRadius: 7,
            fill: true,
            tension: 0.35
          },
          {
            label: "AI Projected Demand",
            data: [null, null, null, totalApr, totalMay],
            borderColor: this.colors.secondary,
            backgroundColor: this.colors.secondaryLight,
            borderWidth: 3,
            borderDash: [6, 6],
            pointBackgroundColor: this.colors.secondary,
            pointBorderColor: "#fff",
            pointRadius: 6,
            pointHoverRadius: 8,
            fill: true,
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              boxWidth: 12,
              usePointStyle: true,
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: "600" }
            }
          },
          tooltip: {
            backgroundColor: "#0f172a",
            padding: 12,
            titleFont: { size: 13, weight: "700" },
            bodyFont: { size: 12 },
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                return ` ${context.dataset.label}: ${context.raw ? context.raw.toLocaleString() + ' units' : ''}`;
              }
            }
          }
        },
        scales: {
          y: {
            grid: { color: this.colors.slateGrid, drawBorder: false },
            ticks: {
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
              color: this.colors.textMuted,
              callback: value => value.toLocaleString()
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: "600" },
              color: this.colors.textMuted
            }
          }
        }
      }
    });

    return this.instances[canvasId];
  },

  /**
   * 2. Current Stock vs Predicted Demand Chart (Grouped Bar Chart)
   */
  renderStockVsDemandChart(canvasId, items = null) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    this._destroyExisting(canvasId);

    const all = items || (window.medistockData ? window.medistockData.getEnrichedMedicines() : []);
    const medicines = all.slice(0, 7); // top 7 items
    const labels = medicines.map(m => m.medicine.split(" ")[0]);
    const currentStocks = medicines.map(m => Number(m.currentStock ?? m.current_stock) || 0);
    const predictedDemands = medicines.map(m => Number(m.predictedDemand ?? m.predicted_demand) || 0);

    this.instances[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Current On-Hand Stock",
            data: currentStocks,
            backgroundColor: "#38bdf8",
            borderRadius: 6,
            barPercentage: 0.7,
            categoryPercentage: 0.8
          },
          {
            label: "Predicted May Demand",
            data: predictedDemands,
            backgroundColor: "#0d9488",
            borderRadius: 6,
            barPercentage: 0.7,
            categoryPercentage: 0.8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              boxWidth: 12,
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: "600" }
            }
          },
          tooltip: {
            backgroundColor: "#0f172a",
            cornerRadius: 8,
            padding: 12
          }
        },
        scales: {
          y: {
            grid: { color: this.colors.slateGrid, drawBorder: false },
            ticks: {
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
              color: this.colors.textMuted
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: "600" },
              color: this.colors.textMuted
            }
          }
        }
      }
    });

    return this.instances[canvasId];
  },

  /**
   * 3. Risk Distribution Chart (Doughnut Chart)
   */
  renderRiskDistributionChart(canvasId, kpisData = null) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    this._destroyExisting(canvasId);

    const kpis = kpisData || (window.medistockData ? window.medistockData.getDashboardKPIs() : {});
    const low = Number(kpis.lowStock ?? kpis.low_stock) || 0;
    const stable = Number(kpis.stableStock ?? kpis.stable_stock) || 0;
    const over = Number(kpis.overstock) || 0;

    this.instances[canvasId] = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["🔴 Shortage Risk", "🟢 Stable Stock", "🟡 Overstock"],
        datasets: [
          {
            data: [low, stable, over],
            backgroundColor: [this.colors.danger, this.colors.success, this.colors.warning],
            borderWidth: 3,
            borderColor: "#ffffff",
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 12,
              padding: 14,
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: "600" }
            }
          },
          tooltip: {
            backgroundColor: "#0f172a",
            cornerRadius: 8,
            padding: 12,
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.raw || 0;
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${context.label}: ${val} medicines (${pct}%)`;
              }
            }
          }
        }
      }
    });

    return this.instances[canvasId];
  },

  /**
   * 4. Top Medicines by Demand (Horizontal Bar Chart)
   */
  renderTopMedicinesChart(canvasId, items = null) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    this._destroyExisting(canvasId);

    const all = items || (window.medistockData ? window.medistockData.getEnrichedMedicines() : []);
    const sorted = [...all]
      .sort((a, b) => (Number(b.predictedDemand ?? b.predicted_demand) || 0) - (Number(a.predictedDemand ?? a.predicted_demand) || 0))
      .slice(0, 6);

    const labels = sorted.map(m => m.medicine);
    const dataValues = sorted.map(m => Number(m.predictedDemand ?? m.predicted_demand) || 0);

    this.instances[canvasId] = new Chart(ctx, {
      type: "bar",
      indexAxis: "y",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Monthly Projected Demand",
            data: dataValues,
            backgroundColor: "rgba(2, 132, 199, 0.85)",
            hoverBackgroundColor: "#0284c7",
            borderRadius: 6,
            barThickness: 18
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0f172a",
            cornerRadius: 8,
            padding: 12
          }
        },
        scales: {
          x: {
            grid: { color: this.colors.slateGrid, drawBorder: false },
            ticks: {
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
              color: this.colors.textMuted
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: "600" },
              color: "#0f172a"
            }
          }
        }
      }
    });

    return this.instances[canvasId];
  }
};

window.ChartManager = ChartManager;
