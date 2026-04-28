const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusElement = document.getElementById('status');
const scoreElement = document.getElementById('score');

canvasElement.width = window.innerWidth;
canvasElement.height = window.innerHeight;

// --- 遊戲狀態變數 ---
let isMouthOpen = false;
let currentScore = 0;
let mouthX = canvasElement.width / 2;
let mouthY = canvasElement.height / 2;
const MOUTH_OPEN_THRESHOLD = 0.04;
const MOUTH_RADIUS = 40; // 嘴巴指標的判定半徑

// --- 掉落物件系統 ---
let fallingObjects = [];

// 定義物件類型 (之後可以輕鬆替換成真實圖片)
const objectTypes = [
    { type: 'good', symbol: '🍎', score: 10 },
    { type: 'bad', symbol: '💣', score: -20 }
];

// 每 1.2 秒隨機生成一個新物件
setInterval(() => {
    const randomType = objectTypes[Math.floor(Math.random() * objectTypes.length)];
    fallingObjects.push({
        x: Math.random() * (canvasElement.width - 100) + 50, // 在畫面寬度內隨機產生
        y: -50, // 從畫面頂部外面開始掉
        radius: 30, // 物件的碰撞半徑
        speed: 4 + Math.random() * 4, // 隨機掉落速度
        info: randomType
    });
}, 1200);


// --- 核心渲染與判定 ---
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 1. 繪製攝影機畫面
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // 2. 處理臉部追蹤與指標
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const upperLip = landmarks[13];
        const lowerLip = landmarks[14];

        // 判定張嘴
        const distance = Math.sqrt(
            Math.pow(lowerLip.x - upperLip.x, 2) + Math.pow(lowerLip.y - upperLip.y, 2)
        );

        isMouthOpen = distance > MOUTH_OPEN_THRESHOLD;
        
        // 更新狀態文字
        if (isMouthOpen) {
            statusElement.innerText = "指標狀態：已激活 🟢";
            statusElement.style.color = "#44ff44";
        } else {
            statusElement.innerText = "指標狀態：未激活 (請張嘴) 🔴";
            statusElement.style.color = "#ff4444";
        }

        // 更新嘴巴座標
        mouthX = ((upperLip.x + lowerLip.x) / 2) * canvasElement.width;
        mouthY = ((upperLip.y + lowerLip.y) / 2) * canvasElement.height;

        // 繪製嘴巴指標
        canvasCtx.beginPath();
        canvasCtx.arc(mouthX, mouthY, MOUTH_RADIUS, 0, 2 * Math.PI); 
        canvasCtx.fillStyle = isMouthOpen ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.4)';
        canvasCtx.fill();
        canvasCtx.lineWidth = 3;
        canvasCtx.strokeStyle = 'white';
        canvasCtx.stroke();
    }

    // 3. 處理遊戲物件 (掉落、繪製、碰撞判定)
    for (let i = fallingObjects.length - 1; i >= 0; i--) {
        let obj = fallingObjects[i];
        
        // 物件往下掉
        obj.y += obj.speed; 

        // 繪製 Emoji 物件
        canvasCtx.font = "50px Arial";
        canvasCtx.textAlign = "center";
        canvasCtx.textBaseline = "middle";
        canvasCtx.fillText(obj.info.symbol, obj.x, obj.y);

        // 碰撞偵測：計算物件與嘴巴的距離
        const dist = Math.sqrt(Math.pow(obj.x - mouthX, 2) + Math.pow(obj.y - mouthY, 2));

        // 如果距離小於兩者半徑之和，代表碰到
        if (dist < (MOUTH_RADIUS + obj.radius)) {
            // 必須是張嘴狀態才能「吃掉」
            if (isMouthOpen) {
                currentScore += obj.info.score; // 加分或扣分
                scoreElement.innerText = currentScore; // 更新畫面上的分數
                fallingObjects.splice(i, 1); // 將物件從陣列中移除 (吃掉)
                continue; // 處理下一個物件
            }
        }

        // 如果物件掉出畫面底部，將其移除以節省效能
        if (obj.y > canvasElement.height + 100) {
            fallingObjects.splice(i, 1);
        }
    }

    canvasCtx.restore();
}

// 初始化 Face Mesh 與 Camera (與第一階段相同)
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
