# Cinema Look Lab

브라우저에서 시네마틱 색감을 비교하고 직접 조절하는 학습용 사진 웹앱입니다.

- 21개 창작 근사 룩과 룩별 샘플 3장
- 라이트룸식 경향값·커브·HSL·컬러 그레이딩
- 사진 불러오기, 원본 비교, 강도 조절, JPG 저장
- Web Worker 기반 기기 내 처리와 반응형 iPad UI

## 실행

정적 웹 서버에서 저장소 루트를 열면 됩니다. 빌드나 API 키가 필요하지 않습니다.

```sh
python3 -m http.server 8080
```

## GitHub Pages

`.github/workflows/pages.yml`이 main 브랜치의 정적 파일을 배포합니다. 저장소 Settings → Pages에서 GitHub Actions를 선택하면 됩니다.

브랜드·작가 이름의 룩은 공식 LUT가 아닌 창작 근사 표현입니다. 조절값은 학습용 경향값이며 Lightroom 공식 프리셋 수치가 아닙니다. AI 생성 샘플과 생성 설명은 `samples/manifest.json`에 있습니다. 불러온 개인 사진은 서버로 전송하지 않습니다.
