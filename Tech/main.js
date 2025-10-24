(async () => {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const status = document.getElementById('status');
    const fps = document.getElementById('fps');

    try {
        status.textContent = 'Инициализация камеры...';
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
        video.srcObject = stream;
        await new Promise(r => video.onloadedmetadata = r);

        const seg = new VideoSegmenter({ downsampleRatio: 0.4, frameSkip: 3 });
        status.textContent = 'Загрузка модели...';
        await seg.loadModel('./RobustVideoMatting/model/model.json');
        await seg.setBackground('./RobustVideoMatting/background.png');
        status.textContent = 'Обработка...';

        let last = performance.now(), frames = 0;

        async function loop() {
            if (video.readyState >= 2) {
                const bmp = await seg.predict(video);
                canvas.width = bmp.width;
                canvas.height = bmp.height;
                ctx.drawImage(bmp, 0, 0);
                frames++;
                const now = performance.now();
                if (now - last > 1000) {
                    fps.textContent = `FPS: ${(frames * 1000 / (now - last)).toFixed(1)}`;
                    frames = 0;
                    last = now;
                }
            }
            requestAnimationFrame(loop);
        }

        loop();
        window._seg = seg;
    } catch (e) {
        console.error(e);
        status.textContent = `Ошибка: ${e.message}`;
    }
})();
