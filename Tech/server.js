// server.js
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const fs = require('fs');
const path = require('path');

// Увеличиваем лимит для body, чтобы принимать Data URL изображений
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Маршрут для получения списка готовых фонов
app.get('/list-backgrounds', (req, res) => {
  const backgroundsDir = path.join(__dirname, 'public', 'backgrounds');
  // Создаем папку, если она не существует
  if (!fs.existsSync(backgroundsDir)) {
      fs.mkdirSync(backgroundsDir, { recursive: true });
  }

  fs.readdir(backgroundsDir, (err, files) => {
    if (err) {
      console.error('Could not list the directory.', err);
      return res.status(500).json({ error: 'Failed to list background images' });
    }
    
    // Фильтруем, чтобы оставить только изображения
    const imageFiles = files.filter(file => /\.(jpe?g|png|gif)$/i.test(file));
    res.json(imageFiles);
  });
});

// Маршрут для сохранения сгенерированного фона
app.post('/save-background', (req, res) => {
  const { imageData } = req.body;
  if (!imageData) {
    return res.status(400).json({ error: 'No image data provided' });
  }

  const base64Data = imageData.replace(/^data:image\/png;base64,/, "");
  const imageBuffer = Buffer.from(base64Data, 'base64');
  // Сохраняем в корне public, чтобы segmenter.js мог найти 'wallpaper.png'
  const filePath = path.join(__dirname, 'public', 'wallpaper.png'); 

  fs.writeFile(filePath, imageBuffer, (err) => {
    if (err) {
      console.error('Error saving file:', err);
      return res.status(500).json({ error: 'Failed to save file' });
    }
    console.log('Background saved successfully:', filePath);
    res.status(200).json({ message: 'Background saved successfully' });
  });
});

// МАРШРУТ для установки готового фона как wallpaper.png (копирование)
app.post('/set-wallpaper', (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'No filename provided' });
  }

  const sourcePath = path.join(__dirname, 'public', 'backgrounds', filename);
  const destPath = path.join(__dirname, 'public', 'wallpaper.png');

  fs.copyFile(sourcePath, destPath, (err) => {
    if (err) {
      console.error('Error copying file:', err);
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'Source file not found' });
      }
      return res.status(500).json({ error: 'Failed to set wallpaper' });
    }
    console.log(`Successfully set ${filename} as wallpaper.png`);
    res.status(200).json({ success: true, message: `${filename} set as wallpaper.` });
  });
});


io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('join', (room) => {
    console.log('a user joined', room)
    socket.join(room);
  });
  socket.on('signal', (data) => {
    console.log('a user signaled', data.room, data.type)
    socket.to(data.room).emit('signal', data.signal);
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});