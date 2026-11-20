
import { sampleData } from "./mocks/sampleData";

// Mock 데이터 사용 여부
const USE_MOCK = true;

const BASE = "http://localhost:3001";

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(
      (await res.json().catch(() => ({}))).error || res.status
    );
  }

  return res.json();
}

// Mock 폼 데이터
const mockForm = {
  form: {
    title: "대학생 서비스 만족도 조사",
  },
  questions: [
    {
      id: "Q1",
      type: "multiple_choice",
      title: "우리 서비스에 얼마나 만족하시나요?",
      required: true,
      options: ["매우 만족", "만족", "보통", "불만족"],
    },
    {
      id: "Q2",
      type: "checkbox",
      title: "가장 마음에 드는 기능은 무엇인가요?",
      required: true,
      options: ["디자인", "편리한 기능", "가격", "기타"],
    },
  ],
};

// 구글폼 문항 읽기
export const readForm = async (formUrl) => {
  if (USE_MOCK) {
    console.log("Mock 폼 읽기:", formUrl);

    await new Promise((resolve) => setTimeout(resolve, 500));

    return mockForm;
  }

  return post("/api/form/read", { formUrl });
};

// AI 응답 생성
export const generate = async (form, condition) => {
  if (USE_MOCK) {
    console.log("Mock 데이터 사용 중:", { form, condition });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    return sampleData;
  }

  return post("/api/generate", { form, condition });
};

// 구글폼 응답 제출
export const submitForm = (form, rows) =>
  post("/api/form/submit", { form, rows });
