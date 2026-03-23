# 2026-03-23 GitHub Actions 打包空白页修复

## 问题定位

- 下载的 `ToolBox.app` 打开后空白。
- 检查 `~/Downloads/ToolBox.app/Contents/Resources/app.asar`，只有 `dist/main`，缺少 `dist/renderer/index.html` 和 `dist/renderer/bundle.js`。
- 主进程启动时固定加载 `app.getAppPath()/dist/renderer/index.html`，因此渲染资源缺失会直接导致空白窗口。

## 根因

- GitHub Actions 工作流里直接执行了 `npx electron-builder --mac zip dmg --publish never`。
- 该流程在干净 runner 上不会自动生成 renderer 产物。
- `npm test` 只会执行 `npm run build:main`，因此包内只带了主进程文件，没有前端页面资源。

## 修复

- 在 `release-macos.yml` 和 `test-macos.yml` 中，打包前显式执行 `npm run build`。
- 打包后增加校验步骤，强制检查 `app.asar` 中存在：
  - `dist/renderer/index.html`
  - `dist/renderer/bundle.js`

## 结果

- 后续 GitHub Actions 产物会先生成完整的主进程和渲染进程构建结果，再执行打包。
- 如果将来再次漏掉 renderer 资源，工作流会直接失败，不会继续上传错误安装包。
