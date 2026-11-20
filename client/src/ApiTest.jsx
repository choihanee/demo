
import { useState } from "react";
import { generateResponses } from "./services/api";

function ApiTest() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);

    try {
      // API 함수 실행
      const data = await generateResponses({
        test: true,
      });

      setResult(data);
      console.log("반환된 데이터:", data);
    } catch (error) {
      console.error("테스트 실패:", error);
      alert("데이터를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "30px" }}>
      <h2>Mock API 테스트</h2>

      <button onClick={handleTest} disabled={loading}>
        {loading ? "데이터 불러오는 중..." : "API 테스트하기"}
      </button>

      {result && (
        <pre>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default ApiTest;
