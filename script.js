window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.log('Error: ' + msg + '\nURL: ' + url + '\nLine: ' + lineNo + '\nColumn: ' + columnNo + '\nError object: ' + JSON.stringify(error));
    return false;
};

let cropper = null;
let originalImage = null;
let selfieSegmentation = null;

// 图片尺寸配置（像素）
const SIZES = {
    '1': { width: 295, height: 413 },    // 1寸
    '2': { width: 413, height: 579 },    // 2寸
    '2l': { width: 413, height: 626 }    // 大2寸
};

// 毫米转像素的转换比例 (假设300dpi)
const MM_TO_PX = 11.811;

// 初始化事件监听
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM已加载');
    // 初始化 MediaPipe Selfie Segmentation
    selfieSegmentation = new SelfieSegmentation({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
    }});
    
    selfieSegmentation.setOptions({
        modelSelection: 1,  // 0 为一般性能模型，1 为高性能模型
    });
    
    selfieSegmentation.onResults(onSegmentationResults);
    
    const imageInput = document.getElementById('imageInput');
    const previewImage = document.getElementById('previewImage');
    const cropBtn = document.getElementById('cropBtn');
    const sizeSelect = document.getElementById('sizeSelect');
    const changeBackgroundBtn = document.getElementById('changeBackgroundBtn');
    const backgroundColorPicker = document.getElementById('backgroundColorPicker');
    const downloadBtn = document.getElementById('downloadBtn');
    const customSizeInputs = document.getElementById('customSizeInputs');
    const applyCustomSize = document.getElementById('applyCustomSize');

    imageInput.addEventListener('change', handleImageUpload);
    cropBtn.addEventListener('click', handleCropClick);
    sizeSelect.addEventListener('change', handleSizeChange);
    changeBackgroundBtn.addEventListener('click', handleBackgroundChange);
    downloadBtn.addEventListener('click', handleDownload);
    applyCustomSize.addEventListener('click', handleCustomSize);
});

// 处理图片上传
function handleImageUpload(e) {
    const file = e.target.files[0];
    console.log('上传的文件:', file);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const previewImage = document.getElementById('previewImage');
        previewImage.src = event.target.result;
        previewImage.style.display = 'block';
        
        // 销毁之前的cropper实例
        if (cropper) {
            cropper.destroy();
        }
        
        // 保存原始图片
        originalImage = new Image();
        originalImage.src = event.target.result;
        
        // 初始化cropper
        cropper = new Cropper(previewImage, {
            aspectRatio: NaN,
            viewMode: 1,
            autoCropArea: 1
        });
    };
    reader.readAsDataURL(file);
}

// 处理裁剪按钮点击
function handleCropClick() {
    const sizeSelect = document.getElementById('sizeSelect');
    sizeSelect.style.display = 'inline-block';
}

// 处理尺寸选择变化
function handleSizeChange(e) {
    const size = SIZES[e.target.value];
    const customSizeInputs = document.getElementById('customSizeInputs');
    
    if (e.target.value === 'custom') {
        customSizeInputs.style.display = 'block';
        return;
    } else {
        customSizeInputs.style.display = 'none';
    }
    
    if (!size) return;
    console.log('选择的尺寸:', size);

    cropper.setAspectRatio(size.width / size.height);
    
    // 获取裁剪后的图片
    const croppedCanvas = cropper.getCroppedCanvas({
        width: size.width,
        height: size.height
    });

    // 显示结果
    const resultImage = document.getElementById('resultImage');
    resultImage.src = croppedCanvas.toDataURL();
    document.querySelector('.result-container').style.display = 'block';
}

// 处理背景更改
function handleBackgroundChange() {
    // 显示处理状态
    const processingStatus = document.querySelector('.processing-status');
    processingStatus.style.display = 'inline-flex';
    
    // 创建临时画布来处理图片
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = originalImage.width;
    tempCanvas.height = originalImage.height;
    tempCtx.drawImage(originalImage, 0, 0);
    
    // 将画布转换为 ImageData
    selfieSegmentation.send({image: tempCanvas});
}

// 处理自定义尺寸
function handleCustomSize() {
    const widthMM = parseFloat(document.getElementById('customWidth').value);
    const heightMM = parseFloat(document.getElementById('customHeight').value);
    
    if (isNaN(widthMM) || isNaN(heightMM) || widthMM <= 0 || heightMM <= 0) {
        alert('请输入有效的尺寸');
        return;
    }
    
    // 将毫米转换为像素
    const widthPx = Math.round(widthMM * MM_TO_PX);
    const heightPx = Math.round(heightMM * MM_TO_PX);
    
    console.log('自定义尺寸:', { widthPx, heightPx });
    
    cropper.setAspectRatio(widthPx / heightPx);
    
    // 获取裁剪后的图片
    const croppedCanvas = cropper.getCroppedCanvas({
        width: widthPx,
        height: heightPx
    });

    // 显示结果
    const resultImage = document.getElementById('resultImage');
    resultImage.src = croppedCanvas.toDataURL();
    document.querySelector('.result-container').style.display = 'block';
}

// 处理下载
function handleDownload() {
    const resultImage = document.getElementById('resultImage');
    const sizeSelect = document.getElementById('sizeSelect');
    const selectedSize = sizeSelect.value;
    let filename;
    
    if (selectedSize === 'custom') {
        const width = document.getElementById('customWidth').value;
        const height = document.getElementById('customHeight').value;
        filename = `裁剪_${width}x${height}mm.png`;
    } else {
        filename = `裁剪_${selectedSize}寸.png`;
    }
    
    const link = document.createElement('a');
    link.download = filename;
    link.href = resultImage.src;
    link.click();
}

// 处理分割结果
function onSegmentationResults(results) {
    const color = document.getElementById('backgroundColorPicker').value;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 设置画布大小为原始���片大小
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    
    // 创建模糊效果的画布
    const blurCanvas = document.createElement('canvas');
    const blurCtx = blurCanvas.getContext('2d');
    blurCanvas.width = canvas.width;
    blurCanvas.height = canvas.height;
    
    // 绘制新背景色
    blurCtx.fillStyle = color;
    blurCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 创建一个离屏 canvas 用于处理遮罩
    const maskCanvas = document.createElement('canvas');
    const maskCtx = maskCanvas.getContext('2d');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    
    // 绘制并处理遮罩，添加模糊效果
    maskCtx.filter = 'blur(2px)';  // 添加轻微模糊以平滑边缘
    maskCtx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
    maskCtx.filter = 'none';
    
    const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
    
    // 在模糊画布上绘制原始图片
    blurCtx.drawImage(originalImage, 0, 0);
    
    // 获取图像数据
    const imageData = blurCtx.getImageData(0, 0, canvas.width, canvas.height);
    
    // 解析背景色
    const r = parseInt(color.substr(1,2), 16);
    const g = parseInt(color.substr(3,2), 16);
    const b = parseInt(color.substr(5,2), 16);
    
    // 创建边缘检测数组
    const edgePixels = new Uint8Array(imageData.data.length / 4);
    
    // 混合背景和前景
    for (let i = 0; i < imageData.data.length; i += 4) {
        const maskAlpha = maskData.data[i];
        
        // 检测边缘区域
        const isEdge = maskAlpha > 0.1 && maskAlpha < 0.9;
        edgePixels[i/4] = isEdge ? 1 : 0;
        
        // 更细腻的 alpha 混合
        if (maskAlpha < 0.95) {  // 背景部分和边缘
            const blend = Math.pow(maskAlpha, 1.5);  // 使用幂函数调整过渡曲线
            // 使用 alpha 混合来创建平滑过渡
            imageData.data[i] = Math.round(r * (1 - blend) + imageData.data[i] * blend);
            imageData.data[i + 1] = Math.round(g * (1 - blend) + imageData.data[i + 1] * blend);
            imageData.data[i + 2] = Math.round(b * (1 - blend) + imageData.data[i + 2] * blend);
        }
    }
    
    // 对边缘像素进行额外的平滑处理
    for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
            const i = (y * canvas.width + x) * 4;
            if (edgePixels[y * canvas.width + x]) {
                // 对边缘像素进行局部平均
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const ni = ((y + dy) * canvas.width + (x + dx)) * 4;
                            sum += imageData.data[ni + c];
                        }
                    }
                    imageData.data[i + c] = sum / 9;
                }
            }
        }
    }
    
    // 将处理后的图像数据放回主画布
    ctx.putImageData(imageData, 0, 0);
    
    // 应用边缘平滑
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    
    // 添加最终的柔化效果
    ctx.filter = 'blur(0.5px)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    
    // 显示结果
    const resultImage = document.getElementById('resultImage');
    resultImage.src = canvas.toDataURL('image/png', 1.0);
    document.querySelector('.result-container').style.display = 'block';
    
    // 隐藏处理状态
    document.querySelector('.processing-status').style.display = 'none';
} 