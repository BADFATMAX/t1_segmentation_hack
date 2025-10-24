// public/track-utils.js

// a function that creates a processed track
// it receives a track and a transform function
function createProcessedTrack({ track, transform }) {
  // create the MediaStreamTrackProcessor and MediaStreamTrackGenerator objects
  const trackProcessor = new MediaStreamTrackProcessor({ track });
  const trackGenerator = new MediaStreamTrackGenerator({ kind: track.kind });

  // create the transformer, passing the transform function
  const transformer = new TransformStream({ transform });

  // pipe everything together
  trackProcessor.readable
    .pipeThrough(transformer)
    .pipeTo(trackGenerator.writable);

  // return the resulting track
  return trackGenerator;
}

// our "clean" transform factory
function cleanStream() {
  // it returns the actual transform function
  return function transform(frame, controller) {
    // for now we'll just enqueue the current video frame
    controller.enqueue(frame);
  }
}