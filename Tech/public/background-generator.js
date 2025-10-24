// public/background-generator.js
const backgroundGenerator = {
    canvas: null,
    ctx: null,

    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas with id "${canvasId}" not found.`);
            return;
        }
        this.ctx = this.canvas.getContext('2d', { alpha: false });
    },

    // ---------- Helpers ----------
    clamp: (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)),
    lerp: (a, b, t) => a + (b - a) * t,

    hexToRgb(hex) {
        hex = hex.trim();
        if (hex[0] === '#') hex = hex.slice(1);
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const n = parseInt(hex, 16);
        if (Number.isNaN(n) || hex.length !== 6) return { r:0, g:0, b:0 };
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    },

    rgbToHex({ r, g, b }) {
        const h = v => v.toString(16).padStart(2, '0');
        return '#' + h(r) + h(g) + h(b);
    },

    mixHex(aHex, bHex, t) {
        const a = this.hexToRgb(aHex), b = this.hexToRgb(bHex);
        return this.rgbToHex({
            r: Math.round(this.lerp(a.r, b.r, t)),
            g: Math.round(this.lerp(a.g, b.g, t)),
            b: Math.round(this.lerp(a.b, b.b, t)),
        });
    },

    // ---------- Core Generation Logic ----------
    generate(options = {}, targetCanvas = null) {
        const {
            primary = '#0052CC',
            secondary = '#00B8D9',
            width = 1920,
            height = 1080,
            cell = 120,
            jitter = 0.6,
            noise = 0.12,
            seed = undefined
        } = options;

        // Используем переданный canvas или дефолтный (для превью)
        const canvasToUse = targetCanvas || this.canvas;
        if (!canvasToUse) return null;
        
        // Получаем контекст для выбранного canvas
        const ctxToUse = targetCanvas ? targetCanvas.getContext('2d', { alpha: false }) : this.ctx;
        if (!ctxToUse) return null;

        canvasToUse.width = width;
        canvasToUse.height = height;

        // Background gradient
        const grad = ctxToUse.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, primary);
        grad.addColorStop(1, secondary);
        ctxToUse.fillStyle = grad;
        ctxToUse.fillRect(0, 0, width, height);

        if (cell <= 0) return canvasToUse.toDataURL('image/png');

        // Seedable PRNG (Mulberry32)
        let s = typeof seed === 'number' ? seed >>> 0 : (Math.random() * 2 ** 32) >>> 0;
        const rand = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

        // Build grid
        const cols = Math.ceil(width / cell);
        const rows = Math.ceil(height / cell);
        const idx = (i, j) => j * (cols + 1) + i;
        const pts = new Array((cols + 1) * (rows + 1));

        for (let j = 0; j <= rows; j++) {
            for (let i = 0; i <= cols; i++) {
                const baseX = i * cell;
                const baseY = j * cell;
                const offX = (i > 0 && i < cols) ? (rand() * 2 - 1) * cell * jitter : 0;
                const offY = (j > 0 && j < rows) ? (rand() * 2 - 1) * cell * jitter : 0;
                let x = baseX + offX;
                let y = baseY + offY;

                if (i === 0) x = 0;
                if (i === cols) x = width;
                if (j === 0) y = 0;
                if (j === rows) y = height;

                pts[idx(i, j)] = { x, y };
            }
        }

        const colorAt = (x, y) => {
            let t = ((x / width) + (y / height)) * 0.5;
            t = this.clamp(t + (rand() * 2 - 1) * noise, 0, 1);
            return this.mixHex(primary, secondary, t);
        };


        // Draw triangles
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                const p00 = pts[idx(i, j)];
                const p10 = pts[idx(i + 1, j)];
                const p01 = pts[idx(i, j + 1)];
                const p11 = pts[idx(i + 1, j + 1)];
                const flip = rand() < 0.5;
                const tris = flip ? [[p00, p10, p11], [p00, p11, p01]] : [[p00, p10, p01], [p10, p11, p01]];
                for (const tri of tris) {
                    const cx = (tri[0].x + tri[1].x + tri[2].x) / 3;
                    const cy = (tri[0].y + tri[1].y + tri[2].y) / 3;
                    ctxToUse.fillStyle = colorAt(cx, cy);
                    ctxToUse.beginPath();
                    ctxToUse.moveTo(tri[0].x, tri[0].y);
                    ctxToUse.lineTo(tri[1].x, tri[1].y);
                    ctxToUse.lineTo(tri[2].x, tri[2].y);
                    ctxToUse.closePath();
                    ctxToUse.fill();
                }
            }
        }
        return canvasToUse.toDataURL('image/png');
    },

    async saveToServer(imageData) {
        if (!imageData) {
            console.error("No image data provided to save.");
            return;
        }
        try {
            const response = await fetch('/save-background', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageData }),
            });
            if (response.ok) {
                console.log('Background saved on server as wallpaper.png');
                // Можно добавить уведомление пользователю, если нужно
            } else {
                const error = await response.json();
                console.error('Failed to save background:', error.error);
            }
        } catch (error) {
            console.error('Error sending background to server:', error);
        }
    }
};
