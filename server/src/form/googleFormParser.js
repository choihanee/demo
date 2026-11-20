
/**
 * Google Form Parser
 * 담당: Google Form 파싱
 *
 * 반환 구조:
 * {
 *   form: {},
 *   sections: [],
 *   questions: [],
 *   condition: {}
 * }
 *
 * 주의:
 * Google Form의 내부 HTML 데이터 구조는 변경될 수 있으므로
 * 실제 폼으로 테스트 후 보완이 필요합니다.
 */

// ==================================================
// 1. URL 검사 및 정리
// ==================================================

function normalizeFormUrl(url) {
    if (!url || typeof url !== "string") {
        throw new Error("Google Form URL을 입력해주세요.");
    }

    const trimmedUrl = url.trim();

    let parsedUrl;

    try {
        parsedUrl = new URL(trimmedUrl);
    } catch {
        throw new Error("올바른 URL 형식이 아닙니다.");
    }

    if (parsedUrl.hostname !== "docs.google.com") {
        throw new Error("Google Form 주소가 아닙니다.");
    }

    if (!parsedUrl.pathname.includes("/forms/")) {
        throw new Error("Google Form 주소가 아닙니다.");
    }

    // viewform 주소만 허용
    if (!parsedUrl.pathname.endsWith("/viewform")) {
        throw new Error("설문 응답용 viewform 주소를 입력해주세요.");
    }

    // 쿼리 문자열 제거
    return `${parsedUrl.origin}${parsedUrl.pathname}`;
}


// ==================================================
// 2. 제출 URL 생성
// ==================================================

function createSubmitUrl(formUrl) {
    const normalizedUrl = normalizeFormUrl(formUrl);

    return normalizedUrl.replace(/\/viewform$/, "/formResponse");
}


// ==================================================
// 3. Google Form HTML 가져오기
// ==================================================

async function fetchFormPage(formUrl) {
    const normalizedUrl = normalizeFormUrl(formUrl);

    const response = await fetch(normalizedUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    if (!response.ok) {
        throw new Error(
            `Google Form 페이지 요청 실패: ${response.status}`
        );
    }

    const html = await response.text();

    if (!html || html.length === 0) {
        throw new Error("Google Form 페이지가 비어 있습니다.");
    }

    return html;
}


// ==================================================
// 4. HTML에서 Google Form 내부 데이터 찾기
// ==================================================

function extractPublicData(html) {
    const marker = "FB_PUBLIC_LOAD_DATA_";

    const markerIndex = html.indexOf(marker);

    if (markerIndex === -1) {
        throw new Error(
            "Google Form 내부 데이터를 찾을 수 없습니다. " +
            "공개 설문인지 확인해주세요."
        );
    }

    const equalIndex = html.indexOf("=", markerIndex);

    if (equalIndex === -1) {
        throw new Error("Google Form 데이터 형식을 읽을 수 없습니다.");
    }

    // JSON 시작 위치 찾기
    let startIndex = html.indexOf("[", equalIndex);

    if (startIndex === -1) {
        throw new Error("Google Form JSON 데이터가 없습니다.");
    }

    // 괄호 깊이를 계산하여 JSON 끝 위치 찾기
    let depth = 0;
    let inString = false;
    let escaped = false;
    let endIndex = -1;

    for (let i = startIndex; i < html.length; i++) {
        const char = html[i];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }

            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === "[") {
            depth++;
        } else if (char === "]") {
            depth--;

            if (depth === 0) {
                endIndex = i;
                break;
            }
        }
    }

    if (endIndex === -1) {
        throw new Error("Google Form JSON 데이터가 끝나지 않았습니다.");
    }

    const jsonText = html.slice(startIndex, endIndex + 1);

    try {
        return JSON.parse(jsonText);
    } catch (error) {
        throw new Error("Google Form 내부 JSON 파싱에 실패했습니다.");
    }
}


// ==================================================
// 5. 데이터 내부 문자열 검색
// ==================================================

function findStrings(data, result = []) {
    if (typeof data === "string") {
        result.push(data);
        return result;
    }

    if (Array.isArray(data)) {
        for (const item of data) {
            findStrings(item, result);
        }

        return result;
    }

    if (data && typeof data === "object") {
        for (const value of Object.values(data)) {
            findStrings(value, result);
        }
    }

    return result;
}


// ==================================================
// 6. 질문 유형 이름 정리
// ==================================================

function normalizeQuestionType(type) {
    const typeMap = {
        multiple_choice: "multiple_choice",
        checkbox: "checkbox",
        dropdown: "dropdown",
        linear_scale: "linear_scale",
        short_text: "short_text",
        paragraph: "paragraph",
        multiple_choice_grid: "multiple_choice_grid",
        date: "date"
    };

    return typeMap[type] || "unknown";
}


// ==================================================
// 7. 기본 결과 구조 만들기
// ==================================================

function createEmptyFormData(formUrl) {
    const normalizedUrl = normalizeFormUrl(formUrl);

    return {
        form: {
            title: "",
            description: "",
            form_url: normalizedUrl,
            submit_url: createSubmitUrl(normalizedUrl),
            has_branching: false
        },

        sections: [],

        questions: [],

        condition: {
            total: 100,
            attributes: {}
        }
    };
}


// ==================================================
// 8. Google Form 파싱 메인 함수
// ==================================================

async function parseGoogleForm(formUrl) {
    // URL 검사
    const normalizedUrl = normalizeFormUrl(formUrl);

    // HTML 가져오기
    const html = await fetchFormPage(normalizedUrl);

    // Google Form 내부 데이터 추출
    const publicData = extractPublicData(html);

    // 결과 기본 구조
    const formData = createEmptyFormData(normalizedUrl);

    // 내부 데이터 확인용 문자열 목록
    const strings = findStrings(publicData);

    // 제목 후보 확인
    if (strings.length > 0) {
        formData.form.title = strings[0];
    }

    // 현재는 Google Form 내부 데이터 확보 단계
    // 실제 질문 구조 추출은 내부 데이터 구조 분석 후 추가

    return {
        ...formData,
        raw_data: publicData
    };
}


// ==================================================
// 9. 외부에서 사용할 수 있도록 함수 내보내기
// ==================================================

module.exports = {
    normalizeFormUrl,
    createSubmitUrl,
    fetchFormPage,
    extractPublicData,
    findStrings,
    normalizeQuestionType,
    createEmptyFormData,
    parseGoogleForm
};
