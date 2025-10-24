// public/video-processor.js

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

const videoProcessor = {
    state: {
        overlays: [],
        background: { type: 'none', data: null },
    },
    canvas: new OffscreenCanvas(1, 1),
    ctx: null,

    transform(frame, controller) {
        if (!this.ctx) this.ctx = this.canvas.getContext('2d');
        this.canvas.width = frame.displayWidth;
        this.canvas.height = frame.displayHeight;

        this.updateOverlayStates();
        this.drawBackground(frame);
        this.ctx.drawImage(frame, 0, 0);
        this.drawOverlays();

        const newFrame = new VideoFrame(this.canvas, { timestamp: frame.timestamp });
        frame.close();
        controller.enqueue(newFrame);
    },
    
    updateOverlayStates() {
        this.state.overlays.forEach(overlay => {
            if (overlay.type === 'scrolling-text') {
                if (overlay.data.x === undefined) overlay.data.x = this.canvas.width;
                overlay.data.x -= overlay.data.speed || 2;
                this.ctx.font = `${overlay.data.fontSize}px Arial`;
                const textWidth = this.ctx.measureText(overlay.data.text).width;
                if (overlay.data.x < -textWidth) overlay.data.x = this.canvas.width;
            }
        });
    },

    drawBackground(frame) { /* ... без изменений ... */ },

    drawOverlays() {
        this.state.overlays.forEach(overlay => {
            switch (overlay.type) {
                case 'text': this.drawText(overlay.data); break;
                case 'scrolling-text': this.drawScrollingText(overlay.data); break;
                case 'qr': this.drawQr(overlay.data); break;
                case 'image': this.drawImage(overlay.data); break;
            }
        });
    },

    drawText(data) {
        const lines = data.text.split('\n');
        this.ctx.font = `${data.fontSize}px ${data.fontFamily || 'Arial'}`;
        this.ctx.textBaseline = 'top';
        if (data.hasBackground) {
            let maxWidth = 0;
            lines.forEach(line => { const metrics = this.ctx.measureText(line); if (metrics.width > maxWidth) maxWidth = metrics.width; });
            const padding = data.fontSize * 0.2;
            const bgHeight = (lines.length * data.fontSize) + (padding * 2);
            const rgb = hexToRgb(data.backgroundColor);
            const opacity = data.backgroundOpacity !== undefined ? data.backgroundOpacity : 1;
            if (rgb) {
                this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
                this.ctx.fillRect(data.x, data.y, maxWidth + (padding * 2), bgHeight);
            }
        }
        this.ctx.fillStyle = data.textColor;
        lines.forEach((line, index) => {
            const padding = data.hasBackground ? data.fontSize * 0.2 : 0;
            this.ctx.fillText(line, data.x + padding, data.y + padding + (index * data.fontSize));
        });
    },
    
    drawScrollingText(data) {
        this.ctx.font = `${data.fontSize}px Arial`;
        this.ctx.textBaseline = 'middle';
        const bgHeight = data.fontSize + (data.padding || 10) * 2;
        this.ctx.fillStyle = data.backgroundColor;
        this.ctx.fillRect(0, data.y, this.canvas.width, bgHeight);
        this.ctx.fillStyle = data.textColor;
        this.ctx.fillText(data.text, data.x, data.y + bgHeight / 2);
    },
    
    drawQr(data) {
        if (data.qrCanvas) {
            this.ctx.fillStyle = 'white';
            this.ctx.fillRect(data.x - 5, data.y - 5, data.width + 10, data.height + 10);
            this.ctx.drawImage(data.qrCanvas, data.x, data.y, data.width, data.height);
        }
    },
    
    drawImage(data) {
        if (data.imageElement && data.imageElement.complete) {
            this.ctx.drawImage(data.imageElement, data.x, data.y, data.width, data.height);
        }
    },


    addOverlay(overlay) { overlay.id = Date.now() + Math.random(); this.state.overlays.push(overlay); return overlay.id; },
    getOverlayById(id) { return this.state.overlays.find(o => o.id === id); },
    removeOverlayById(id) { this.state.overlays = this.state.overlays.filter(o => o.id !== id); },
    updateOverlay(id, newData) { const overlay = this.getOverlayById(id); if (overlay) Object.assign(overlay.data, newData); },
    removeOverlaysByGroup(group) { this.state.overlays = this.state.overlays.filter(o => o.group !== group); },
    clearOverlays() { this.state.overlays = []; },
    setBackground(type, data) { /* ... без изменений ... */ }
};

function createProcessedTrack({ track, processor }) {
    const trackProcessor = new MediaStreamTrackProcessor({ track });
    const trackGenerator = new MediaStreamTrackGenerator({ kind: track.kind });
    const transformer = new TransformStream({ transform: (frame, controller) => processor.transform(frame, controller) });
    trackProcessor.readable.pipeThrough(transformer).pipeTo(trackGenerator.writable);
    return trackGenerator;
}
