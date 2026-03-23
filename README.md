# LaunchBox

LaunchBox 是一个以 macOS 为主要使用平台的桌面工具启动器，目标是用统一界面管理和快速启动本地工具、脚本、应用和链接。项目最初参考了一款面向安全研究场景的同名工具，但当前仓库的重点不是网络安全工作流本身，而是把它打磨成一个顺手、稳定、可扩展的本地启动器。

这个 README 主要用于帮助后续协作者和助手快速理解项目目的、当前范围和后续方向，避免把仓库误解为通用安全平台或完整复刻项目。

## 项目目的

- 提供一个比命令行和零散脚本更直观的工具启动入口
- 用统一的数据结构管理本地工具、分类、环境和启动参数
- 优先服务 macOS 桌面使用体验
- 后续可继续扩展，但当前第一优先级是“好用的本地启动器”

## 参考来源

这个项目参考了外部的 LaunchBox 产品思路与界面方向：

- 项目地址: [https://github.com/linfeng7z/LaunchBox](https://github.com/linfeng7z/LaunchBox)
- 介绍文章: [https://mp.weixin.qq.com/s/hXB7b6qIEpV7jlEYZwz7jw](https://mp.weixin.qq.com/s/hXB7b6qIEpV7jlEYZwz7jw)

说明：

- 参考重点是产品定位、交互方式和工具启动器思路
- 当前仓库不是对外部项目的闭源代码还原
- 当前实现更偏“通用本地工具启动器”，安全工具只是可支持的使用场景之一

## 产品定位

从产品层面看，LaunchBox 期望具备下面这些方向：

- 多类型工具启动
  - JAR 包
  - Python 脚本
  - Shell 脚本
  - 可执行文件
  - macOS App
  - URL 链接
- 工具分类管理
  - 自定义分类
  - 搜索和筛选
  - 排序
  - 两级分类
- 环境管理
  - 多 Java 环境
  - 多 Python 环境
  - 自定义启动参数
  - 工作目录
- 桌面应用体验
  - 卡片式界面
  - 系统 / 明暗主题
  - 网格 / 列表视图
  - 字体与卡片尺寸调节
  - 侧边栏宽度记忆
  - 托盘、开机启动、窗口状态记忆

## 当前仓库已实现的能力

基于当前代码，仓库已经具备这些核心能力：

- Electron + React + TypeScript 桌面应用
- 工具增删改查
- 两级分类管理与搜索筛选
- 最近使用统计
- JAR / Python / Shell / executable / app / URL 多类型启动
- Java / Python 环境配置
- 自定义启动参数与工作目录
- 系统 / 深色 / 浅色主题切换
- 网格 / 列表视图切换
- 字体大小、卡片尺寸、侧边栏宽度设置
- Lily 数据迁移脚本
- 窗口状态保存
- macOS 托盘与最小化到托盘

## 当前范围说明

为了避免后续开发跑偏，这个仓库目前按下面的原则理解：

- 主要平台是 macOS
- “工具启动器”是核心，不需要把项目做成重型安全平台
- 默认分类和示例可以保留安全研究语境，但功能设计应尽量通用
- 后续助手在做功能决策时，优先考虑启动器体验、稳定性和可维护性

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

测试：

```bash
npm test
```

Lily 数据迁移：

```bash
npm run migrate:lily -- /path/to/data.json
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
scripts       数据迁移等辅助脚本
assets        图标与打包资源
```

## 后续开发建议

如果后面的助手需要继续推进这个项目，建议优先围绕以下方向：

- 提升 macOS 下的启动体验和稳定性
- 优化参数解析与复杂命令支持
- 改善开发流程，例如 watch 模式和更顺手的 dev 体验
- 增加数据校验、迁移和容错
- 延展工具导入与批量整理能力，但要保持 macOS 方案的一致性

## 一句话总结

这是一个参考安全工具启动器产品思路、但当前更聚焦于 macOS 本地工具管理与启动体验的 Electron 桌面应用。
