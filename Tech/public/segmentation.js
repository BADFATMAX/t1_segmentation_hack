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
        this.frameSkip = options.frameSkip ?? 0;
        this._frameCount = 0;
        this._lastBitmap = null;
        this._lastFrame = null;
        this._lastBgReload = 0; // время последней перезагрузки фона
    }

    async loadModel(modelUrl) {
        this.model = await tf.loadGraphModel(modelUrl);
        console.log("✅ Model loaded:", modelUrl);
    }

    async setBackground(pngUrl) {
        // cache-buster - добавил проверку наличия '?'
        const url = pngUrl.includes('?') ? pngUrl : `${pngUrl}?t=${Date.now()}`; 
        const img = new Image();
        img.src = url;
        await img.decode();
        if (this.bgBitmap) this.bgBitmap.close?.();
        this.bgBitmap = await createImageBitmap(img);
        console.log("✅ Background loaded:", url);
    }

    async reloadBackground(pngUrl = "wallpaper.png") {
        // чтобы не перезагружать слишком часто
        const now = Date.now();
        if (now - this._lastBgReload < 1500) return;
        this._lastBgReload = now;
        await this.setBackground(pngUrl);
    }

    async predict(frameLike) {
        if (!this.model) throw new Error('Model not loaded');
        if (!this.bgBitmap) { 
            // Если фон не установлен, пытаемся загрузить дефолтный
            await this.reloadBackground("wallpaper.png"); 
            if (!this.bgBitmap) {
                // Если и это не помогло, используем черный фон, чтобы избежать краша
                console.warn("Background bitmap is null, skipping segmentation.");
                if (frameLike instanceof VideoFrame) return await createImageBitmap(frameLike);
                return frameLike;
            }
        }

        this._frameCount++;
        if (this.frameSkip > 0 && this._frameCount % this.frameSkip !== 0 && this._lastBitmap)
            return this._lastBitmap;

        // 🔁 автообновление фона (если файл поменялся)
        await this.reloadBackground("wallpaper.png");

        let bitmap;
        if (frameLike instanceof VideoFrame) bitmap = await createImageBitmap(frameLike);
        else bitmap = frameLike;

        const src = tf.tidy(() => tf.browser.fromPixels(bitmap).toFloat().div(255).expandDims(0));
        if (frameLike instanceof VideoFrame) bitmap.close();

        // Проверка размера state и входных данных
        // В RVM часто возникает ошибка, если state имеет неправильный размер (например, [1,1,1,1] после инициализации)
        // Но при первом запуске модель должна сама определить размер. 
        // Здесь оставляем оригинальную логику, предполагая, что tf.zeros корректно обрабатывается при первом вызове.

        const [fgr, pha, r1o, r2o, r3o, r4o] = await this.model.executeAsync(
            { src, ...this.state, downsample_ratio: this.downsampleRatio },
            ['fgr', 'pha', 'r1o', 'r2o', 'r3o', 'r4o']
        );

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

        if (!this._canvas) {
            this._canvas = typeof OffscreenCanvas !== 'undefined'
                ? new OffscreenCanvas(w, h)
                : Object.assign(document.createElement('canvas'), { width: w, height: h });
            this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
        }

        this._ctx.clearRect(0, 0, w, h);
        this._ctx.drawImage(this.bgBitmap, 0, 0, w, h);
        this._ctx.drawImage(fgBitmap, 0, 0, w, h);
        fgBitmap.close();

        const outBitmap = (this._canvas instanceof OffscreenCanvas)
            ? this._canvas.transferToImageBitmap()
            : await createImageBitmap(this._canvas);

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