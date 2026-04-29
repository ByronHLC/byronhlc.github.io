const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusElement = document.getElementById('status');
const scoreElement = document.getElementById('score');

canvasElement.width = window.innerWidth;
canvasElement.height = window.innerHeight;

// --- 1. 遊戲素材與預載入系統 ---
const imagesToLoad = {
    background: 'grass.png',
    inactiveMouth: 'Magikarp.webp', 
    activeMouth: 'Gyarados.png'     
};

const loadedImages = {};
let imagesLoadedCount = 0;
const totalImagesToLoad = Object.keys(imagesToLoad).length;

function preloadImages() {
    for (const key in imagesToLoad) {
        const img = new Image();
        img.src = imagesToLoad[key];
        img.onload = () => {
            loadedImages[key] = img;
            imagesLoadedCount++;
            if (imagesLoadedCount === totalImagesToLoad) {
                camera.start();
            }
        };
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

// 🌟 修改：降低張嘴門檻，並新增動態縮放所需的常數
const MOUTH_OPEN_THRESHOLD = 0.025; // 原本是 0.04，降低門檻讓女生也能輕鬆玩
const MOUTH_MAX_OPEN_DISTANCE = 0.07; // 預設嘴巴張到「極限」的距離值
const BASE_MOUTH_RADIUS = 40; // 基礎碰撞判定半徑
const BASE_MOUTH_IMG_SIZE = 120; // 基礎圖片大小

// --- 掉落物件系統 ---
let fallingObjects = [];
const objectTypes = [
    { type: 'good', symbol: '🍎', score: 10 },
    { type: 'bad', symbol: '💣', score: -20 }
];

setInterval(() => {
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
    
    if (loadedImages.background) {
        canvasCtx.drawImage(loadedImages.background, 0, 0, canvasElement.width, canvasElement.height);
    } else {
        canvasCtx.fillStyle = '#222';
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    }

    // 用來儲存當下圖片的尺寸與判定半徑
    let currentImgSize = BASE_MOUTH_IMG_SIZE;
    let currentRadius = BASE_MOUTH_RADIUS;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const upperLip = landmarks[13];
        const lowerLip = landmarks[14];

        const distance = Math.sqrt(
            Math.pow(lowerLip.x - upperLip.x, 2) + Math.pow(lowerLip.y - upperLip.y, 2)
        );

        isMouthOpen = distance > MOUTH_OPEN_THRESHOLD;
        
        let imgToDraw;

        if (isMouthOpen) {
            statusElement.innerText = "指標狀態：已激活 (暴鯉龍) 🟢";
            statusElement.style.color = "#44ff44";
            imgToDraw = loadedImages.activeMouth;

            // 🌟 核心修改：計算張嘴程度並換算成 1~2 倍的比例
            // 計算超出門檻的比例 (0 ~ 1 之間)
            let openRatio = (distance - MOUTH_OPEN_THRESHOLD) / (MOUTH_MAX_OPEN_DISTANCE - MOUTH_OPEN_THRESHOLD);
            
            // 使用 Math.max 和 Math.min 確保比例被鎖定在 0 到 1 之間
            openRatio = Math.max(0, Math.min(1, openRatio));
            
            // 基礎倍率為 1，最大加成 1 倍，最高變為 2 倍大
            const scale = 1 + (openRatio * 1); 

            currentImgSize = BASE_MOUTH_IMG_SIZE * scale;
            currentRadius = BASE_MOUTH_RADIUS * scale; // 判定範圍同步放大

        } else {
            statusElement.innerText = "指標狀態：未激活 (鯉魚王) 🔴";
            statusElement.style.color = "#ff4444";
            imgToDraw = loadedImages.inactiveMouth;
            // 未激活時維持基礎大小 (1倍)
            currentImgSize = BASE_MOUTH_IMG_SIZE;
            currentRadius = BASE_MOUTH_RADIUS;
        }

        mouthX = ((upperLip.x + lowerLip.x) / 2) * canvasElement.width;
        mouthY = ((upperLip.y + lowerLip.y) / 2) * canvasElement.height;

        if (imgToDraw) {
            canvasCtx.drawImage(
                imgToDraw, 
                mouthX - currentImgSize / 2, 
                mouthY - currentImgSize / 2, 
                currentImgSize, 
                currentImgSize
            );
        }
    }

    // 3. 處理遊戲物件
    for (let i = fallingObjects.length - 1; i >= 0; i--) {
        let obj = fallingObjects[i];
        
        obj.y += obj.speed; 

        canvasCtx.font = "50px Arial";
        canvasCtx.textAlign = "center";
        canvasCtx.textBaseline = "middle";
        canvasCtx.fillText(obj.info.symbol, obj.x, obj.y);

        const dist = Math.sqrt(Math.pow(obj.x - mouthX, 2) + Math.pow(obj.y - mouthY, 2));

        // 🌟 修改：使用動態變大的 currentRadius 來判定碰撞
        if (dist < (currentRadius + obj.radius)) {
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

const faceMesh = new FaceMesh({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
}});
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  selfieMode: true
});
faceMesh.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({image: videoElement});
  },
  width: 640,
  height: 480
});

preloadImages();
