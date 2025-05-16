import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./ImagePopup.module.css";

/**
 * 이미지 팝업 컴포넌트
 *
 * 이미지를 클릭했을 때 팝업으로 확대하여 보여주는 컴포넌트입니다.
 * React Portal을 사용하여 DOM 최상위에 렌더링됩니다.
 */
const ImagePopup = ({ imageUrl, description, onClose, metadata }) => {
  const [compareMode, setCompareMode] = useState(false);
  const [analysisMode, setAnalysisMode] = useState(false);
  const [alignedImageUrl, setAlignedImageUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const firstImageUrl = metadata?.firstImageUrl || null;
  const alignerRef = useRef(null);
  const contentRef = useRef(null);

  // 이미지 URL이 유효한지 확인
  const hasFirstImage = Boolean(firstImageUrl);

  // 이미지 비교 모드 토글
  const toggleCompareMode = () => {
    if (firstImageUrl) {
      setCompareMode(!compareMode);
      setAnalysisMode(false);
      setAlignedImageUrl(null);
    }
  };

  // 이미지 분석 모드 토글
  const toggleAnalysisMode = () => {
    if (firstImageUrl) {
      setAnalysisMode(!analysisMode);
      if (!analysisMode && !alignedImageUrl) {
        processImages();
      }
    }
  };

  // OpenCV를 사용하여 이미지 비교 처리
  const processImages = async () => {
    if (!firstImageUrl || !imageUrl) return;

    setIsProcessing(true);
    setProcessingStatus("이미지 분석 중...");

    try {
      // 동적으로 ImageAligner 모듈 로드
      const ImageAlignerModule = await import("./ImageAligner").catch(
        () => null
      );
      if (!ImageAlignerModule) {
        throw new Error("ImageAligner 모듈을 로드할 수 없습니다.");
      }

      const ImageAligner = ImageAlignerModule.default;

      // DOM에 임시 요소 생성
      const tempDiv = document.createElement("div");
      document.body.appendChild(tempDiv);

      // React 컴포넌트 생성 및 렌더링
      const aligner = document.createElement("div");
      tempDiv.appendChild(aligner);

      // 처리 완료 콜백
      const handleProcessed = (resultImageUrl) => {
        setAlignedImageUrl(resultImageUrl);
        setIsProcessing(false);
        setProcessingStatus("");
        // 임시 요소 제거
        document.body.removeChild(tempDiv);
      };

      // React 요소 생성 및 렌더링
      const { createRoot } = await import("react-dom/client");
      const root = createRoot(aligner);
      root.render(
        <ImageAligner
          firstImageUrl={firstImageUrl}
          currentImageUrl={imageUrl}
          onProcessed={handleProcessed}
          ref={alignerRef}
        />
      );
    } catch (error) {
      console.error("이미지 분석 오류:", error);
      setIsProcessing(false);
      setProcessingStatus("이미지 분석 중 오류가 발생했습니다.");
    }
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (alignerRef.current && alignerRef.current.abort) {
        alignerRef.current.abort();
      }
    };
  }, []);

  // ESC 키로 팝업 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // 균열 폭 정보 추출
  const crackWidth = metadata?.width || metadata?.crackWidth || null;

  // 팝업 내용
  const popup = (
    <div className={styles.popupOverlay} onClick={onClose}>
      <div
        className={styles.popupContent}
        onClick={(e) => e.stopPropagation()}
        ref={contentRef}
      >
        <div className={styles.popupHeader}>
          <h3 className={styles.popupTitle}>{description}</h3>
          <div className={styles.headerRight}>
            {crackWidth && (
              <div className={styles.crackWidthBadge}>
                균열 폭: {crackWidth}
              </div>
            )}
            <button className={styles.closeButton} onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className={styles.imageContainer}>
          {isProcessing ? (
            <div className={styles.processingContainer}>
              <div className={styles.spinner}></div>
              <p className={styles.processingText}>
                {processingStatus || "처리 중..."}
              </p>
            </div>
          ) : analysisMode && alignedImageUrl ? (
            // 분석 모드 - 균열 차이 강조 표시
            <div className={styles.analysisContainer}>
              <img
                src={alignedImageUrl}
                alt="균열 변화 분석"
                className={styles.popupImage}
              />
            </div>
          ) : compareMode ? (
            // 단순 비교 모드 - 두 이미지 나란히 표시
            <div className={styles.compareContainer}>
              <div className={styles.compareImageWrapper}>
                <img
                  src={firstImageUrl}
                  alt="첫 관측 이미지"
                  className={styles.compareImage}
                />
                <div className={styles.compareLabel}>첫 관측</div>
              </div>
              <div className={styles.compareImageWrapper}>
                <img
                  src={imageUrl}
                  alt={description}
                  className={styles.compareImage}
                />
                <div className={styles.compareLabel}>최근 관측</div>
              </div>
            </div>
          ) : (
            // 일반 모드 - 현재 이미지만 표시
            <img
              src={imageUrl}
              alt={description}
              className={styles.popupImage}
            />
          )}
        </div>

        <div className={styles.popupFooter}>
          {analysisMode && alignedImageUrl && (
            <div className={styles.analysisCaption}>
              <span className={styles.newCrackIndicator}></span> 새로 생긴 균열
              또는 확장된 부분
            </div>
          )}
          {hasFirstImage && (
            <div className={styles.buttonContainer}>
              <button
                className={`${styles.compareButton} ${
                  compareMode ? styles.active : ""
                }`}
                onClick={toggleCompareMode}
                disabled={isProcessing}
              >
                {compareMode ? "단일 이미지 보기" : "첫 관측과 비교하기"}
              </button>
              <button
                className={`${styles.analysisButton} ${
                  analysisMode ? styles.active : ""
                }`}
                onClick={toggleAnalysisMode}
                disabled={isProcessing}
              >
                {analysisMode ? "원본 이미지 보기" : "균열 변화 분석하기"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // createPortal을 사용하여 DOM 최상위에 렌더링
  return createPortal(popup, document.body);
};

export default ImagePopup;
