const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusElement = document.getElementById('status');

// 初始化 Canvas 尺寸為全螢幕
canvasElement.width = window.innerWidth;
canvasElement.height = window.innerHeight;

let isMouthOpen = false;
const MOUTH_OPEN_THRESHOLD = 0.04; 

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 繪製攝影機畫面
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        
        // 取得上下嘴唇內側的座標
        const upperLip = landmarks[13];
        const lowerLip = landmarks[14];

        // 1. 計算兩點之間的距離來判定是否張嘴
        const distance = Math.sqrt(
            Math.pow(lowerLip.x - upperLip.x, 2) + 
            Math.pow(lowerLip.y - upperLip.y, 2)
        );

        if (distance > MOUTH_OPEN_THRESHOLD) {
            isMouthOpen = true;
            statusElement.innerText = "指標狀態：已激活 🟢";
            statusElement.style.color = "#44ff44";
        } else {
            isMouthOpen = false;
            statusElement.innerText = "指標狀態：未激活 (請張嘴) 🔴";
            statusElement.style.color = "#ff4444";
        }

        // 2. 計算嘴巴的中心點位置 (指標跟隨邏輯)
        // 將 0~1 的比例座標轉換為 Canvas 上的實際像素座標
        // 註：若手機前鏡頭畫面沒有做鏡像翻轉，玩家往左移動時，指標也會往左，符合直覺
        const mouthX = ((upperLip.x + lowerLip.x) / 2) * canvasElement.width;
        const mouthY = ((upperLip.y + lowerLip.y) / 2) * canvasElement.height;

        // 3. 繪製「指標」於嘴巴位置
        canvasCtx.beginPath();
        canvasCtx.arc(mouthX, mouthY, 40, 0, 2 * Math.PI); 
        canvasCtx.fillStyle = isMouthOpen ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 0, 0, 0.4)';
        canvasCtx.fill();
        canvasCtx.lineWidth = 3;
        canvasCtx.strokeStyle = 'white';
        canvasCtx.stroke();
    }
    canvasCtx.restore();
}

const faceMesh = new FaceMesh({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
}});
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
faceMesh.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({image: videoElement});
  },
  width: 640,
  height: 480
});

camera.start();