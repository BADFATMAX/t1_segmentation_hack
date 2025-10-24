// public/video-processor.js
// Требуется segmentation.js (должен быть подключён до этого файла)

async function initSegmenter() {
    const seg = new VideoSegmenter({ downsampleRatio: 0.4, frameSkip: 0 });
    await seg.loadModel("/RobustVideoMatting/model/model.json");
    await seg.setBackground("wallpaper.png");
    return seg;
}

const videoProcessor = {
    state: { overlays: [], background: { type: 'none', data: null } },
    canvas: new OffscreenCanvas(1, 1),
    ctx: null,
    segmenter: null,
    
    // --- Lifecycle and Core Transform ---
    
    async init() {
        if (!this.segmenter) this.segmenter = await initSegmenter();
        setInterval(async () => {
            if (this.segmenter) {
                await this.segmenter.reloadBackground("wallpaper.png");
            }
        }, 2000);
    },

    async transform(frame, controller) {
        try {
            if (!this.ctx) this.ctx = this.canvas.getContext('2d');
            this.canvas.width = frame.displayWidth;
            this.canvas.height = frame.displayHeight;

            if (!this.segmenter) {
                console.log("⏳ Initializing segmenter...");
                this.segmenter = await initSegmenter();
                console.log("✅ Segmenter ready");
            }

            const segBitmap = await this.segmenter.predict(frame);
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(segBitmap, 0, 0);

            this.updateOverlayStates();
            this.drawOverlays();

            const newFrame = new VideoFrame(this.canvas, { timestamp: frame.timestamp });
            controller.enqueue(newFrame);

            frame.close();
            segBitmap.close();
        } catch (err) {
            console.error("Segmentation error:", err);
            controller.enqueue(frame);
        }
    },
    
    // --- Background Management ---

    async setBackground(type, data) {
        if (!this.segmenter) {
            console.warn("Segmenter not ready yet, cannot set background.");
            return;
        }
        const path = (type === 'preset' && data) ? `/backgrounds/${data}` : data;
        if (typeof path === "string") {
            await this.segmenter.setBackground(`${path}?t=${Date.now()}`);
        } else {
            console.warn("setBackground: unknown format", type, data);
        }
    },
    
    // --- Overlay Management (CRUD) ---

    addOverlay(overlay) {
        overlay.id = Date.now() + Math.random();
        this.state.overlays.push(overlay);
        return overlay.id;
    },

    getOverlayById(id) {
        return this.state.overlays.find(o => o.id === id);
    },

    updateOverlay(id, newData) {
        const overlay = this.getOverlayById(id);
        if (overlay) {
            Object.assign(overlay.data, newData);
        }
    },

    removeOverlayById(id) {
        this.state.overlays = this.state.overlays.filter(o => o.id !== id);
    },
    
    removeOverlaysByGroup(groupName) {
        this.state.overlays = this.state.overlays.filter(o => o.group !== groupName);
    },

    clearOverlays() {
        this.state.overlays = [];
    },

    // --- Drawing and State Updates ---
    
    updateOverlayStates() {
        this.state.overlays.forEach(overlay => {
            if (overlay.type === 'scrolling-text') {
                if (overlay.data.x === undefined) overlay.data.x = this.canvas.width;
                // При прокрутке текста нужно обязательно использовать контекст для измерения ширины
                this.ctx.save();
                this.ctx.font = `${overlay.data.fontSize}px Arial`;
                const textWidth = this.ctx.measureText(overlay.data.text).width;
                this.ctx.restore();

                overlay.data.x -= overlay.data.speed || 2;
                if (overlay.data.x < -textWidth) overlay.data.x = this.canvas.width;
            }
        });
    },

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
        this.ctx.save();
        this.ctx.font = `${data.fontSize}px ${data.fontFamily || 'Arial'}`;
        this.ctx.textBaseline = 'top';

        if (data.hasBackground) {
            const tempCtx = document.createElement('canvas').getContext('2d');
            tempCtx.font = this.ctx.font;
            let maxWidth = 0;
            lines.forEach(line => {
                const metrics = tempCtx.measureText(line);
                if (metrics.width > maxWidth) maxWidth = metrics.width;
            });
            const padding = data.fontSize * 0.2;
            const boxWidth = maxWidth + padding * 2;
            const boxHeight = (lines.length * data.fontSize) + padding * 2;
            
            // Draw Background
            this.ctx.globalAlpha = data.backgroundOpacity !== undefined ? data.backgroundOpacity : 0.75;
            this.ctx.fillStyle = data.backgroundColor;
            this.ctx.fillRect(data.x, data.y, boxWidth, boxHeight);
            this.ctx.globalAlpha = 1.0;
            
            // Draw Text (with padding)
            this.ctx.fillStyle = data.textColor;
            lines.forEach((line, index) => {
                this.ctx.fillText(line, data.x + padding, data.y + padding + index * data.fontSize);
            });

        } else {
             // Draw Text (without background, no padding)
             this.ctx.fillStyle = data.textColor;
             lines.forEach((line, index) => {
                this.ctx.fillText(line, data.x, data.y + index * data.fontSize);
            });
        }
        this.ctx.restore();
    },

    drawScrollingText(data) {
        this.ctx.save();
        this.ctx.font = `${data.fontSize}px Arial`;
        this.ctx.textBaseline = 'middle';
        const bgHeight = data.fontSize + (data.padding || 10) * 2;
        this.ctx.fillStyle = data.backgroundColor;
        this.ctx.fillRect(0, data.y, this.canvas.width, bgHeight);
        this.ctx.fillStyle = data.textColor;
        this.ctx.fillText(data.text, data.x, data.y + bgHeight / 2);
        this.ctx.restore();
    },

    drawQr(data) {
        this.ctx.save();
        if (data.qrCanvas) {
            // Draw white background for QR
            this.ctx.fillStyle = 'white';
            this.ctx.fillRect(data.x - 5, data.y - 5, data.width + 10, data.height + 10);
            this.ctx.drawImage(data.qrCanvas, data.x, data.y, data.width, data.height);
        }
        this.ctx.restore();
    },

    drawImage(data) {
        this.ctx.save();
        if (data.imageElement && data.imageElement.complete) {
            this.ctx.drawImage(data.imageElement, data.x, data.y, data.width, data.height);
        }
        this.ctx.restore();
    },
};

function createProcessedTrack({ track, processor }) {
    const trackProcessor = new MediaStreamTrackProcessor({ track });
    const trackGenerator = new MediaStreamTrackGenerator({ kind: track.kind });
    const transformer = new TransformStream({
        async start(controller) {
            await processor.init();
        },
        transform: (frame, controller) => processor.transform(frame, controller)
    });
    trackProcessor.readable.pipeThrough(transformer).pipeTo(trackGenerator.writable);
    return trackGenerator;
}