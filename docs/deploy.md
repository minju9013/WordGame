# 배포 (GitHub Pages)

이 프로젝트는 GitHub Pages로 배포됩니다.

**배포 주소:** https://minju9013.github.io/WordGame/

## 배포 방법

1. 변경 사항을 `main` 브랜치에 커밋합니다.
2. `main` 브랜치에 푸시하면 GitHub Actions가 자동으로 Pages를 빌드·배포합니다.

```bash
git add .
git commit -m "변경 내용 설명"
git push origin main
```

3. 1~2분 후 배포 주소에서 확인합니다.
4. 이전 화면이 보이면 **강력 새로고침** (`Cmd + Shift + R`)을 해보세요.

## 배포 상태 확인

GitHub 저장소 → **Actions** 탭에서 `pages build and deployment` 워크플로가 `success`인지 확인합니다.

터미널에서 확인하려면:

```bash
gh run list --repo minju9013/WordGame --limit 3
```

## 자주 겪는 문제

### `Deployment failed, try again later.`

GitHub Pages 쪽 일시 오류로 배포가 실패하는 경우가 있습니다. 코드 문제가 아닐 때가 많습니다.

**해결 순서:**

1. 실패한 워크플로 **Re-run failed jobs**로 재실행
2. 계속 실패하거나 `queued`에서 오래 멈추면, 빈 커밋으로 재배포 트리거:

```bash
git commit --allow-empty -m "chore: Pages 재배포 트리거"
git push origin main
```

3. 새 워크플로가 `success`가 되면 배포 완료입니다.

### 사이트에 변경이 안 보임

- 브라우저 캐시 때문일 수 있습니다 → `Cmd + Shift + R`
- Actions에서 최신 커밋이 `success`인지 확인하세요.

## 저장소 정보

- GitHub: https://github.com/minju9013/WordGame
- Pages 소스: `main` 브랜치, 루트(`/`) 경로
