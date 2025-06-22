/**
 * Medical Device Data Processing Utilities
 * JavaScript library for processing and analyzing medical sensor data
 * 
 * @author Medical Instruments Team
 * @version 1.5.0
 * @date 2024-02-05
 */

/**
 * Utility class for medical data processing and analysis
 */
class MedicalDataProcessor {
    constructor() {
        this.validationRules = {
            heartRate: { min: 40, max: 200, unit: 'bpm' },
            bloodPressureSystolic: { min: 70, max: 250, unit: 'mmHg' },
            bloodPressureDiastolic: { min: 40, max: 150, unit: 'mmHg' },
            oxygenSaturation: { min: 70, max: 100, unit: '%' },
            temperature: { min: 32.0, max: 42.0, unit: '°C' },
            respiratoryRate: { min: 8, max: 40, unit: 'breaths/min' },
            glucoseLevel: { min: 50, max: 600, unit: 'mg/dL' }
        };
        
        this.alertThresholds = {
            critical: {
                heartRate: { min: 50, max: 180 },
                bloodPressureSystolic: { min: 90, max: 180 },
                oxygenSaturation: { min: 90, max: 100 }
            },
            warning: {
                heartRate: { min: 60, max: 150 },
                bloodPressureSystolic: { min: 120, max: 140 },
                oxygenSaturation: { min: 95, max: 100 }
            }
        };
    }

    /**
     * Validate a medical reading against established ranges
     * @param {Object} reading - Medical reading object
     * @param {string} metric - Specific metric to validate
     * @returns {Object} Validation result with status and message
     */
    validateReading(reading, metric) {
        const value = reading[metric];
        const rules = this.validationRules[metric];
        
        if (!rules) {
            return { valid: false, message: `Unknown metric: ${metric}` };
        }
        
        if (value === null || value === undefined) {
            return { valid: false, message: `Missing value for ${metric}` };
        }
        
        if (typeof value !== 'number' || isNaN(value)) {
            return { valid: false, message: `Invalid number for ${metric}` };
        }
        
        if (value < rules.min || value > rules.max) {
            return { 
                valid: false, 
                message: `${metric} value ${value} is outside valid range (${rules.min}-${rules.max} ${rules.unit})` 
            };
        }
        
        return { valid: true, message: 'Valid reading' };
    }

    /**
     * Calculate basic statistics for a dataset
     * @param {Array} data - Array of numeric values
     * @returns {Object} Statistics object
     */
    calculateStatistics(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }
        
        const validData = data.filter(val => typeof val === 'number' && !isNaN(val));
        
        if (validData.length === 0) {
            return null;
        }
        
        const sorted = [...validData].sort((a, b) => a - b);
        const sum = validData.reduce((acc, val) => acc + val, 0);
        const mean = sum / validData.length;
        
        const variance = validData.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / validData.length;
        const standardDeviation = Math.sqrt(variance);
        
        const q1Index = Math.floor(sorted.length * 0.25);
        const q3Index = Math.floor(sorted.length * 0.75);
        const medianIndex = Math.floor(sorted.length * 0.5);
        
        return {
            count: validData.length,
            mean: Math.round(mean * 100) / 100,
            median: sorted[medianIndex],
            min: sorted[0],
            max: sorted[sorted.length - 1],
            standardDeviation: Math.round(standardDeviation * 100) / 100,
            variance: Math.round(variance * 100) / 100,
            q1: sorted[q1Index],
            q3: sorted[q3Index],
            range: sorted[sorted.length - 1] - sorted[0]
        };
    }

    /**
     * Detect anomalies in medical data using statistical analysis
     * @param {Array} readings - Array of medical readings
     * @param {string} metric - Metric to analyze
     * @param {number} threshold - Z-score threshold for anomaly detection
     * @returns {Array} Array of anomalous readings
     */
    detectAnomalies(readings, metric, threshold = 2.5) {
        const values = readings.map(reading => reading[metric]).filter(val => val !== null && val !== undefined);
        const stats = this.calculateStatistics(values);
        
        if (!stats) {
            return [];
        }
        
        const anomalies = [];
        
        readings.forEach((reading, index) => {
            const value = reading[metric];
            if (value !== null && value !== undefined) {
                const zScore = Math.abs((value - stats.mean) / stats.standardDeviation);
                
                if (zScore > threshold) {
                    anomalies.push({
                        index,
                        reading,
                        value,
                        zScore: Math.round(zScore * 100) / 100,
                        severity: zScore > 3 ? 'critical' : 'warning'
                    });
                }
            }
        });
        
        return anomalies;
    }

    /**
     * Calculate moving average for smoothing data
     * @param {Array} data - Array of numeric values
     * @param {number} windowSize - Size of moving window
     * @returns {Array} Smoothed data array
     */
    calculateMovingAverage(data, windowSize = 5) {
        if (!Array.isArray(data) || windowSize < 1) {
            return [];
        }
        
        const result = [];
        
        for (let i = 0; i < data.length; i++) {
            const start = Math.max(0, i - Math.floor(windowSize / 2));
            const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
            const window = data.slice(start, end);
            
            const validValues = window.filter(val => typeof val === 'number' && !isNaN(val));
            const average = validValues.length > 0 
                ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length
                : null;
            
            result.push(average);
        }
        
        return result;
    }

    /**
     * Generate trend analysis for time-series medical data
     * @param {Array} readings - Array of timestamped readings
     * @param {string} metric - Metric to analyze
     * @returns {Object} Trend analysis results
     */
    analyzeTrend(readings, metric) {
        if (!Array.isArray(readings) || readings.length < 2) {
            return null;
        }
        
        // Sort by timestamp
        const sortedReadings = [...readings].sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        const validReadings = sortedReadings.filter(reading => 
            reading[metric] !== null && reading[metric] !== undefined
        );
        
        if (validReadings.length < 2) {
            return null;
        }
        
        // Calculate linear regression
        const n = validReadings.length;
        const timestamps = validReadings.map(r => new Date(r.timestamp).getTime());
        const values = validReadings.map(r => r[metric]);
        
        const sumX = timestamps.reduce((sum, x) => sum + x, 0);
        const sumY = values.reduce((sum, y) => sum + y, 0);
        const sumXY = timestamps.reduce((sum, x, i) => sum + x * values[i], 0);
        const sumXX = timestamps.reduce((sum, x) => sum + x * x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Convert slope to per-hour rate
        const slopePerHour = slope * 3600000; // milliseconds to hours
        
        const firstValue = values[0];
        const lastValue = values[values.length - 1];
        const timeSpanHours = (timestamps[timestamps.length - 1] - timestamps[0]) / 3600000;
        
        return {
            direction: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
            slope: slopePerHour,
            correlation: this.calculateCorrelation(timestamps, values),
            changeOverTime: lastValue - firstValue,
            changeRate: timeSpanHours > 0 ? (lastValue - firstValue) / timeSpanHours : 0,
            timeSpanHours: Math.round(timeSpanHours * 100) / 100
        };
    }

    /**
     * Calculate correlation coefficient between two arrays
     * @param {Array} x - First array
     * @param {Array} y - Second array
     * @returns {number} Correlation coefficient (-1 to 1)
     */
    calculateCorrelation(x, y) {
        if (x.length !== y.length || x.length === 0) {
            return 0;
        }
        
        const n = x.length;
        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = y.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
        const sumXX = x.reduce((sum, val) => sum + val * val, 0);
        const sumYY = y.reduce((sum, val) => sum + val * val, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
        
        return denominator === 0 ? 0 : numerator / denominator;
    }

    /**
     * Check reading against alert thresholds
     * @param {Object} reading - Medical reading
     * @param {string} metric - Metric to check
     * @returns {Object} Alert information
     */
    checkAlerts(reading, metric) {
        const value = reading[metric];
        
        if (value === null || value === undefined) {
            return { level: 'none', message: null };
        }
        
        const critical = this.alertThresholds.critical[metric];
        const warning = this.alertThresholds.warning[metric];
        
        if (critical && (value < critical.min || value > critical.max)) {
            return {
                level: 'critical',
                message: `CRITICAL: ${metric} value ${value} is outside safe range`,
                value,
                threshold: critical
            };
        }
        
        if (warning && (value < warning.min || value > warning.max)) {
            return {
                level: 'warning',
                message: `WARNING: ${metric} value ${value} requires attention`,
                value,
                threshold: warning
            };
        }
        
        return { level: 'normal', message: null };
    }

    /**
     * Generate a comprehensive medical report
     * @param {Array} readings - Array of medical readings
     * @param {Object} options - Report options
     * @returns {Object} Comprehensive medical report
     */
    generateReport(readings, options = {}) {
        const metrics = options.metrics || Object.keys(this.validationRules);
        const includeCharts = options.includeCharts || false;
        const patientId = options.patientId;
        
        const report = {
            patientId,
            generatedAt: new Date().toISOString(),
            timeRange: {
                start: readings.length > 0 ? readings[0].timestamp : null,
                end: readings.length > 0 ? readings[readings.length - 1].timestamp : null,
                totalReadings: readings.length
            },
            metrics: {},
            alerts: [],
            summary: {}
        };
        
        metrics.forEach(metric => {
            const values = readings.map(r => r[metric]).filter(v => v !== null && v !== undefined);
            
            if (values.length === 0) {
                report.metrics[metric] = { status: 'no_data' };
                return;
            }
            
            const stats = this.calculateStatistics(values);
            const trend = this.analyzeTrend(readings, metric);
            const anomalies = this.detectAnomalies(readings, metric);
            
            // Collect all alerts for this metric
            const metricAlerts = readings.map(reading => this.checkAlerts(reading, metric))
                .filter(alert => alert.level !== 'none' && alert.level !== 'normal');
            
            report.alerts.push(...metricAlerts);
            
            report.metrics[metric] = {
                statistics: stats,
                trend: trend,
                anomalies: anomalies.length,
                alertCount: metricAlerts.length,
                lastValue: values[values.length - 1],
                validationRules: this.validationRules[metric]
            };
            
            if (includeCharts) {
                report.metrics[metric].chartData = {
                    timestamps: readings.map(r => r.timestamp),
                    values: readings.map(r => r[metric]),
                    movingAverage: this.calculateMovingAverage(values, 5)
                };
            }
        });
        
        // Generate summary
        const totalAlerts = report.alerts.length;
        const criticalAlerts = report.alerts.filter(a => a.level === 'critical').length;
        const warningAlerts = report.alerts.filter(a => a.level === 'warning').length;
        
        report.summary = {
            overallStatus: criticalAlerts > 0 ? 'critical' : warningAlerts > 0 ? 'warning' : 'normal',
            totalAlerts,
            criticalAlerts,
            warningAlerts,
            dataQuality: this.assessDataQuality(readings),
            recommendations: this.generateRecommendations(report)
        };
        
        return report;
    }

    /**
     * Assess the quality of medical data
     * @param {Array} readings - Array of readings
     * @returns {Object} Data quality assessment
     */
    assessDataQuality(readings) {
        if (readings.length === 0) {
            return { score: 0, issues: ['No data available'] };
        }
        
        const issues = [];
        let score = 100;
        
        // Check for missing timestamps
        const missingTimestamps = readings.filter(r => !r.timestamp).length;
        if (missingTimestamps > 0) {
            issues.push(`${missingTimestamps} readings missing timestamps`);
            score -= (missingTimestamps / readings.length) * 20;
        }
        
        // Check for data gaps
        const timestamps = readings.map(r => new Date(r.timestamp)).sort((a, b) => a - b);
        const gaps = [];
        for (let i = 1; i < timestamps.length; i++) {
            const gap = timestamps[i] - timestamps[i - 1];
            if (gap > 3600000) { // More than 1 hour gap
                gaps.push(gap);
            }
        }
        
        if (gaps.length > 0) {
            issues.push(`${gaps.length} significant time gaps detected`);
            score -= Math.min(gaps.length * 5, 15);
        }
        
        // Check for missing values
        const metrics = Object.keys(this.validationRules);
        metrics.forEach(metric => {
            const missing = readings.filter(r => r[metric] === null || r[metric] === undefined).length;
            const missingPercent = (missing / readings.length) * 100;
            
            if (missingPercent > 20) {
                issues.push(`${metric}: ${missingPercent.toFixed(1)}% missing values`);
                score -= missingPercent * 0.5;
            }
        });
        
        return {
            score: Math.max(0, Math.round(score)),
            issues,
            completeness: Math.round((1 - issues.length / 10) * 100)
        };
    }

    /**
     * Generate recommendations based on the medical report
     * @param {Object} report - Medical report
     * @returns {Array} Array of recommendations
     */
    generateRecommendations(report) {
        const recommendations = [];
        
        if (report.summary.criticalAlerts > 0) {
            recommendations.push({
                priority: 'high',
                message: 'Immediate medical attention required due to critical alerts',
                action: 'Contact healthcare provider immediately'
            });
        }
        
        if (report.summary.warningAlerts > 5) {
            recommendations.push({
                priority: 'medium',
                message: 'Multiple warning alerts detected',
                action: 'Schedule follow-up appointment with healthcare provider'
            });
        }
        
        if (report.summary.dataQuality.score < 70) {
            recommendations.push({
                priority: 'low',
                message: 'Data quality could be improved',
                action: 'Check sensor connections and ensure regular measurements'
            });
        }
        
        return recommendations;
    }

    /**
     * Export report to various formats
     * @param {Object} report - Medical report to export
     * @param {string} format - Export format ('json', 'csv', 'pdf')
     * @returns {string|Object} Exported data
     */
    exportReport(report, format = 'json') {
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(report, null, 2);
            
            case 'csv':
                return this.convertReportToCSV(report);
            
            case 'summary':
                return this.generateTextSummary(report);
            
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * Convert report to CSV format
     * @param {Object} report - Medical report
     * @returns {string} CSV formatted data
     */
    convertReportToCSV(report) {
        const headers = ['Metric', 'Mean', 'Min', 'Max', 'Standard Deviation', 'Alert Count'];
        const rows = [headers.join(',')];
        
        Object.entries(report.metrics).forEach(([metric, data]) => {
            if (data.statistics) {
                const row = [
                    metric,
                    data.statistics.mean || '',
                    data.statistics.min || '',
                    data.statistics.max || '',
                    data.statistics.standardDeviation || '',
                    data.alertCount || 0
                ];
                rows.push(row.join(','));
            }
        });
        
        return rows.join('\n');
    }

    /**
     * Generate a text summary of the report
     * @param {Object} report - Medical report
     * @returns {string} Text summary
     */
    generateTextSummary(report) {
        const summary = [];
        
        summary.push(`Medical Report Summary`);
        summary.push(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);
        summary.push(`Patient ID: ${report.patientId || 'N/A'}`);
        summary.push(`Total Readings: ${report.timeRange.totalReadings}`);
        summary.push(`Overall Status: ${report.summary.overallStatus.toUpperCase()}`);
        summary.push('');
        
        if (report.summary.totalAlerts > 0) {
            summary.push(`Alerts: ${report.summary.criticalAlerts} critical, ${report.summary.warningAlerts} warning`);
            summary.push('');
        }
        
        summary.push('Metrics Overview:');
        Object.entries(report.metrics).forEach(([metric, data]) => {
            if (data.statistics) {
                summary.push(`${metric}: ${data.statistics.mean} (${data.statistics.min}-${data.statistics.max})`);
            }
        });
        
        if (report.summary.recommendations.length > 0) {
            summary.push('');
            summary.push('Recommendations:');
            report.summary.recommendations.forEach(rec => {
                summary.push(`- ${rec.message} (${rec.priority} priority)`);
            });
        }
        
        return summary.join('\n');
    }
}

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MedicalDataProcessor;
}

// Example usage
if (typeof window !== 'undefined') {
    window.MedicalDataProcessor = MedicalDataProcessor;
    
    // Example initialization
    window.medicalProcessor = new MedicalDataProcessor();
    
    console.log('Medical Data Processor loaded successfully');
}
