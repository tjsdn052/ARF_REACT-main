import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import { API_BASE_URL } from "../config/api";

import styles from "../styles/CrackDetail.module.css";
import KeyMetricCard from "../components/KeyMetricCard";
import GraphCard from "../components/GraphCard";
import ImageCard from "../components/ImageCard";
import KakaoMapCard from "../components/KakaoMapCard";
import RiskRankingCard from "../components/RiskRankingCard";

function CrackDetail() {
  const { id } = useParams();
  const [building, setBuilding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    // 데이터 가져오기 (프록시를 통하지 않고 직접 호출)
    fetch(`${API_BASE_URL}/buildings/${id}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("건물 데이터를 불러오는 데 실패했습니다");
        }
        return res.json();
      })
      .then((data) => {
        setBuilding(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("데이터 로딩 실패:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.contentContainer}>
          <Header />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.contentContainer}>
          <Header />
          <div className={styles.error}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.contentContainer}>
        <Header />
        <main className={styles.main}>
          <div className={styles.dashboardGrid}>
            {/* 1행: 카카오맵(1,1), 이미지(1,2~3) */}
            <div
              className={styles.gridItem}
              style={{ gridColumn: "1", gridRow: "1" }}
            >
              <KakaoMapCard buildingId={id} buildingData={building} />
            </div>
            <div
              className={styles.gridItem}
              style={{ gridColumn: "2 / span 2", gridRow: "1" }}
            >
              <ImageCard buildingId={id} buildingData={building} />
            </div>

            {/* 2행: 그래프(2,1), 순위(2,2), 키매트릭(2,3) */}
            <div
              className={styles.gridItem}
              style={{ gridColumn: "1", gridRow: "2" }}
            >
              <GraphCard buildingId={id} buildingData={building} />
            </div>
            <div
              className={styles.gridItem}
              style={{ gridColumn: "2", gridRow: "2" }}
            >
              <RiskRankingCard buildingId={id} buildingData={building} />
            </div>
            <div
              className={styles.gridItem}
              style={{ gridColumn: "3", gridRow: "2" }}
            >
              <KeyMetricCard buildingId={id} buildingData={building} />
            </div>
          </div>
          <div className={styles.disclaimerText}>
            <img src="/warning.svg" alt="경고" className={styles.warningIcon} />
            본 정보는 판단을 돕기 위한 참고용으로 제공되며, 실제 점검 또는
            조치는 전문가의 판단에 따라 수행되어야 합니다.
          </div>
        </main>
      </div>
    </div>
  );
}

export default CrackDetail;
