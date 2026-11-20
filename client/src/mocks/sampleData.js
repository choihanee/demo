export const sampleData = {
  meta: {
    is_synthetic: true,
    label: "AI 생성 데이터",
    form_title: "대학생 서비스 만족도 조사",
    count: 2,
    warnings: [],
    created_at: new Date().toISOString(),
  },

  rows: [
    {
      respondent_id: 1,
      is_synthetic: true,
      type_id: "T1",
      type_name: "적극적인 사용자",
      attributes: {
        age: "20대",
        gender: "여성",
      },
      quality: "normal",
      page_history: "0",
      answers: {
        Q1: "매우 만족",
        Q2: ["디자인", "편리한 기능"],
      },
      other: {},
    },
    {
      respondent_id: 2,
      is_synthetic: true,
      type_id: "T2",
      type_name: "일반 사용자",
      attributes: {
        age: "30대",
        gender: "남성",
      },
      quality: "normal",
      page_history: "0",
      answers: {
        Q1: "보통",
        Q2: ["가격"],
      },
      other: {},
    },
  ],

  stats: {
    Q1: {
      "매우 만족": 1,
      "보통": 1,
    },
    Q2: {
      "디자인": 1,
      "편리한 기능": 1,
      "가격": 1,
    },
  },

  types: [
    {
      type_id: "T1",
      name: "적극적인 사용자",
      ratio: 0.5,
      description: "서비스를 적극적으로 사용하는 유형",
    },
    {
      type_id: "T2",
      name: "일반 사용자",
      ratio: 0.5,
      description: "일반적인 사용 패턴을 가진 유형",
    },
  ],
};