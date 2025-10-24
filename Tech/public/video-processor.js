// public/video-processor.js
// Требуется segmentation.js (должен быть подключён до этого файла)

async function initSegmenter() {
    const seg = new VideoSegmenter({ downsampleRatio: 0.4, frameSkip: 0 });
    await seg.loadModel("/RobustVideoMatting/model/model.json");
    await seg.setBackground("wallpaper.png");

    // 🔁 Автообновление фона каждые 2 секунды
    setInterval(async () => {
        try {
            await seg.reloadBackground();
        } catch (e) {
            console.warn("⚠️ Не удалось обновить фон:", e);
        }
    }, 2000);

    return seg;
}


const videoProcessor = {
    state: {
        overlays: [],
        background: { type: 'none', data: null },
    },
    canvas: new OffscreenCanvas(1, 1),
    ctx: null,
    segmenter: null,

    async init() {
        if (!this.segmenter) this.segmenter = await initSegmenter();
    },

    async transform(frame, controller) {
        try {
            if (!this.ctx) this.ctx = this.canvas.getContext('2d');
            this.canvas.width = frame.displayWidth;
            this.canvas.height = frame.displayHeight;

            // === если сегментер ещё не создан — создаём прямо здесь ===
            if (!this.segmenter) {
                console.log("⏳ Initializing segmenter...");
                this.segmenter = new VideoSegmenter({ downsampleRatio: 0.4, frameSkip: 0 });
                await this.segmenter.loadModel("/RobustVideoMatting/model/model.json");
                await this.segmenter.setBackground("wallpaper.png");
                console.log("✅ Segmenter ready");
            }

            // === предикт ===
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
            controller.enqueue(frame); // fallback
        }
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
        this.ctx.fillStyle = data.textColor;
        lines.forEach((line, index) => {
            this.ctx.fillText(line, data.x, data.y + index * data.fontSize);
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
    removeOverlayById(id) { this.state.overlays = this.state.overlays.filter(o => o.id !== id); },
    clearOverlays() { this.state.overlays = []; },
};

function createProcessedTrack({ track, processor }) {
    const trackProcessor = new MediaStreamTrackProcessor({ track });
    const trackGenerator = new MediaStreamTrackGenerator({ kind: track.kind });
    const transformer = new TransformStream({
        transform: (frame, controller) => processor.transform(frame, controller)
    });
    trackProcessor.readable.pipeThrough(transformer).pipeTo(trackGenerator.writable);
    return trackGenerator;
}
