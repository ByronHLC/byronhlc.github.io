const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusElement = document.getElementById('status');
const scoreElement = document.getElementById('score');

// 根據視窗大小初始化 Canvas
canvasElement.width = window.innerWidth;
canvasElement.height = window.innerHeight;

// --- 1. 遊戲素材與預載入系統 ---
// 定義圖片資源路徑
const imagesToLoad = {
    background: 'grass.jpg',
    inactiveMouth: 'Magikarp.webp', // 圖 a
    activeMouth: 'Gyarados.png'     // 圖 b
};

// 儲存載入後的圖片物件
const loadedImages = {};
let imagesLoadedCount = 0;
const totalImagesToLoad = Object.keys(imagesToLoad).length;

// 開始預載入圖片
function preloadImages() {
    for (const key in imagesToLoad) {
        const img = new Image();
        img.src = imagesToLoad[key];
        img.onload = () => {
            loadedImages[key] = img;
            imagesLoadedCount++;
            // 當所有圖片載入完成，才啟動攝影機
            if (imagesLoadedCount === totalImagesToLoad) {
                camera.start();
            }
        };
        // 增加錯誤處理
        img.onerror = () => {
            console.error(`無法載入圖片：${imagesToLoad[key]}`);
            alert(`圖片載入失敗：${imagesToLoad[key]}，請確認檔案存在。`);
        };
    }
}

// --- 遊戲狀態與參數 ---
let isMouthOpen = false;
let currentScore = 0;
let mouthX = canvasElement.width / 2;
let mouthY = canvasElement.height / 2;
const MOUTH_OPEN_THRESHOLD = 0.04;
const MOUTH_RADIUS = 40; // 碰撞判定半徑 (維持不變)
// 定義嘴巴圖片的顯示尺寸 (寬度)
const MOUTH_IMG_SIZE = 120; 

// --- 掉落物件系統 ---
let fallingObjects = [];
const objectTypes = [
    { type: 'good', symbol: '🍎', score: 10 },
    { type: 'bad', symbol: '💣', score: -20 }
];

// 每 1.2 秒隨機生成一個新物件 (與上一版相同)
setInterval(() => {
    // 只有在背景圖載入後才生成物件
    if (!loadedImages.background) return;
    
    const randomType = objectTypes[Math.floor(Math.random() * objectTypes.length)];
    fallingObjects.push({
        x: Math.random() * (canvasElement.width - 100) + 50,
        y: -50,
        radius: 30,
        speed: 4 + Math.random() * 4,
        info: randomType
    });
}, 1200);


// --- 核心渲染與判定 ---
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 🌟 修改：繪製背景圖取代原始自拍畫面
    if (loadedImages.background) {
        canvasCtx.drawImage(loadedImages.background, 0, 0, canvasElement.width, canvasElement.height);
    } else {
        // 防止圖片未載入，顯示黑色背景
        canvasCtx.fillStyle = '#222';
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    }

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
        
        if (isMouthOpen) {
            statusElement.innerText = "指標狀態：已激活 (暴鯉龍) 🟢";
            statusElement.style.color = "#44ff44";
        } else {
            statusElement.innerText = "指標狀態：未激活 (鯉魚王) 🔴";
            statusElement.style.color = "#ff4444";
        }

        // 更新嘴巴座標 (延用上一版 selfieMode=true 的穩定算法)
        mouthX = ((upperLip.x + lowerLip.x) / 2) * canvasElement.width;
        mouthY = ((upperLip.y + lowerLip.y) / 2) * canvasElement.height;

        // 🌟 修改：繪製對應的寶可夢圖片
        let imgToDraw;
        if (isMouthOpen) {
            imgToDraw = loadedImages.activeMouth; // 圖 b (Gyarados.png)
        } else {
            imgToDraw = loadedImages.inactiveMouth; // 圖 a (Magikarp.webp)
        }

        if (imgToDraw) {
            // 計算繪製座標，使其中心點對齊嘴巴位置
            canvasCtx.drawImage(
                imgToDraw, 
                mouthX - MOUTH_IMG_SIZE / 2, 
                mouthY - MOUTH_IMG_SIZE / 2, 
                MOUTH_IMG_SIZE, 
                MOUTH_IMG_SIZE
            );
        }
    }

    // 3. 處理遊戲物件 (延用上一版邏輯)
    for (let i = fallingObjects.length - 1; i >= 0; i--) {
        let obj = fallingObjects[i];
        
        obj.y += obj.speed; 

        canvasCtx.font = "50px Arial";
        canvasCtx.textAlign = "center";
        canvasCtx.textBaseline = "middle";
        canvasCtx.fillText(obj.info.symbol, obj.x, obj.y);

        const dist = Math.sqrt(Math.pow(obj.x - mouthX, 2) + Math.pow(obj.y - mouthY, 2));

        if (dist < (MOUTH_RADIUS + obj.radius)) {
            if (isMouthOpen) {
                currentScore += obj.info.score; 
                scoreElement.innerText = currentScore; 
                fallingObjects.splice(i, 1); 
                continue; 
            }
        }

        if (obj.y > canvasElement.height + 100) {
            fallingObjects.splice(i, 1);
        }
    }

    canvasCtx.restore();
}

// --- 初始化 MediaPipe ---
const faceMesh = new FaceMesh({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
}});
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  selfieMode: true // 🌟 維持 selfieMode 為 true
});
faceMesh.onResults(onResults);

// --- 初始化攝影機 (但不立即啟動，改由圖片載入完後啟動) ---
const camera = new Camera(videoElement, {
  onFrame: async () => {
    // 即使畫面上看不到，影片流一樣要送給 AI 辨識
    await faceMesh.send({image: videoElement});
  },
  width: 640,
  height: 480
});

// 🌟 核心：開始預載入圖片，圖片載入完成後會自動呼叫 camera.start()
preloadImages();
