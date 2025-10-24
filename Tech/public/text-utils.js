// public/text-utils.js

// a configurable transform function factory for adding text
// let's add some defaults
function showText({ text, txtInitialX, txtColor = 'white', txtFontSize = '48px', txtFont = 'serif', textSpeed = 2, bgColor = '#08b9a6', bgPadding = 10, position = 'top' }) {
  // an offscreen canvas to draw the video frame and the text
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext('2d');

  // some values for the text size and x position on the canvas
  const intTxtFontSize = parseInt(txtFontSize);
  let x = txtInitialX;

  // the transform function
  return function transform(frame, controller) {
    // set the canvas size to be the same as the video frame
    const width = frame.displayWidth;
    const height = frame.displayHeight;
    canvas.width = width;
    canvas.height = height;

    // determine the text position based on the parameters
    const bgHeight = intTxtFontSize + bgPadding;
    const bgPositionY = position === 'bottom' ? height - (intTxtFontSize + bgPadding + 5) : 5;
    const txtPositionY = position === 'bottom' ? height - (Math.floor(bgPadding / 2) + 10) : 5 + intTxtFontSize;

    // let's draw!
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(frame, 0, 0, width, height);
    ctx.font = txtFontSize + ' ' + txtFont;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, bgPositionY, width, bgHeight)
    ctx.fillStyle = txtColor;
    ctx.fillText(text, x, txtPositionY);

    // move the text's x position
    x -= textSpeed;

    // restart position after it goes off-screen
    if (x <= (0 - 100 - text.length * 20)) {
      x = width
    }

    // create a new frame from the canvas content
    const newFrame = new VideoFrame(canvas, { timestamp: frame.timestamp });

    // close the current frame
    frame.close();

    // enqueue the new one
    controller.enqueue(newFrame);
  }
}

// a configurable transform function factory for adding QR codes
// let's add some defaults
function showQr({ text, qrWidth = 256, qrHeight = 256, colorDark = '#000000', colorLight = '#FFFFFF', positionX = 10, positionY = 10 }) {
  // a canvas to combine everything
  const canvas = new OffscreenCanvas(1, 2);
  const ctx = canvas.getContext('2d');

  // a div element to host the QR code
  const qrDiv = document.createElement('div');
  
  // generate a new QR code inside the qrDiv element
  new QRCode(qrDiv, {
    text,
    width: qrWidth,
    height: qrHeight,
    colorDark,
    colorLight
  });

  // the transform function
  return function transform(frame, controller) {
    // set the canvas size to be the same as the video frame
    const width = frame.displayWidth;
    const height = frame.displayHeight;
    canvas.width = width;
    canvas.height = height;
    
    // draw the current video frame and the QR code
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(frame, 0, 0, width, height);
    ctx.drawImage(
      qrDiv.querySelector('canvas'),
      positionX,
      positionY,
      qrWidth,
      qrHeight
    );
      
    // get the current video frame's timestamp before closing it
    const timestamp = frame.timestamp;
    
    // close the current video frame
    frame.close();

    // create a new video frame from the canvas' content
    const newFrame = new VideoFrame(canvas, { timestamp });

    // enqueue the new video frame
    controller.enqueue(newFrame);
  }
}