/**
 * Performance Monitor for SQLite Visualization
 * Tracks FPS, render times, and event throughput
 */

class PerformanceMonitor {
    constructor() {
        this.enabled = false;
        this.fps = 0;
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        this.fpsHistory = [];

        this.renderTimes = [];
        this.avgRenderTime = 0;

        this.eventCount = 0;
        this.lastEventTime = performance.now();
        this.eventsPerSecond = 0;

        this.memoryUsage = 0;

        this._updateInterval = null;
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
        this._updateInterval = setInterval(() => {
            this._updateMetrics();
        }, 1000);
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
     * Update on-screen display
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
                background: rgba(0, 0, 0, 0.8);
                color: #0f0;
                padding: 10px;
                font-family: monospace;
                font-size: 12px;
                border-radius: 4px;
                z-index: 10000;
                pointer-events: none;
            `;
            document.body.appendChild(statsEl);
        }

        const report = this.getReport();
        statsEl.innerHTML = `
            <div>FPS: ${report.fps} (avg: ${report.avgFps})</div>
            <div>Render: ${report.avgRenderTime}ms</div>
            <div>Events: ${report.eventsPerSecond}/s</div>
            ${report.memoryUsage ? `<div>Memory: ${report.memoryUsage}MB</div>` : ''}
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

// Enable via console: perfMonitor.enable()
// Or: window.perfMonitor.enable()
