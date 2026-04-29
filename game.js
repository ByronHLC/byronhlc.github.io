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
    activeMouth: 'Gyarados.png',
    // 🌟 新增掉落物素材
    weezing: '雙蛋瓦斯.png',
    gengar: '耿鬼.png',
    charmander: '小火龍.png',
    squirtle: '傑尼龜.png',
    pikachu: '超級巨化皮卡丘.png',
    suicune: '水君.png'
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
        };
    }
}

// --- 2. 遊戲狀態與參數 ---
let isMouthOpen = false;
let currentScore = 0;
let mouthX = canvasElement.width / 2;
let mouthY = canvasElement.height / 2;

const MOUTH_OPEN_THRESHOLD = 0.025; 
const MOUTH_MAX_OPEN_DISTANCE = 0.07; 
const BASE_MOUTH_RADIUS = 40; 
const BASE_MOUTH_IMG_SIZE = 120; 

// --- 3. 掉落物件系統 ---
let fallingObjects = [];
const FALLING_OBJ_SIZE = 80; // 掉落物顯示的大小

// 🌟 設定自訂物件的分數與對應圖片 Key
const objectTypes = [
    { key: 'weezing', score: -10 },
    { key: 'gengar', score: -20 },
    { key: 'charmander', score: 10 },
    { key: 'squirtle', score: 10 },
    { key: 'pikachu', score: 30 },
    { key: 'suicune', score: 50 }
];

setInterval(() => {
    if (!loadedImages.background) return;
    
    const randomType = objectTypes[Math.floor(Math.random() * objectTypes.length)];
    fallingObjects.push({
        x: Math.random() * (canvasElement.width - 100) + 50,
        y: -50,
        radius: 35, // 碰撞判定範圍
        speed: 3 + Math.random() * 4, 
        info: randomType
    });
}, 1000); // 稍微提高生成頻率，玩起來更熱鬧

// --- 4. 核心渲染與判定 ---
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 繪製背景
    if (loadedImages.background) {
        canvasCtx.drawImage(loadedImages.background, 0, 0, canvasElement.width, canvasElement.height);
    }

    let currentImgSize = BASE_MOUTH_IMG_SIZE;
    let currentRadius = BASE_MOUTH_RADIUS;

    // 處理臉部
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
            imgToDraw = loadedImages.activeMouth;
            let openRatio = (distance - MOUTH_OPEN_THRESHOLD) / (MOUTH_MAX_OPEN_DISTANCE - MOUTH_OPEN_THRESHOLD);
            openRatio = Math.max(0, Math.min(1, openRatio));
            const scale = 1 + (openRatio * 1); 
            currentImgSize = BASE_MOUTH_IMG_SIZE * scale;
            currentRadius = BASE_MOUTH_RADIUS * scale;
        } else {
            imgToDraw = loadedImages.inactiveMouth;
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

    // 處理掉落物
    for (let i = fallingObjects.length - 1; i >= 0; i--) {
        let obj = fallingObjects[i];
        obj.y += obj.speed; 

        // 🌟 繪製自訂圖片物件
        const objImg = loadedImages[obj.info.key];
        if (objImg) {
            canvasCtx.drawImage(
                objImg,
                obj.x - FALLING_OBJ_SIZE / 2,
                obj.y - FALLING_OBJ_SIZE / 2,
                FALLING_OBJ_SIZE,
                FALLING_OBJ_SIZE
            );
        }

        // 碰撞判定
        const dist = Math.sqrt(Math.pow(obj.x - mouthX, 2) + Math.pow(obj.y - mouthY, 2));
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

// 初始化 MediaPipe
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
