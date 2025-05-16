import React, {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";

let isOpenCVLoaded = false;
let openCVLoadCallbacks = [];
function handleOpenCVLoaded() {
  isOpenCVLoaded = true;
  openCVLoadCallbacks.forEach((cb) => cb());
  openCVLoadCallbacks = [];
}
function ensureOpenCVScriptLoaded() {
  if (
    !isOpenCVLoaded &&
    typeof document !== "undefined" &&
    !document.getElementById("opencv-script")
  ) {
    const script = document.createElement("script");
    script.id = "opencv-script";
    script.src =
      "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.7.0-release.1/dist/opencv.js";
    script.async = true;
    script.onload = handleOpenCVLoaded;
    document.head.appendChild(script);
  }
}

function resizeImage(imgElement, maxDim = 1200) {
  const canvas = document.createElement("canvas");
  let { width, height } = imgElement;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgElement, 0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(URL.createObjectURL(blob)),
      "image/jpeg",
      0.9
    );
  });
}

const ImageAligner = forwardRef(function ImageAligner(
  { firstImageUrl, currentImageUrl, onProcessed },
  ref
) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("대기 중");
  const [priority, setPriority] = useState("background");
  const isProcessing = useRef(false);
  const processTimeoutRef = useRef(null);
  const workerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    setPriorityMode: (mode) => setPriority(mode),
    getStatus: () => status,
    isProcessing: () => isProcessing.current,
    abort: () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        isProcessing.current = false;
        setStatus("처리 중단됨");
      }
    },
  }));

  useEffect(() => {
    ensureOpenCVScriptLoaded();
    startProcessing();
    return () => {
      if (processTimeoutRef.current) clearTimeout(processTimeoutRef.current);
      if (workerRef.current) workerRef.current.terminate();
    };
  }, [firstImageUrl, currentImageUrl]);

  useEffect(() => {
    if (priority === "foreground" && !isProcessing.current) {
      if (processTimeoutRef.current) clearTimeout(processTimeoutRef.current);
      startImageProcessing();
    }
  }, [priority]);

  const startProcessing = () => {
    if (isProcessing.current) return;
    if (priority === "foreground") {
      startImageProcessing();
    } else {
      processTimeoutRef.current = setTimeout(startImageProcessing, 300);
    }
  };

  const startImageProcessing = async () => {
    if (
      !firstImageUrl ||
      !currentImageUrl ||
      isProcessing.current ||
      firstImageUrl === currentImageUrl
    ) {
      onProcessed && onProcessed(firstImageUrl);
      return;
    }
    if (!isOpenCVLoaded) {
      openCVLoadCallbacks.push(() => startImageProcessing());
      return;
    }

    isProcessing.current = true;
    setStatus("이미지 로드 중...");
    try {
      const [img1, img2] = await Promise.all([
        loadImage(firstImageUrl),
        loadImage(currentImageUrl),
      ]);
      const [resized1, resized2] = await Promise.all([
        resizeImage(img1),
        resizeImage(img2),
      ]);
      const [img1r, img2r] = await Promise.all([
        loadImage(resized1),
        loadImage(resized2),
      ]);
      await processWithWorker(img1r, img2r);
      URL.revokeObjectURL(resized1);
      URL.revokeObjectURL(resized2);
    } catch (e) {
      console.error("처리 오류", e);
      setStatus("오류: " + e.message);
      isProcessing.current = false;
      onProcessed && onProcessed(null);
    }
  };

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("이미지 로드 실패: " + src));
      img.src = src;
    });

  const processWithWorker = (img1, img2) =>
    new Promise((resolve, reject) => {
      const canvas1 = document.createElement("canvas");
      const canvas2 = document.createElement("canvas");
      canvas1.width = img1.width;
      canvas1.height = img1.height;
      canvas2.width = img2.width;
      canvas2.height = img2.height;
      const ctx1 = canvas1.getContext("2d");
      const ctx2 = canvas2.getContext("2d");
      ctx1.drawImage(img1, 0, 0);
      ctx2.drawImage(img2, 0, 0);
      const imageData1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
      const imageData2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);

      const code = `
      self.importScripts('https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.7.0-release.1/dist/opencv.js');
      function waitForCV() {
        return new Promise(resolve => {
          const check = () => typeof cv !== 'undefined' && cv.Mat ? resolve() : setTimeout(check, 100);
          check();
        });
      }
      self.onmessage = async ({ data }) => {
        await waitForCV();
        const { img1Data, img2Data, width, height } = data;
        const mat1 = cv.matFromImageData(new ImageData(new Uint8ClampedArray(img1Data), width, height));
        const mat2 = cv.matFromImageData(new ImageData(new Uint8ClampedArray(img2Data), width, height));
        const gray1 = new cv.Mat();
        const gray2 = new cv.Mat();
        cv.cvtColor(mat1, gray1, cv.COLOR_RGBA2GRAY);
        cv.cvtColor(mat2, gray2, cv.COLOR_RGBA2GRAY);
        const orb = new cv.ORB(2000);
        const kp1 = new cv.KeyPointVector();
        const kp2 = new cv.KeyPointVector();
        const des1 = new cv.Mat();
        const des2 = new cv.Mat();
        orb.detectAndCompute(gray1, new cv.Mat(), kp1, des1);
        orb.detectAndCompute(gray2, new cv.Mat(), kp2, des2);
        const bf = new cv.BFMatcher(cv.NORM_HAMMING);
        const knn = new cv.DMatchVectorVector();
        bf.knnMatch(des1, des2, knn, 2);
        const good = new cv.DMatchVector();
        for (let i = 0; i < knn.size(); i++) {
          const m = knn.get(i).get(0);
          const n = knn.get(i).get(1);
          if (m.distance < 0.75 * n.distance) good.push_back(m);
        }
        const srcPts = [], dstPts = [];
        for (let i = 0; i < good.size(); i++) {
          const m = good.get(i);
          srcPts.push(kp1.get(m.queryIdx).pt);
          dstPts.push(kp2.get(m.trainIdx).pt);
        }
        const H = cv.findHomography(
          cv.matFromArray(srcPts.length, 1, cv.CV_32FC2, [].concat(...srcPts.map(p => [p.x, p.y]))),
          cv.matFromArray(dstPts.length, 1, cv.CV_32FC2, [].concat(...dstPts.map(p => [p.x, p.y]))),
          cv.RANSAC, 3
        );
        const aligned = new cv.Mat();
        cv.warpPerspective(mat2, aligned, H, new cv.Size(mat1.cols, mat1.rows));
        const alignedGray = new cv.Mat();
        cv.cvtColor(aligned, alignedGray, cv.COLOR_RGBA2GRAY);
        const diff = new cv.Mat();
        cv.absdiff(gray1, alignedGray, diff);
        const mask = new cv.Mat();
        cv.threshold(diff, mask, 30, 255, cv.THRESH_BINARY);
        const overlay = new cv.Mat();
        cv.cvtColor(mask, overlay, cv.COLOR_GRAY2RGBA);
        for (let y = 0; y < overlay.rows; y++) {
          for (let x = 0; x < overlay.cols; x++) {
            const p = overlay.ucharPtr(y, x);
            if (p[0] > 0) [p[0], p[1], p[2], p[3]] = [0, 0, 255, 255];
          }
        }
        const result = new cv.Mat();
        cv.addWeighted(mat1, 1, overlay, 0.5, 0, result);
        const byteLength = mat1.cols * mat1.rows * 4;
        const clamped = new Uint8ClampedArray(result.data.slice(0, byteLength));
        self.postMessage({ success: true, result: { width: mat1.cols, height: mat1.rows, data: clamped.buffer } }, [clamped.buffer]);
      };
    `;

      const blob = new Blob([code], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const { success, result } = e.data;
        if (success && result) {
          const canvas = canvasRef.current;
          canvas.width = result.width;
          canvas.height = result.height;
          const ctx = canvas.getContext("2d");
          const imageData = new ImageData(
            new Uint8ClampedArray(result.data),
            result.width,
            result.height
          );
          ctx.putImageData(imageData, 0, 0);
          onProcessed && onProcessed(canvas.toDataURL("image/png"));
          setStatus("처리 완료");
          isProcessing.current = false;
          resolve();
        }
        worker.terminate();
        URL.revokeObjectURL(url);
      };

      worker.onerror = (e) => {
        reject(new Error("Worker 오류"));
        worker.terminate();
        URL.revokeObjectURL(url);
      };

      worker.postMessage({
        img1Data: imageData1.data,
        img2Data: imageData2.data,
        width: img1.width,
        height: img1.height,
      });
    });

  return (
    <div style={{ display: "none" }}>
      <canvas ref={canvasRef} width="800" height="600" />
    </div>
  );
});

export default ImageAligner;
