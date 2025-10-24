// public/image-utils.js

// a configurable transform function factory for adding images
function showImage({ image }) {
  console.log('Got an image file: ', image);
  
  // the transform function
  return function transform(frame, controller) {
    // TODO: read the image file and draw it on the canvas
    controller.enqueue(frame);
  }
}
