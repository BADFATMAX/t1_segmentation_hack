// public/ui-handler.js

const ui = {
    app: null,
    elements: {
        layersPanel: document.getElementById('layers-panel'),
        privacyLowBtn: document.getElementById('privacy-low'),
        privacyMediumBtn: document.getElementById('privacy-medium'),
        privacyHighBtn: document.getElementById('privacy-high'),
        showPrivacyCheckbox: document.getElementById('show-privacy'),
        privacyPreview: document.getElementById('privacy-preview'),
        textEditor: document.getElementById('text-editor'),
        fontSizeInput: document.getElementById('font-size'),
        textColorInput: document.getElementById('text-color'),
        hasBackgroundCheckbox: document.getElementById('has-background'),
        bgColorInput: document.getElementById('bg-color'),
        bgOpacitySlider: document.getElementById('bg-opacity'),
        posXSlider: document.getElementById('pos-x'),
        posYSlider: document.getElementById('pos-y'),
        alignTL: document.getElementById('align-tl'),
        alignTR: document.getElementById('align-tr'),
        alignBL: document.getElementById('align-bl'),
        alignBR: document.getElementById('align-br'),
        qrEditor: document.getElementById('qr-editor'),
        qrEditorLink: document.getElementById('qr-editor-link'),
        qrPosXSlider: document.getElementById('qr-pos-x'),
        qrPosYSlider: document.getElementById('qr-pos-y'),
        imageEditor: document.getElementById('image-editor'),
        imageSizeSlider: document.getElementById('image-size'),
        imagePosXSlider: document.getElementById('image-pos-x'),
        imagePosYSlider: document.getElementById('image-pos-y'),
        interactionCanvas: document.getElementById('interaction-canvas'),
        announcementInput: document.getElementById('announcement'),
        announcementCheckbox: document.getElementById('announcement-scrolling'),
        announcementBtn: document.getElementById('announcementBtn'),
        qrLinkInput: document.getElementById('qrLink'),
        qrBtnDefault: document.getElementById('qrBtnDefault'),
        qrBtnCustom: document.getElementById('qrBtnCustom'),
        imageInput: document.getElementById('image'),
        showLogoCheckbox: document.getElementById('show-logo'), 
        primaryColor: document.getElementById('primary'),
        secondaryColor: document.getElementById('secondary'),
        cellInput: document.getElementById('cell'),
        jitterInput: document.getElementById('jitter'),
        regenBtn: document.getElementById('regen'),
        randomBtn: document.getElementById('random'),
        applyBgBtn: document.getElementById('applyBg'),
        presetBackgroundsGallery: document.getElementById('preset-backgrounds-gallery'),
        applyPresetBgBtn: document.getElementById('applyPresetBgBtn'),
        companyPresetSelect: document.getElementById('company-preset-select'), // НОВЫЙ ЭЛЕМЕНТ
    },
    interactionCtx: null,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    
    init(app) {
        this.app = app;
        if (this.elements.interactionCanvas) {
            this.interactionCtx = this.elements.interactionCanvas.getContext('2d');
        }
        this.addEventListeners();
        const resizeInterval = setInterval(() => {
            if (this.app.localVideo && this.app.localVideo.videoWidth > 0) {
                this.resizeInteractionCanvas();
                clearInterval(resizeInterval);
            }
        }, 500);
        window.addEventListener('resize', () => this.resizeInteractionCanvas());
    },

    resizeInteractionCanvas() {
        const video = this.app.localVideo;
        const canvas = this.elements.interactionCanvas;
        if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;
        const videoRect = video.getBoundingClientRect();
        const containerRect = canvas.parentElement.getBoundingClientRect();
        canvas.width = videoRect.width;
        canvas.height = videoRect.height;
        canvas.style.top = `${videoRect.top - containerRect.top}px`;
        canvas.style.left = `${videoRect.left - containerRect.left}px`;
    },


    addEventListeners() {
        if (this.elements.layersPanel) {
            this.elements.layersPanel.addEventListener('click', (e) => { 
                if (e.target.classList.contains('delete-layer-btn')) {
                    this.app.deleteOverlay(parseFloat(e.target.dataset.id));
                } else if (e.target.closest('.layer-item')) {
                    const id = parseFloat(e.target.closest('.layer-item').dataset.id);
                    this.app.selectOverlayForEditing(id);
                }
            });
        }
        
        if (this.elements.qrBtnDefault) {
            this.elements.qrBtnDefault.addEventListener('click', () => { if (this.app.employeeData?.contact.telegram) this.app.addQrCodeOverlay(this.app.employeeData.contact.telegram); });
        }
        if (this.elements.qrBtnCustom) {
            this.elements.qrBtnCustom.addEventListener('click', () => this.app.addQrCodeOverlay(this.elements.qrLinkInput.value));
        }
        
        if (this.elements.showLogoCheckbox) {
            this.elements.showLogoCheckbox.addEventListener('change', (e) => {
                this.app.toggleLogoOverlay(e.target.checked);
            });
        }
        
        if (this.elements.imageInput) {
            this.elements.imageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => this.app.addImageOverlay(event.target.result, 'custom-image');
                    reader.readAsDataURL(file);
                }
            });
        }

        if (this.elements.presetBackgroundsGallery) {
            this.elements.presetBackgroundsGallery.addEventListener('click', (e) => {
                if (e.target.tagName === 'IMG' && e.target.dataset.filename) {
                    this.app.selectPresetBackground(e.target.dataset.filename);
                }
            });
        }

        if (this.elements.applyPresetBgBtn) {
            this.elements.applyPresetBgBtn.addEventListener('click', () => {
                this.app.applyPresetBackground();
            });
        }

        // НОВЫЙ ОБРАБОТЧИК: Применение пресета цветов
        if (this.elements.companyPresetSelect) {
            this.elements.companyPresetSelect.addEventListener('change', (e) => {
                const companyName = e.target.value;
                if (companyName !== 'default') {
                    this.app.applyCompanyPreset(companyName);
                }
            });
        }

        if (this.elements.privacyLowBtn) {
             this.elements.privacyLowBtn.addEventListener('click', () => this.app.updatePrivacyLevel('low'));
        }
        if (this.elements.privacyMediumBtn) {
             this.elements.privacyMediumBtn.addEventListener('click', () => this.app.updatePrivacyLevel('medium'));
        }
        if (this.elements.privacyHighBtn) {
             this.elements.privacyHighBtn.addEventListener('click', () => this.app.updatePrivacyLevel('high'));
        }
        if (this.elements.showPrivacyCheckbox) {
             this.elements.showPrivacyCheckbox.addEventListener('change', () => this.app.refreshPrivacyOverlay());
        }
        if (this.elements.announcementBtn) {
            this.elements.announcementBtn.addEventListener('click', () => this.app.addCustomTextOverlay());
        }
        
        // Редакторы
        const textEditorInputs = [ this.elements.fontSizeInput, this.elements.textColorInput, this.elements.hasBackgroundCheckbox, this.elements.bgColorInput, this.elements.bgOpacitySlider, this.elements.posXSlider, this.elements.posYSlider ];
        textEditorInputs.forEach(input => {
            if(input) input.addEventListener('input', () => this.updateSelectedTextOverlayFromEditor());
        });
        
        const qrEditorInputs = [ this.elements.qrPosXSlider, this.elements.qrPosYSlider ];
        qrEditorInputs.forEach(input => {
            if(input) input.addEventListener('input', () => this.updateSelectedQrOverlayFromEditor());
        });
        
        const imageEditorInputs = [ this.elements.imagePosXSlider, this.elements.imagePosYSlider, this.elements.imageSizeSlider ];
        imageEditorInputs.forEach(input => {
            if(input) input.addEventListener('input', () => this.updateSelectedImageOverlayFromEditor());
        });


        if (this.elements.alignTL) {
            this.elements.alignTL.addEventListener('click', () => this.alignSelectedOverlay('tl'));
        }
        if (this.elements.alignTR) {
            this.elements.alignTR.addEventListener('click', () => this.alignSelectedOverlay('tr'));
        }
        if (this.elements.alignBL) {
            this.elements.alignBL.addEventListener('click', () => this.alignSelectedOverlay('bl'));
        }
        if (this.elements.alignBR) {
            this.elements.alignBR.addEventListener('click', () => this.alignSelectedOverlay('br'));
        }
        
        if (this.elements.interactionCanvas) {
            this.elements.interactionCanvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            this.elements.interactionCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.elements.interactionCanvas.addEventListener('mouseup', () => this.handleMouseUp());
            this.elements.interactionCanvas.addEventListener('mouseleave', () => this.handleMouseUp());
        }
        
        if (this.elements.regenBtn) {
            this.elements.regenBtn.addEventListener('click', () => this.app.regenerateBackground(true));
        }
        if (this.elements.randomBtn) {
            this.elements.randomBtn.addEventListener('click', () => {
                const randomPleasantPair=()=>{const h1=Math.floor(Math.random()*360),delta=20+Math.floor(Math.random()*120),h2=(h1+delta)%360,s1=60+Math.floor(Math.random()*30),s2=60+Math.random()*30,l1=42+Math.floor(Math.random()*18),l2=42+Math.floor(Math.random()*18),hslToRgb=(h,s,l)=>{s/=100;l/=100;const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let r1=0,g1=0,b1=0;if(0<=h&&h<60){r1=c;g1=x;b1=0}else if(60<=h&&h<120){r1=x;g1=c;b1=0}else if(120<=h&&h<180){r1=0;g1=c;b1=x}else if(180<=h&&h<240){r1=0;g1=x;b1=c}else if(240<=h&&h<300){r1=x;g1=0;b1=c}else{r1=c;g1=0;b1=x}return{r:Math.round((r1+m)*255),g:Math.round((g1+m)*255),b:Math.round((b1+m)*255)}},rgbToHexFast=(r,g,b)=>"#"+[r,g,b].map(v=>v.toString(16).padStart(2,"0")).join(""),c1=hslToRgb(h1,s1,l1),c2=hslToRgb(h2,s2,l2);return[rgbToHexFast(c1.r,c1.g,c1.b),rgbToHexFast(c2.r,c2.g,c2.b)]};
                const [p,s]=randomPleasantPair();this.elements.primaryColor.value=p;this.elements.secondaryColor.value=s;this.elements.cellInput.value=Math.floor(80+Math.random()*120);this.elements.jitterInput.value=(.35+Math.random()*.5).toFixed(2);this.app.regenerateBackground(true)
            });
        }
        if (this.elements.applyBgBtn) {
            this.elements.applyBgBtn.addEventListener('click', () => this.app.applyGeneratedBackground());
        }
    },

    // НОВАЯ ФУНКЦИЯ: Заполнение селектора пресетами
    renderCompanyPresets(presets) {
        const select = this.elements.companyPresetSelect;
        if (!select) return;

        // Удаляем все, кроме первого (default)
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }

        Object.keys(presets).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    },
    
    updateSelectedPreset(selectedFilename) {
        const images = this.elements.presetBackgroundsGallery?.querySelectorAll('img');
        images?.forEach(img => {
            img.classList.toggle('selected', img.dataset.filename === selectedFilename);
        });
    },

    renderPresetBackgrounds(files) {
        const gallery = this.elements.presetBackgroundsGallery;
        if (!gallery) return;

        gallery.innerHTML = '';
        if (files && files.length > 0) {
            files.forEach(file => {
                const img = document.createElement('img');
                img.src = `backgrounds/${file}`;
                img.dataset.filename = file;
                img.alt = file;
                gallery.appendChild(img);
            });
        } else {
            gallery.innerHTML = '<p style="font-size: 0.8em; color: #888;">Нет готовых фонов в папке /public/backgrounds</p>';
        }
    },

    renderLayersPanel() {
        const panel = this.elements.layersPanel;
        if (!panel) return;

        panel.innerHTML = '';
        const overlays = videoProcessor.state.overlays;
        if (overlays.length === 0) { panel.innerHTML = '<p style="font-size: 0.8em; color: #888;">Нет активных слоев</p>'; return; }
        
        [...overlays].reverse().forEach(overlay => {
            const item = document.createElement('div'); 
            item.className = 'layer-item';
            item.dataset.id = overlay.id; 
            const nameSpan = document.createElement('span'); 
            let name = 'Layer';
            if (overlay.type === 'text') name = `Text: "${overlay.data.text.split('\n')[0].substring(0, 20)}..."`;
            else if (overlay.type === 'scrolling-text') name = `Scrolling: "${overlay.data.text.substring(0, 20)}..."`;
            else if (overlay.type === 'qr') name = `QR: ${overlay.data.link.substring(0, 20)}...`;
            else if (overlay.type === 'image') name = overlay.group === 'logo' ? `Logo` : `Image`;
            if (overlay.group === 'privacy') name = `(Privacy) ${name}`;
            
            nameSpan.textContent = name;
            const deleteBtn = document.createElement('button'); 
            deleteBtn.className = 'delete-layer-btn'; 
            deleteBtn.textContent = 'X'; 
            deleteBtn.dataset.id = overlay.id;
            
            item.appendChild(nameSpan); 
            item.appendChild(deleteBtn); 
            panel.appendChild(item);
        });
    },


    updatePrivacyPreview(text) { 
        if (this.elements.privacyPreview) { 
            const content = this.elements.privacyPreview.querySelector('p'); 
            if (content) content.innerText = text || 'Нет данных для отображения.'; 
        } 
    },
    
    setGeneratorColors(primary, secondary) { 
        if (this.elements.primaryColor && this.elements.secondaryColor) { 
            this.elements.primaryColor.value = primary; 
            this.elements.secondaryColor.value = secondary; 
        } 
    },
    
    getOverlayBounds(overlay) {
        if (!overlay) return null;
        if (overlay.type === 'text') return this.getTextOverlayBounds(overlay);
        if (overlay.type === 'qr') return { x: overlay.data.x - 5, y: overlay.data.y - 5, w: overlay.data.width + 10, h: overlay.data.height + 10 };
        if (overlay.type === 'image') return { x: overlay.data.x, y: overlay.data.y, w: overlay.data.width, h: overlay.data.height };
        return { x: 0, y: 0, w: 0, h: 0 };
    },
    
    getTextOverlayBounds(overlay) {
        const tempCtx = document.createElement('canvas').getContext('2d');
        tempCtx.font = `${overlay.data.fontSize}px ${overlay.data.fontFamily || 'Arial'}`;
        const lines = overlay.data.text.split('\n');
        let maxWidth = 0;
        lines.forEach(line => { const metrics = tempCtx.measureText(line); if (metrics.width > maxWidth) maxWidth = metrics.width; });
        const padding = overlay.data.hasBackground ? overlay.data.fontSize * 0.2 : 0;
        const boxW = maxWidth + padding * 2;
        const boxH = (lines.length * overlay.data.fontSize) + padding * 2;
        return { x: overlay.data.x, y: overlay.data.y, w: boxW, h: boxH };
    },

    getMousePos(e) { const rect = this.elements.interactionCanvas.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; },
    getScale() { return { x: this.elements.interactionCanvas.width / 1280, y: this.elements.interactionCanvas.height / 720 }; },
    
    handleMouseDown(e) {
        const { x, y } = this.getMousePos(e);
        const scale = this.getScale();
        const draggableOverlays = [...videoProcessor.state.overlays].reverse().filter(o => o.type === 'text' || o.type === 'qr' || o.type === 'image');
        
        for (const overlay of draggableOverlays) {
            const bounds = this.getOverlayBounds(overlay);
            if (x > bounds.x * scale.x && x < (bounds.x + bounds.w) * scale.x && y > bounds.y * scale.y && y < (bounds.y + bounds.h) * scale.y) {
                this.app.selectOverlayForEditing(overlay.id);
                this.isDragging = true;
                this.dragOffsetX = x - bounds.x * scale.x;
                this.dragOffsetY = y - bounds.y * scale.y;
                this.elements.interactionCanvas.style.cursor = 'grabbing';
                return; 
            }
        }
        this.app.selectOverlayForEditing(null);
    },
    
    handleMouseMove(e) {
        if (!this.isDragging || !this.app.selectedOverlayId) return;
        const { x, y } = this.getMousePos(e);
        const scale = this.getScale();
        let newX = (x - this.dragOffsetX) / scale.x;
        let newY = (y - this.dragOffsetY) / scale.y;

        const overlay = videoProcessor.getOverlayById(this.app.selectedOverlayId);
        if (!overlay) return;
        
        const bounds = this.getOverlayBounds(overlay);
        const videoWidth = 1280, videoHeight = 720;

        newX = Math.max(0, Math.min(newX, videoWidth - bounds.w));
        newY = Math.max(0, Math.min(newY, videoHeight - bounds.h));
        
        videoProcessor.updateOverlay(this.app.selectedOverlayId, { x: newX, y: newY });

        if (overlay.type === 'text') this.updateTextEditorFromOverlay(overlay);
        else if (overlay.type === 'qr') this.updateQrEditorFromOverlay(overlay);
        else if (overlay.type === 'image') this.updateImageEditorFromOverlay(overlay);
    },

    handleMouseUp() { this.isDragging = false; this.elements.interactionCanvas.style.cursor = 'grab'; },

    showTextEditor(overlay) { this.elements.textEditor.style.display = 'block'; this.updateTextEditorFromOverlay(overlay); },
    hideTextEditor() { this.elements.textEditor.style.display = 'none'; },
    showQrEditor(overlay) { this.elements.qrEditor.style.display = 'block'; this.updateQrEditorFromOverlay(overlay); },
    hideQrEditor() { this.elements.qrEditor.style.display = 'none'; },
    showImageEditor(overlay) { this.elements.imageEditor.style.display = 'block'; this.updateImageEditorFromOverlay(overlay); },
    hideImageEditor() { this.elements.imageEditor.style.display = 'none'; },

    updateTextEditorFromOverlay(overlay) {
        if (!overlay || overlay.type !== 'text') return;
        const bounds = this.getTextOverlayBounds(overlay);
        this.elements.posXSlider.max = Math.max(1280, 1280 - bounds.w); 
        this.elements.posYSlider.max = Math.max(720, 720 - bounds.h);
        this.elements.fontSizeInput.value = overlay.data.fontSize;
        this.elements.textColorInput.value = overlay.data.textColor;
        this.elements.hasBackgroundCheckbox.checked = overlay.data.hasBackground;
        this.elements.bgColorInput.value = overlay.data.backgroundColor;
        this.elements.bgOpacitySlider.value = overlay.data.backgroundOpacity !== undefined ? overlay.data.backgroundOpacity : 0.75;
        this.elements.posXSlider.value = overlay.data.x;
        this.elements.posYSlider.value = overlay.data.y;
    },

    updateQrEditorFromOverlay(overlay) {
        if (!overlay || overlay.type !== 'qr') return;
        const bounds = this.getOverlayBounds(overlay);
        this.elements.qrPosXSlider.max = Math.max(1280, 1280 - bounds.w);
        this.elements.qrPosYSlider.max = Math.max(720, 720 - bounds.h);
        this.elements.qrEditorLink.value = overlay.data.link;
        this.elements.qrPosXSlider.value = overlay.data.x;
        this.elements.qrPosYSlider.value = overlay.data.y;
    },

    updateImageEditorFromOverlay(overlay) {
        if (!overlay || overlay.type !== 'image') return;
        const bounds = this.getOverlayBounds(overlay);
        this.elements.imagePosXSlider.max = Math.max(1280, 1280 - bounds.w);
        this.elements.imagePosYSlider.max = Math.max(720, 720 - bounds.h);
        this.elements.imageSizeSlider.value = overlay.data.width;
        this.elements.imagePosXSlider.value = overlay.data.x;
        this.elements.imagePosYSlider.value = overlay.data.y;
    },

    updateSelectedTextOverlayFromEditor() {
        if (!this.app.selectedOverlayId) return;
        const newData = {
            fontSize: parseInt(this.elements.fontSizeInput.value, 10),
            textColor: this.elements.textColorInput.value,
            hasBackground: this.elements.hasBackgroundCheckbox.checked,
            backgroundColor: this.elements.bgColorInput.value,
            backgroundOpacity: parseFloat(this.elements.bgOpacitySlider.value),
            x: parseFloat(this.elements.posXSlider.value),
            y: parseFloat(this.elements.posYSlider.value),
        };
        videoProcessor.updateOverlay(this.app.selectedOverlayId, newData);
        this.updateTextEditorFromOverlay(videoProcessor.getOverlayById(this.app.selectedOverlayId));
    },
    
    updateSelectedQrOverlayFromEditor() {
        if (!this.app.selectedOverlayId) return;
        const newData = { x: parseFloat(this.elements.qrPosXSlider.value), y: parseFloat(this.elements.qrPosYSlider.value) };
        videoProcessor.updateOverlay(this.app.selectedOverlayId, newData);
        this.updateQrEditorFromOverlay(videoProcessor.getOverlayById(this.app.selectedOverlayId));
    },

    updateSelectedImageOverlayFromEditor() {
        if (!this.app.selectedOverlayId) return;
        const overlay = videoProcessor.getOverlayById(this.app.selectedOverlayId);
        if (!overlay) return;
        const newWidth = parseFloat(this.elements.imageSizeSlider.value);
        const newData = {
            width: newWidth,
            height: newWidth / overlay.data.aspectRatio, 
            x: parseFloat(this.elements.imagePosXSlider.value),
            y: parseFloat(this.elements.imagePosYSlider.value),
        };
        videoProcessor.updateOverlay(this.app.selectedOverlayId, newData);
        this.updateImageEditorFromOverlay(videoProcessor.getOverlayById(this.app.selectedOverlayId)); 
    },
    
    alignSelectedOverlay(corner) {
        const overlay = videoProcessor.getOverlayById(this.app.selectedOverlayId);
        if (!overlay || overlay.type !== 'text') return; 
        const bounds = this.getTextOverlayBounds(overlay), margin = 20;
        let newX, newY;
        switch (corner) {
            case 'tl': newX = margin; newY = margin; break;
            case 'tr': newX = 1280 - bounds.w - margin; newY = margin; break;
            case 'bl': newX = margin; newY = 720 - bounds.h - margin; break;
            case 'br': newX = 1280 - bounds.w - margin; newY = 720 - bounds.h - margin; break;
        }
        videoProcessor.updateOverlay(this.app.selectedOverlayId, { x: newX, y: newY });
        this.updateTextEditorFromOverlay(videoProcessor.getOverlayById(this.app.selectedOverlayId));
    },

    redrawInteractionLayer() {
        this.interactionCtx.clearRect(0, 0, this.elements.interactionCanvas.width, this.elements.interactionCanvas.height);
        const scale = this.getScale();
        const draggableOverlays = videoProcessor.state.overlays.filter(o => o.type === 'text' || o.type === 'qr' || o.type === 'image');
        
        draggableOverlays.forEach(overlay => {
            const bounds = this.getOverlayBounds(overlay);
            if (!bounds) return;
            const isSelected = (overlay.id === this.app.selectedOverlayId);
            this.interactionCtx.strokeStyle = isSelected ? 'rgba(8, 185, 166, 1)' : 'rgba(255, 255, 255, 0.4)';
            this.interactionCtx.lineWidth = isSelected ? 3 : 1;
            this.interactionCtx.setLineDash(isSelected ? [] : [5, 5]);
            this.interactionCtx.strokeRect(bounds.x * scale.x, bounds.y * scale.y, bounds.w * scale.x, bounds.h * scale.y);
        });
        requestAnimationFrame(() => this.redrawInteractionLayer());
    }
};