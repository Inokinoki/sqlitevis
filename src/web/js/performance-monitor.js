/**
 * Performance Monitor for SQLite Visualization
 * Tracks FPS, render times, and event throughput
 */

class PerformanceMonitor {
    constructor() {
        this.enabled = false; // DISABLED by default to reduce overhead
        this.fps = 0;
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        this.fpsHistory = [];
        this.maxHistoryLength = 120; // Keep 2 minutes of history at 1-second intervals

        this.renderTimes = [];
        this.avgRenderTime = 0;
        this.maxRenderTime = 0;
        this.minRenderTime = Infinity;

        this.eventCount = 0;
        this.lastEventTime = performance.now();
        this.eventsPerSecond = 0;

        this.memoryUsage = 0;
        this.memoryHistory = [];

        this._updateInterval = null;
        this._displayElement = null;
    }

    /**
     * Enable performance monitoring
     */
    enable() {
        this.enabled = true;
        this._startMonitoring();
    }

    /**
     * Disable performance monitoring
     */
    disable() {
        this.enabled = false;
        if (this._updateInterval) {
            clearInterval(this._updateInterval);
            this._updateInterval = null;
        }
    }

    /**
     * Start monitoring loop
     */
    _startMonitoring() {
        // Update metrics every 500ms for more responsive feedback
        this._updateInterval = setInterval(() => {
            this._updateMetrics();
        }, 500);
    }

    /**
     * Update performance metrics
     */
    _updateMetrics() {
        const now = performance.now();

        // Calculate FPS
        this.fps = this.frameCount;
        this.fpsHistory.push(this.fps);
        if (this.fpsHistory.length > 60) {
            this.fpsHistory.shift();
        }
        this.frameCount = 0;

        // Calculate events per second
        const elapsed = (now - this.lastEventTime) / 1000;
        this.eventsPerSecond = Math.round(this.eventCount / elapsed);
        this.eventCount = 0;
        this.lastEventTime = now;

        // Get memory usage if available
        if (performance.memory) {
            this.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        }

        // Update display if enabled
        if (this.enabled) {
            this._updateDisplay();
        }
    }

    /**
     * Record a frame
     */
    recordFrame(renderTime = 0) {
        if (!this.enabled) return;
        this.frameCount++;

        if (renderTime > 0) {
            this.renderTimes.push(renderTime);
            if (this.renderTimes.length > 100) {
                this.renderTimes.shift();
            }
            this.avgRenderTime = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;

            // Track min/max render times
            if (renderTime > this.maxRenderTime) this.maxRenderTime = renderTime;
            if (renderTime < this.minRenderTime) this.minRenderTime = renderTime;
        }
    }

    /**
     * Record an event
     */
    recordEvent() {
        if (!this.enabled) return;
        this.eventCount++;
    }

    /**
     * Get performance report
     */
    getReport() {
        const avgFps = this.fpsHistory.length > 0
            ? Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length)
            : 0;

        return {
            fps: this.fps,
            avgFps: avgFps,
            avgRenderTime: Math.round(this.avgRenderTime * 100) / 100,
            eventsPerSecond: this.eventsPerSecond,
            memoryUsage: this.memoryUsage
        };
    }

    /**
     * Update on-screen display with enhanced metrics
     */
    _updateDisplay() {
        let statsEl = document.getElementById('perf-stats');
        if (!statsEl) {
            statsEl = document.createElement('div');
            statsEl.id = 'perf-stats';
            statsEl.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.85);
                color: #0f0;
                padding: 12px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 11px;
                border-radius: 6px;
                z-index: 10000;
                pointer-events: none;
                line-height: 1.6;
                min-width: 150px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(statsEl);
            this._displayElement = statsEl;
        }

        const report = this.getReport();

        // Color-code FPS
        const fpsColor = report.fps >= 50 ? '#0f0' : report.fps >= 30 ? '#ff0' : '#f00';
        const avgFpsColor = report.avgFps >= 50 ? '#0f0' : report.avgFps >= 30 ? '#ff0' : '#f00';
        const renderColor = report.avgRenderTime < 20 ? '#0f0' : report.avgRenderTime < 35 ? '#ff0' : '#f00';

        statsEl.innerHTML = `
            <div style="border-bottom: 1px solid #333; padding-bottom: 4px; margin-bottom: 4px; font-weight: bold;">
                Performance
            </div>
            <div><span style="color: ${fpsColor}">FPS:</span> ${report.fps} <span style="color: #666">(avg: <span style="color: ${avgFpsColor}">${report.avgFps}</span>)</span></div>
            <div><span style="color: ${renderColor}">Render:</span> ${report.avgRenderTime}ms</div>
            <div><span style="color: #0ff">Events:</span> ${report.eventsPerSecond}/s</div>
            ${report.memoryUsage ? `<div><span style="color: #f0f">Memory:</span> ${report.memoryUsage}MB</div>` : ''}
            ${this.maxRenderTime > 0 ? `<div style="color: #666; font-size: 10px;">Peak: ${this.maxRenderTime.toFixed(1)}ms</div>` : ''}
        `;
    }

    /**
     * Log performance summary to console
     */
    logSummary() {
        const report = this.getReport();
        console.log('📊 Performance Summary:', {
            fps: `${report.fps} FPS (average: ${report.avgFps})`,
            renderTime: `${report.avgRenderTime}ms average`,
            throughput: `${report.eventsPerSecond} events/second`,
            memory: report.memoryUsage ? `${report.memoryUsage}MB` : 'N/A'
        });
    }
}

// Global performance monitor instance
const perfMonitor = new PerformanceMonitor();

// NOTE: Performance monitoring is DISABLED by default to reduce overhead
// To enable for debugging, run in console: perfMonitor.enable()
// Or: window.perfMonitor.enable()
