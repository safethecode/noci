# Noci

웹 인터페이스에 사용하는 SVG 아이콘입니다. 각 아이콘은 16px·24px 원본과 48px 출력물을 제공합니다.

- [디자인 가이드](DESIGN.md): 선 굵기, 여백, 중심, 글자 정렬
- [접근성 가이드](docs/accessibility.md): 장식용 아이콘, 이름, 대비, 버튼 사용법
- [사용 예시](docs/integration.md): HTML, React, Vue, Svelte
- [기여 방법](CONTRIBUTING.md): 파일 구조, 검사, 커밋, PR

```js
import check from 'noci-icons/icons/check';
import { renderIcon } from 'noci-icons/core';

renderIcon(check, { size: 16 });
renderIcon(check, { size: 24, label: '저장 완료' });
```

글자가 의미를 설명하면 `label`을 생략합니다. 아이콘만 있는 버튼은 버튼에 동작 이름을 붙이고 SVG는 장식용으로 둡니다.

프레임워크별 패키지 없이 같은 SVG와 데이터를 사용합니다. 런타임 의존성이 없으며 개별 아이콘 import, ESM, CommonJS, TypeScript 타입을 지원합니다.

## 개발

Node.js 22 이상이 필요합니다. 아직 npm에 게시하지 않았습니다.

```sh
npm ci
npm run check
npm run browsers:install
npm run test:browser
npm run qa
```

`npm pack`으로 만든 파일을 다른 프로젝트에 설치해 사용할 수 있습니다. 빌드 결과와 검수 이미지는 커밋하지 않습니다.

[MIT 라이선스](LICENSE)
