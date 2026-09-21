export async function videoPoster(file) {
  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;
  await new Promise((res, rej) => { video.onloadeddata = res; video.onerror = rej; });
  video.currentTime = Math.min(1, (video.duration || 2) / 2);
  await new Promise((r) => (video.onseeked = r));
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  URL.revokeObjectURL(video.src);
  return new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
}