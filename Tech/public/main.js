// public/main.js
class App {
    constructor() {
        this.employeeData = null;
        this.localVideo = document.getElementById('localVideo');
        this.selectedOverlayId = null;
        this.fpsCounter = document.getElementById('fps-counter');
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.currentPrivacyLevel = 'high';
        this.selectedPresetFilename = null; // Для хранения имени выбранного фона
        // Добавленные пресеты цветов
        this.COMPANY_PRESETS = {
            "Сбер": { "primary_color": [0, 166, 81], "secondary_color": [0, 102, 51] },
            "Тбанк": { "primary_color": [255, 215, 0], "secondary_color": [0, 0, 0] },
            "Т1": { "primary_color": [0, 90, 255], "secondary_color": [255, 255, 255] },
            "Яндекс": { "primary_color": [255, 0, 0], "secondary_color": [255, 255, 255] },
            "Роснефть": { "primary_color": [255, 204, 0], "secondary_color": [0, 0, 0] },
            "Газпром": { "primary_color": [0, 92, 184], "secondary_color": [255, 255, 255] }
        };
        this.init();
    }

    async init() {
        await this.loadEmployeeData();
        ui.init(this);
        backgroundGenerator.init('previewCnv');
        if (this.employeeData) {
            const { primary, secondary } = this.employeeData.branding.corporate_colors;
            ui.setGeneratorColors(primary, secondary);
            this.regenerateBackground(false);
            this.currentPrivacyLevel = this.employeeData.privacy_level || 'high';
        }
        await this.startVideoStream();
        this.calculateFps();
        ui.redrawInteractionLayer();
        this.refreshPrivacyOverlay();
        ui.renderLayersPanel();
        await this.loadPresetBackgrounds();
        ui.elements.showLogoCheckbox.checked = false; 
        ui.renderCompanyPresets(this.COMPANY_PRESETS); // Вызываем рендеринг пресетов
    }

    // Хелпер для конвертации RGB в HEX
    rgbToHex(rgb) {
        const h = v => v.toString(16).padStart(2, '0');
        return '#' + h(rgb[0]) + h(rgb[1]) + h(rgb[2]);
    }

    applyCompanyPreset(companyName) {
        const preset = this.COMPANY_PRESETS[companyName];
        if (preset) {
            const primaryHex = this.rgbToHex(preset.primary_color);
            const secondaryHex = this.rgbToHex(preset.secondary_color);
            
            ui.setGeneratorColors(primaryHex, secondaryHex);
            this.regenerateBackground(true); // Обновляем превью И сохраняем на сервер
        }
    }
    
    async loadEmployeeData() {
        try {
            const response = await fetch('employee.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.employeeData = (await response.json()).employee;
        } catch (error) { console.error('Failed to load employee data:', error); alert('Не удалось загрузить данные о сотруднике (employee.json).'); }
    }

    async loadPresetBackgrounds() {
        try {
            const response = await fetch('/list-backgrounds');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const files = await response.json();
            ui.renderPresetBackgrounds(files);
        } catch (error) {
            console.error('Failed to load preset backgrounds:', error);
        }
    }

    async startVideoStream() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
            const processedTrack = createProcessedTrack({ track: stream.getVideoTracks()[0], processor: videoProcessor });
            this.localVideo.srcObject = new MediaStream([processedTrack]);
        } catch(err) { console.error("Error starting video stream:", err); alert("Не удалось получить доступ к камере. Проверьте разрешения в браузере."); }
    }
    
    updatePrivacyLevel(level) {
        if (!this.employeeData) return;
        this.currentPrivacyLevel = level;
        this.refreshPrivacyOverlay();
    }


    refreshPrivacyOverlay() {
        if (!this.employeeData) return;
        videoProcessor.removeOverlaysByGroup('privacy');
        this.selectOverlayForEditing(null);
        if (ui.elements.showPrivacyCheckbox.checked) {
            let text = '';
            switch (this.currentPrivacyLevel) {
                case 'high': text = `${this.employeeData.full_name}\n${this.employeeData.position}\n${this.employeeData.company}\n${this.employeeData.department}\n${this.employeeData.office_location}\n${this.employeeData.contact.email}\n${this.employeeData.contact.telegram}`; break;
                case 'medium': text = `${this.employeeData.full_name}\n${this.employeeData.position}\n${this.employeeData.company}\n${this.employeeData.department}\n${this.employeeData.office_location}`; break;
                case 'low': text = `${this.employeeData.full_name}\n${this.employeeData.position}`; break;
            }
            ui.updatePrivacyPreview(text);
            if (text) {
                const initialX = 20, initialY = 20; 
                const style = { 
                    text, 
                    x: initialX, 
                    y: initialY, 
                    fontSize: 20, 
                    fontFamily: 'Arial', 
                    textColor: '#000000', 
                    hasBackground: true, 
                    backgroundColor: '#FFFFFF', 
                    backgroundOpacity: 0.75 
                };
                const id = videoProcessor.addOverlay({ type: 'text', group: 'privacy', data: style });
                this.selectOverlayForEditing(id); 
            }
        } else { ui.updatePrivacyPreview(''); }
        ui.renderLayersPanel();
    }
    
    addCustomTextOverlay() {
        const text = ui.elements.announcementInput.value;
        if (!text) return;
        const isScrolling = ui.elements.announcementCheckbox.checked;
        if (isScrolling) {
            const data = { text, y: 50, speed: 3, fontSize: 48, textColor: '#FFFFFF', backgroundColor: 'rgba(8, 185, 166, 0.8)', padding: 10 };
            videoProcessor.addOverlay({ type: 'scrolling-text', group: 'custom', data });
        } else {
            const data = { text, x: 100, y: 100, fontSize: 48, fontFamily: 'Arial', textColor: '#000000', hasBackground: true, backgroundColor: '#FFFFFF', backgroundOpacity: 0.75 };
            const id = videoProcessor.addOverlay({ type: 'text', group: 'custom', data });
            this.selectOverlayForEditing(id);
        }
        ui.elements.announcementInput.value = '';
        ui.renderLayersPanel();
    }
    
    addQrCodeOverlay(link, group = 'custom') {
        if (!link) return;
        const tempDiv = document.createElement('div');
        new QRCode(tempDiv, { text: link, width: 200, height: 200 });
        setTimeout(() => {
            const qrCanvas = tempDiv.querySelector('canvas');
            const data = { link, qrCanvas, x: 150, y: 150, width: 200, height: 200 };
            const id = videoProcessor.addOverlay({ type: 'qr', group, data });
            this.selectOverlayForEditing(id);
            ui.renderLayersPanel();
        }, 100);
    }

    addImageOverlay(src, group = 'custom') {
        if (!src) return;

        if (group === 'logo') {
            videoProcessor.removeOverlaysByGroup('logo');
        }

        const imageElement = new Image();
        imageElement.crossOrigin = "anonymous";
        imageElement.src = src;
        imageElement.onload = () => {
            const defaultWidth = (group === 'logo') ? 100 : 200; // Меньший размер для лого
            const aspectRatio = imageElement.naturalWidth / imageElement.naturalHeight;
            
            const initialX = (group === 'logo') ? 1280 - defaultWidth - 20 : 200;
            const initialY = (group === 'logo') ? 720 - (defaultWidth / aspectRatio) - 20 : 200;

            const data = { src, imageElement, x: initialX, y: initialY, width: defaultWidth, height: defaultWidth / aspectRatio, aspectRatio };
            const id = videoProcessor.addOverlay({ type: 'image', group, data });
            this.selectOverlayForEditing(id);
            ui.renderLayersPanel();
        };
        imageElement.onerror = () => { alert('Не удалось загрузить изображение: ' + src); };
    }
    
    toggleLogoOverlay(visible) {
        if (visible) {
            const existingLogo = videoProcessor.state.overlays.find(o => o.group === 'logo');
            if (!existingLogo && this.employeeData?.branding.logo_url) {
                this.addImageOverlay(this.employeeData.branding.logo_url, 'logo');
            }
        } else {
            videoProcessor.removeOverlaysByGroup('logo');
            if (this.selectedOverlayId && !videoProcessor.getOverlayById(this.selectedOverlayId)) {
                 this.selectOverlayForEditing(null);
            }
            ui.renderLayersPanel();
        }
    }


    deleteOverlay(id) {
        if (id === this.selectedOverlayId) this.selectOverlayForEditing(null);
        videoProcessor.removeOverlayById(id);
        ui.renderLayersPanel();
    }


    selectOverlayForEditing(overlayId) {
        this.selectedOverlayId = overlayId;
        const overlay = videoProcessor.getOverlayById(overlayId);
        ui.hideTextEditor();
        ui.hideQrEditor();
        ui.hideImageEditor();
        if (overlay) {
            if (overlay.type === 'text') ui.showTextEditor(overlay);
            else if (overlay.type === 'qr') ui.showQrEditor(overlay);
            else if (overlay.type === 'image') ui.showImageEditor(overlay);
        }
    }

    regenerateBackground(save) {
        const fullOpts = {
             primary: ui.elements.primaryColor.value,
             secondary: ui.elements.secondaryColor.value,
             cell: parseInt(ui.elements.cellInput.value, 10),
             jitter: parseFloat(ui.elements.jitterInput.value),
             width: 1280, 
             height: 720,
        };

        const tempCanvas = document.createElement('canvas');
        const imageData = backgroundGenerator.generate(fullOpts, tempCanvas);

        const previewCanvas = backgroundGenerator.canvas;
        const previewCtx = backgroundGenerator.ctx;
        if (previewCanvas && previewCtx) {
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            previewCtx.drawImage(tempCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
        }

        if (save) {
            backgroundGenerator.saveToServer(imageData);
        }
    }

    applyGeneratedBackground() { videoProcessor.setBackground('image', `wallpaper.png?t=${Date.now()}`); }

    selectPresetBackground(filename) {
        this.selectedPresetFilename = filename;
        ui.updateSelectedPreset(filename); 
    }
    
    async applyPresetBackground() {
        if (!this.selectedPresetFilename) {
            alert('Пожалуйста, сначала выберите фон из галереи.');
            return;
        }

        try {
            const response = await fetch('/set-wallpaper', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: this.selectedPresetFilename }),
            });

            if (response.ok) {
                console.log(`Successfully set ${this.selectedPresetFilename} as wallpaper.`);
                this.applyGeneratedBackground();
            } else {
                const error = await response.json();
                console.error('Failed to set wallpaper:', error.error);
                alert(`Не удалось установить фон: ${error.error}`);
            }
        } catch (error) {
            console.error('Error sending request to set wallpaper:', error);
            alert('Произошла ошибка при отправке запроса на сервер.');
        }
    }


    calculateFps() {
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastTime >= 1000) { this.fpsCounter.textContent = `FPS: ${this.frameCount}`; this.frameCount = 0; this.lastTime = now; }
        requestAnimationFrame(() => this.calculateFps());
    }
}

window.addEventListener('DOMContentLoaded', () => new App());