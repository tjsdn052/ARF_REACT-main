import React, { useState, useEffect } from "react";
import styles from "./RiskRankingCard.module.css";
import VWorldMaps from "./VWorldMaps";

/**
 * 균열 심각도 순위 카드 컴포넌트
 *
 * 건물 내 균열의 분포와 심각도를 시각적으로 표시합니다.
 * buildingId가 제공되면 해당 건물의 균열 군집 정보를 표시합니다.
 */
export default function RiskRankingCard({ buildingId, buildingData }) {
  const [clusterData, setClusterData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [buildingName, setBuildingName] = useState("");

  // VWorld 맵 팝업 관련 상태 추가
  const [showVWorldMap, setShowVWorldMap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // VWorld 맵 팝업 닫기 핸들러
  const handleVWorldMapClose = () => {
    setShowVWorldMap(false);
  };

  // 균열 항목 클릭 핸들러
  const handleCrackClick = (point) => {
    if (point.location && point.location.latitude && point.location.longitude) {
      // 웨이포인트 높이 값이 있으면 +20m, 없으면 기본값 100 사용
      const baseHeight = point.location.altitude || 100;
      const cameraHeight = baseHeight + 20;

      console.log(
        `웨이포인트 높이: ${baseHeight}m, 카메라 높이: ${cameraHeight}m`
      );

      // 웨이포인트 ID 타입 체크 및 변환
      const waypointIdStr = String(point.id);
      console.log(
        `웨이포인트 ID: ${waypointIdStr}, 타입: ${typeof point.id} -> ${typeof waypointIdStr}`
      );

      setSelectedLocation({
        latitude: point.location.latitude,
        longitude: point.location.longitude,
        altitude: cameraHeight, // 웨이포인트 높이 + 20m 또는 기본값 100 + 20m
        waypointId: waypointIdStr, // 문자열로 변환된 웨이포인트 ID
      });

      // 약간의 지연 후 모달 표시
      setTimeout(() => {
        setShowVWorldMap(true);
      }, 50);
    } else {
      console.warn("선택한 지점에 위치 정보가 없습니다:", point);
    }
  };

  useEffect(() => {
    if (buildingId) {
      // buildingData가 있으면 바로 처리
      if (buildingData) {
        processBuilding(buildingData);
        return;
      }

      // buildingData가 없는 경우 API 호출
      setLoading(true);
      const apiBaseUrl = "https://afk-mock.onrender.com";

      fetch(`${apiBaseUrl}/buildings/${buildingId}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("건물 데이터를 불러오는 데 실패했습니다.");
          }
          return response.json();
        })
        .then((data) => {
          processBuilding(data);
        })
        .catch((err) => {
          console.error("데이터 로딩 실패:", err);
          setError(err.message);
          setLoading(false);
        });
    } else {
      // 건물 ID가 없는 경우 모든 건물 불러와서 첫번째 건물 데이터 표시
      setLoading(true);
      const apiBaseUrl = "https://afk-mock.onrender.com";

      fetch(`${apiBaseUrl}/buildings`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("건물 데이터를 불러오는 데 실패했습니다.");
          }
          return response.json();
        })
        .then((buildings) => {
          if (buildings && buildings.length > 0) {
            processBuilding(buildings[0]);
          } else {
            setLoading(false);
            setClusterData([]);
          }
        })
        .catch((err) => {
          console.error("데이터 로딩 실패:", err);
          setError(err.message);
          setLoading(false);
        });
    }
  }, [buildingId, buildingData]);

  // 건물 데이터 처리 함수
  const processBuilding = (data) => {
    setBuildingName(data.name || "전체 건물");

    // 측정 지점 데이터 수집
    const pointsData = data.waypoints
      ? data.waypoints.map((point) => {
          if (!point.cracks || point.cracks.length === 0) {
            return {
              id: point.id,
              label: point.label,
              latestWidth: 0,
              date: null,
              location: point.location,
            };
          }

          // 날짜로 정렬하여 최신 값 가져오기
          const sortedCracks = [...point.cracks].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );

          return {
            id: point.id,
            label: point.label,
            latestWidth: sortedCracks[0].width_mm || 0,
            date: sortedCracks[0].date,
            location: point.location,
          };
        })
      : [];

    // 균열 폭 기준 내림차순 정렬, 폭이 같으면 이름 기준 오름차순 정렬
    const sortedPoints = [...pointsData].sort((a, b) => {
      if (b.latestWidth === a.latestWidth) {
        return a.label.localeCompare(b.label);
      }
      return b.latestWidth - a.latestWidth;
    });

    setClusterData(sortedPoints);
    setLoading(false);
  };

  // 균열 심각도에 따른 색상 계산
  const getSeverityColor = (width) => {
    if (width >= 2.0) return "#e73c3c"; // 심각 (빨간색)
    if (width >= 1.0) return "#5e5ae6"; // 주의 (파란색)
    return "#66cc66"; // 관찰 (초록색)
  };

  // 균열 수준 라벨 계산
  const getSeverityLabel = (width) => {
    if (width >= 2.0) return "심각";
    if (width >= 1.0) return "주의";
    return "관찰";
  };

  // 버튼 스타일 계산
  const getSeverityButtonClass = (width) => {
    if (width >= 2.0) return styles.severityHigh; // 심각
    if (width >= 1.0) return styles.severityMedium; // 주의
    return styles.severityLow; // 관찰
  };

  // 군집 요약 통계 계산
  const getClusterStats = () => {
    if (!clusterData || clusterData.length === 0) return null;

    const total = clusterData.length;
    const critical = clusterData.filter(
      (point) => point.latestWidth >= 2.0
    ).length;
    const warning = clusterData.filter(
      (point) => point.latestWidth >= 1.0 && point.latestWidth < 2.0
    ).length;
    const observe = clusterData.filter(
      (point) => point.latestWidth < 1.0
    ).length;

    return { total, critical, warning, observe };
  };

  const stats = getClusterStats();

  // 날짜 포맷팅 함수
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}. ${month}. ${day}.`;
  };

  return (
    <div className={styles.clusterCard}>
      {loading ? (
        <div className={styles.loading}>데이터를 불러오는 중...</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : clusterData.length === 0 ? (
        <div className={styles.noData}>
          해당 구조물의 측정 데이터가 없습니다.
        </div>
      ) : (
        <>
          {stats && (
            <div className={styles.statsContainer}>
              <div className={styles.statItem} style={{ color: "#e73c3c" }}>
                <div className={styles.statValue}>{stats.critical}</div>
                <div className={styles.statLabel}>심각</div>
              </div>
              <div className={styles.statItem} style={{ color: "#5e5ae6" }}>
                <div className={styles.statValue}>{stats.warning}</div>
                <div className={styles.statLabel}>주의</div>
              </div>
              <div className={styles.statItem} style={{ color: "#66cc66" }}>
                <div className={styles.statValue}>{stats.observe}</div>
                <div className={styles.statLabel}>관찰</div>
              </div>
            </div>
          )}

          <div className={styles.clusterContent}>
            <div className={styles.clusterList}>
              {clusterData.map((point) => (
                <div
                  key={point.id}
                  className={styles.clusterItem}
                  onClick={() => handleCrackClick(point)}
                >
                  <div className={styles.leftSection}>
                    <div
                      className={styles.statusIndicator}
                      style={{
                        backgroundColor: getSeverityColor(point.latestWidth),
                      }}
                    ></div>
                    <div className={styles.pointInfo}>
                      <div className={styles.pointLabel}>{point.label}</div>
                      <div className={styles.pointMeta}>
                        {point.date && (
                          <>
                            <span className={styles.date}>
                              {formatDate(point.date)}
                            </span>
                            <span className={styles.dot}>•</span>
                          </>
                        )}
                        <span className={styles.width}>
                          {point.latestWidth}mm
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    className={`${
                      styles.severityButton
                    } ${getSeverityButtonClass(point.latestWidth)}`}
                  >
                    {getSeverityLabel(point.latestWidth)}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* VWorld 맵 팝업 */}
      {showVWorldMap && selectedLocation && (
        <React.Fragment>
          {/* 에러 바운더리로 감싸지 않았으므로 try-catch는 의미 없지만, 향후 디버깅을 위한 조건 로깅 추가 */}
          {console.log("VWorldMaps 렌더링:", {
            buildingId,
            waypointId: selectedLocation.waypointId,
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            height: selectedLocation.altitude,
          })}
          <VWorldMaps
            visible={showVWorldMap}
            onClose={handleVWorldMapClose}
            latitude={selectedLocation.latitude}
            longitude={selectedLocation.longitude}
            height={selectedLocation.altitude}
            buildingId={buildingId}
            waypointId={selectedLocation.waypointId}
          />
        </React.Fragment>
      )}
    </div>
  );
}
