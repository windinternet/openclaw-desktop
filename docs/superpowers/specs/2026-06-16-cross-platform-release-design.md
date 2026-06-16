# Cross-Platform Release Design

## 背景

OpenClaw Desktop 已使用 Electron + Vite + electron-builder，并已有基础 `.github/workflows/release.yml`。当前配置只能生成较少产物：Windows NSIS、macOS DMG、Linux AppImage，且没有明确覆盖 x64/arm64、Linux deb/rpm/tar.gz、Windows portable、macOS zip 等开源项目常见下载包。

目标是先建立可用的自动发布链路：推送 `v*` tag 后由 GitHub Actions 自动构建全平台产物并创建 GitHub Release。当前阶段不强制代码签名和 notarization，但配置与文档必须预留后续启用签名的入口。

## 发布范围

正式 Release 覆盖以下产物：

| 平台 | 架构 | 产物 |
| --- | --- | --- |
| macOS | x64, arm64 | `.dmg`, `.zip` |
| Windows | x64, arm64 | NSIS installer `.exe`, portable `.exe` |
| Linux | x64, arm64 | `.AppImage`, `.deb`, `.rpm`, `.tar.gz` |

Release 触发方式：

- `git push origin vX.Y.Z` 自动创建 GitHub Release。
- `workflow_dispatch` 支持手动试跑；当手动运行选择的是 `v*` tag ref 时同样发布 Release。
- 普通分支/PR 继续由现有 `ci.yml` 做 lint、typecheck、build、test，不在 release workflow 里重复跑全平台矩阵。

## 架构

`package.json` 继续承载 electron-builder 配置，避免引入新的发布工具。配置会增加稳定的 `artifactName`、平台 target、Linux package metadata，以及 Windows NSIS/portable 的独立文件名，避免两个 `.exe` 目标互相覆盖。

`.github/workflows/release.yml` 使用 GitHub-hosted runner 的平台/架构矩阵：

- `macos-15-intel` 构建 macOS x64。
- `macos-latest` 构建 macOS arm64。
- `windows-latest` 构建 Windows x64。
- `windows-11-arm` 构建 Windows arm64。
- `ubuntu-latest` 构建 Linux x64。
- `ubuntu-latest` 交叉构建 Linux arm64，因为 electron-builder 的 deb/rpm 打包依赖 fpm，而当前下载的 fpm 辅助工具是 Linux x86 二进制，不能在原生 Linux arm64 runner 上执行。

electron-builder 官方文档说明不要期待在单一平台构建所有平台，macOS 签名只能在 macOS 上完成；GitHub Actions 官方文档已提供 Linux arm64、Windows arm64、macOS Intel/arm64 runner 标签。因此采用真实目标平台 runner，而不是在单一 Linux runner 上交叉构建全部平台。

## 签名策略

当前阶段发布未签名包：

- CI 设置 `CSC_IDENTITY_AUTO_DISCOVERY=false`，避免 runner 上缺少证书时构建失败。
- 不在 `package.json` 中写死 `identity: null`，以便后续通过环境变量和 secrets 启用签名。
- 文档列出后续 macOS notarization 与 Windows code signing 所需 secrets。

后续启用签名时，主要工作是：

- 配置 Apple Developer 证书、`APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`。
- 配置 Windows 代码签名证书，如 `WIN_CSC_LINK` / `CSC_LINK` 与 `CSC_KEY_PASSWORD`。
- 调整 release workflow 中的 `CSC_IDENTITY_AUTO_DISCOVERY` 或按 secrets 条件启用签名。

## 错误处理

- Linux runner 在构建前安装 `rpm` 和 `libopenjp2-tools`，覆盖 rpm/AppImage 相关依赖。
- artifact 上传使用 `if-no-files-found: error`，矩阵中任一平台没有产物会直接失败。
- Release job 生成 `SHA256SUMS.txt`，便于用户下载后校验。
- Release job 只在 `refs/tags/v*` 上执行，避免手动在普通分支上误创建正式 Release。

## 验证

本地验证：

- `npm run typecheck`
- `npm run build`
- 在当前 macOS 环境至少运行一次 macOS electron-builder dry build：`npx electron-builder --mac dmg zip --x64 --publish never`

远端验证：

- GitHub Actions tag workflow 是全平台最终验证来源，因为 Windows/Linux/arm64/macOS Intel 产物依赖对应 runner。
- 第一次发版可先推送测试 tag，例如 `v0.1.1-test.1`；确认产物完整后删除测试 Release/tag 或改用正式语义化版本 tag。
