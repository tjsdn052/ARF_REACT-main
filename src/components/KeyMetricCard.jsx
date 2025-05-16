import React, { useState, useEffect } from "react";
import styles from "./KeyMetricCard.module.css";

function KeyMetricCard({ buildingId, buildingData: propsBuildingData }) {
  const [loading, setLoading] = useState(true);
  const [buildingData, setBuildingData] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [lastInspection, setLastInspection] = useState(null);

  useEffect(() => {
    if (!buildingId) {
      setLoading(false);
      return;
    }

    // 부모 컴포넌트로부터 전달받은 데이터가 있으면 사용
    if (propsBuildingData) {
      setBuildingData(propsBuildingData);
      calculateMetrics(propsBuildingData);
      setLoading(false);
      return;
    }

    // 전달받은 데이터가 없는 경우에만 API 요청
    setLoading(true);
    const apiBaseUrl = "https://afk-mock.onrender.com";

    // 건물 데이터 가져오기
    fetch(`${apiBaseUrl}/buildings/${buildingId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("건물 데이터를 불러오는 데 실패했습니다");
        }
        return response.json();
      })
      .then((data) => {
        setBuildingData(data);
        calculateMetrics(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("건물 정보 로드 실패:", err);
        setLoading(false);
      });
  }, [buildingId, propsBuildingData]);

  // 건물 데이터에서 메트릭 계산
  const calculateMetrics = (data) => {
    if (!data || !data.waypoints) {
      setMetrics([]);
      return;
    }

    // 모든 균열 정보 모으기
    let latestDate = null;

    // 웨이포인트당 하나의 균열로 계산 (웨이포인트 수 = 균열 수)
    const totalCracks = data.waypoints.length;

    // 날짜별 웨이포인트 수 계산
    const cracksByDate = {};

    data.waypoints.forEach((waypoint) => {
      if (waypoint.cracks && waypoint.cracks.length > 0) {
        // 가장 최근 점검일 찾기
        waypoint.cracks.forEach((crack) => {
          const crackDate = new Date(crack.date);

          // 날짜별 웨이포인트 수 누적
          const dateStr = crack.date;
          if (!cracksByDate[dateStr]) {
            cracksByDate[dateStr] = new Set();
          }
          cracksByDate[dateStr].add(waypoint.id);

          if (!latestDate || crackDate > latestDate) {
            latestDate = crackDate;
          }
        });
      }
    });

    setLastInspection(latestDate ? latestDate.toISOString() : null);

    // 날짜별 웨이포인트 수 정렬
    const sortedDates = Object.keys(cracksByDate).sort(
      (a, b) => new Date(b) - new Date(a)
    );

    // 최대 균열 폭 계산
    let maxWidth = 0;
    data.waypoints.forEach((waypoint) => {
      if (waypoint.cracks && waypoint.cracks.length > 0) {
        const waypointMaxWidth = Math.max(
          ...waypoint.cracks.map((crack) => crack.width_mm || 0)
        );
        maxWidth = Math.max(maxWidth, waypointMaxWidth);
      }
    });

    // 균열 수 변화량 계산 (최근 두 날짜 사이의 차이)
    let crackCountChange = 0;
    if (sortedDates.length >= 2) {
      const latestCount = cracksByDate[sortedDates[0]].size;
      const previousCount = cracksByDate[sortedDates[1]].size;
      crackCountChange = latestCount - previousCount;
    }

    // 메트릭 설정
    setMetrics([
      {
        id: "crack_count",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
            />
          </svg>
        ),
        label: "전체 균열 수",
        value: totalCracks,
        unit: "개",
        change: null,
        changeType: null,
      },
      {
        id: "max_width",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
            />
          </svg>
        ),
        label: "최대 균열 폭",
        value: maxWidth,
        unit: "mm",
        change: null,
        changeType: null,
      },
      {
        id: "crack_count_change",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
        ),
        label: "균열 변화량",
        value: Math.abs(crackCountChange),
        unit: "개",
        change: crackCountChange === 0 ? null : crackCountChange,
        changeType:
          crackCountChange > 0
            ? "increase"
            : crackCountChange < 0
            ? "decrease"
            : null,
      },
    ]);
  };

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.loading}>데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      {lastInspection && (
        <span className={styles.inspectionDate}>
          마지막 점검일: {new Date(lastInspection).toLocaleDateString("ko-KR")}
        </span>
      )}

      <div className={styles.metricsContainer}>
        {metrics.map((metric) => (
          <div key={metric.id} className={styles.metricItem}>
            <div className={styles.metricIcon}>{metric.icon}</div>
            <div className={styles.metricContent}>
              <div className={styles.metricValue}>
                {metric.value}
                {metric.unit && (
                  <span className={styles.unit}>{metric.unit}</span>
                )}
                {metric.change && (
                  <span
                    className={`${styles[metric.changeType]}`}
                    style={{ fontSize: "0.8rem", marginLeft: "0.5rem" }}
                  >
                    {metric.changeType === "increase" ? "+" : ""}
                    {Math.abs(metric.change)}
                  </span>
                )}
              </div>
              <div className={styles.metricLabel}>{metric.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default KeyMetricCard;
