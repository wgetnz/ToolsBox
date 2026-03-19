# LaunchBox

LaunchBox 是一个以 macOS 为主要使用平台的桌面工具启动器，目标是用统一界面管理和快速启动本地工具、脚本、应用和链接。项目最初参考了一款 LaunchBox 产品的整体思路，但当前仓库更明确的方向，是把它打磨成一个顺手、稳定、可扩展，并且符合个人使用风格的本地启动器。

这个 README 主要用于帮助后续协作者和助手快速理解项目目的、当前范围和后续方向，避免把仓库误解为完整复刻项目，或者把产品目标理解偏掉。

配套规划文档见 [docs/ROADMAP.md](/Users/zhangqi/Documents/cdoe/ToolsBox/docs/ROADMAP.md)。

## 项目目的

- 提供一个比命令行和零散脚本更直观的工具启动入口
- 用统一的数据结构管理本地工具、分类、环境和启动参数
- 优先服务 macOS 桌面使用体验，同时保留 Windows 和 Linux 兼容能力
- 后续可继续扩展，但当前第一优先级是“好用的本地启动器”

## 参考来源

这个项目参考了外部的 LaunchBox 产品思路与界面方向：

- 项目地址: [https://github.com/linfeng7z/LaunchBox](https://github.com/linfeng7z/LaunchBox)
- 介绍文章: [https://mp.weixin.qq.com/s/hXB7b6qIEpV7jlEYZwz7jw](https://mp.weixin.qq.com/s/hXB7b6qIEpV7jlEYZwz7jw)

说明：

- 参考重点是产品定位、交互方式和工具启动器思路
- 当前仓库会结合自己的使用习惯和需求继续演进
- 目标是做一个长期可维护、可扩展的本地启动器

## 产品定位

从产品层面看，LaunchBox 期望具备下面这些方向：

- 多类型工具启动
  - JAR 包
  - Python 脚本
  - Shell 脚本
  - 可执行文件
  - macOS App
  - Windows 批处理文件
  - URL 链接
- 工具分类管理
  - 自定义分类
  - 搜索和筛选
  - 最近使用记录
  - 排序
- 环境管理
  - 多 Java 环境
  - 多 Python 环境
  - 自定义启动参数
- 桌面应用体验
  - 卡片式界面
  - 明暗主题
  - 自定义背景色
  - 字体与卡片尺寸调节
  - 托盘、开机启动、窗口状态记忆

## 当前仓库已实现的能力

基于当前代码，仓库已经具备这些核心能力：

- Electron + React + TypeScript 桌面应用
- 工具增删改查
- 分类管理与搜索筛选
- 最近使用统计
- JAR / Python / Shell / executable / app / batch / URL 多类型启动
- Java / Python 环境配置
- 自定义启动参数
- 亮色 / 暗色主题切换
- 字体大小、卡片尺寸、背景色设置
- 窗口状态保存
- macOS 托盘与最小化到托盘

## 当前范围说明

为了避免后续开发跑偏，这个仓库目前按下面的原则理解：

- 主要平台是 macOS
- Windows 和 Linux 属于兼容目标，但不是当前体验打磨的最高优先级
- “本地启动器”是核心，功能决策优先服务日常使用效率
- 交互、默认配置和后续扩展方向，可以按个人习惯持续调整
- 后续助手在做功能决策时，优先考虑启动器体验、稳定性、扩展性和维护成本

## 技术栈

- Electron
- React 19
- TypeScript
- Webpack
- electron-builder

## 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

静态检查：

```bash
npm run lint
npm run typecheck
```

构建：

```bash
npm run build
```

打包：

```bash
npm run pack
npm run dist
```

## 项目结构

```text
src/main      Electron 主进程、IPC、存储、工具启动
src/renderer  React 界面层
src/shared    主进程与渲染进程共享类型
assets        图标与打包资源
```

## 后续开发建议

如果后面的助手需要继续推进这个项目，建议优先围绕以下方向：

- 提升 macOS 下的启动体验和稳定性
- 优化参数解析与复杂命令支持
- 改善开发流程，例如 watch 模式和更顺手的 dev 体验
- 增加数据校验、迁移和容错
- 补上测试、lint 和基础工程规范

## 一句话总结

这是一个以 macOS 为主、强调顺手稳定和可扩展性的本地工具启动器 Electron 桌面应用。
