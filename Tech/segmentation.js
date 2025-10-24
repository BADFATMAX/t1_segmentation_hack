// segmentation.js
class VideoSegmenter {
    constructor(options = {}) {
        this.model = null;
        this.downsampleRatio = tf.scalar(options.downsampleRatio ?? 0.4, 'float32');
        this.state = {
            r1i: tf.zeros([1, 1, 1, 1], 'float32'),
            r2i: tf.zeros([1, 1, 1, 1], 'float32'),
            r3i: tf.zeros([1, 1, 1, 1], 'float32'),
            r4i: tf.zeros([1, 1, 1, 1], 'float32')
        };
        this.bgBitmap = null;
        this._canvas = null;
        this._ctx = null;

        this.frameSkip = options.frameSkip ?? 0; // обрабатывать каждый N-й кадр
        this._frameCount = 0;
        this._lastBitmap = null;
        this._lastFrame = null;
    }

    async loadModel(modelUrl) {
        this.model = await tf.loadGraphModel(modelUrl);
    }

    async setBackground(pngUrl) {
        const img = new Image();
        img.src = pngUrl;
        await img.decode();
        this.bgBitmap = await createImageBitmap(img);
    }

    async predict(frameLike) {
        if (!this.model) throw new Error('Model not loaded');
        if (!this.bgBitmap) throw new Error('Background not set');

        this._frameCount++;

        // ⚡ Если не время делать предикт — просто наложим старый результат на новый кадр
        if (this.frameSkip > 0 && this._frameCount % this.frameSkip !== 0 && this._lastBitmap) {
            return this._lastBitmap;
        }

        // --- Подготовка входа только если реально предикт ---
        const src = tf.tidy(() => tf.browser.fromPixels(frameLike).toFloat().div(255).expandDims(0));
        
        let ts1 = performance.now();
        const [fgr, pha, r1o, r2o, r3o, r4o] = await this.model.executeAsync(
            { src, ...this.state, downsample_ratio: this.downsampleRatio },
            ['fgr', 'pha', 'r1o', 'r2o', 'r3o', 'r4o']
        );
        console.log(`Model inference time: ${(performance.now() - ts1).toFixed(1)} ms`);


        tf.dispose(this.state);
        this.state = { r1i: r1o, r2i: r2o, r3i: r3o, r4i: r4o };

        const rgba = tf.tidy(() => {
            const rgb = fgr.squeeze(0).mul(255).clipByValue(0, 255).cast('int32');
            const a = pha.squeeze(0).mul(255).clipByValue(0, 255).cast('int32');
            return tf.concat([rgb, a], -1);
        });

        const [h, w] = rgba.shape.slice(0, 2);
        const pixels = new Uint8ClampedArray(await rgba.data());
        const fgImageData = new ImageData(pixels, w, h);
        const fgBitmap = await createImageBitmap(fgImageData);
        tf.dispose([src, fgr, pha, rgba]);

        // --- Композиция с фоном ---
        const targetW = this.bgBitmap.width || w;
        const targetH = this.bgBitmap.height || h;

        if (!this._canvas) {
            this._canvas = typeof OffscreenCanvas !== 'undefined'
                ? new OffscreenCanvas(targetW, targetH)
                : Object.assign(document.createElement('canvas'), { width: targetW, height: targetH });
            this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
        }

        this._ctx.clearRect(0, 0, targetW, targetH);
        this._ctx.drawImage(this.bgBitmap, 0, 0, targetW, targetH);
        this._ctx.drawImage(fgBitmap, 0, 0, targetW, targetH);
        fgBitmap.close();

        const outBitmap = (this._canvas instanceof OffscreenCanvas)
            ? this._canvas.transferToImageBitmap()
            : await createImageBitmap(this._canvas);

        // сохраняем для пропущенных кадров
        if (this._lastBitmap) this._lastBitmap.close?.();
        this._lastBitmap = outBitmap;

        return outBitmap;
    }

    dispose() {
        if (this.model) { this.model.dispose?.(); this.model = null; }
        tf.dispose(this.downsampleRatio);
        tf.dispose(this.state);
        if (this.bgBitmap) { this.bgBitmap.close(); this.bgBitmap = null; }
        if (this._lastBitmap) { this._lastBitmap.close(); this._lastBitmap = null; }
        this._canvas = null;
        this._ctx = null;
    }
}

window.VideoSegmenter = VideoSegmenter;
