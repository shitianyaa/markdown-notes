# StreamNotes 📝

StreamNotes 是一个**本地优先 (Local-First)** 的现代化 Markdown 笔记应用。

它利用现代浏览器的 File System Access API，允许用户直接打开、编辑和保存电脑硬盘上的真实文件。这意味着您的数据完全由您掌控，您可以随时使用 VS Code、Obsidian 或其他编辑器同时操作这些文件。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Vite](https://img.shields.io/badge/Vite-5.0-purple)

## ✨ 核心特性

### 1. 📂 本地优先与文件管理
- **硬盘直连**: 点击“打开本地文件夹”，直接挂载电脑目录。所有修改实时写入硬盘。
- **文件树操作**: 支持创建文件/文件夹、重命名、删除（递归删除文件夹）以及全文搜索。
- **纯净视图**: 侧边栏自动过滤非 `.md` 文件，保持笔记列表清爽。

### 2. 🖼️ 智能图片/资源管理
- **独立文件存储**: 上传的图片不会转换成 Base64 乱码，而是保存为同级目录下的独立文件（如 `image.png`）。
- **相对路径引用**: 自动生成标准 Markdown 语法 `![name](image.png)`，兼容性极佳。
- **🧹 资源清理 (特色功能)**: 即使删除了笔记中的图片引用，文件往往还会残留。StreamNotes 提供“一键清理”功能，自动扫描并删除所有未被引用的“孤儿”图片，释放存储空间。

### 3. ✍️ 强大的编辑器
- **三种视图**:
  - **编辑模式**: 专注写作。
  - **分栏模式**: 左侧编辑，右侧实时预览。
  - **阅读模式**: 沉浸式阅读渲染后的文档。
- **🔗 同步滚动**: 在分栏模式下，滚动一侧，另一侧会自动按比例跟随，方便校对。
- **丰富的工具栏**: 快捷插入标题、列表、代码块、引用、表格等。
- **GFM 支持**: 完美支持 GitHub Flavored Markdown (表格、删除线、任务列表等)。

### 4. 🎨 现代化 UI/UX
- 基于 **Tailwind CSS** 设计，简洁美观。
- 针对代码块优化的暗色主题。
- 响应式设计，支持移动端侧边栏折叠。

## 🚀 快速开始

### 前置要求
- Node.js (推荐 v16+)
- npm 或 yarn

### 安装与运行

1. **克隆项目**
   ```bash
   git clone https://github.com/shitianyaa/markdown-notes.git
   cd streamnotes
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **构建生产版本**
   ```bash
   npm run build
   ```

## 🛠️ 技术栈

- **核心框架**: React 18, TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **图标库**: Lucide React
- **Markdown 引擎**:
  - `react-markdown`: 核心渲染
  - `remark-gfm`: 扩展语法支持
  - `rehype-raw`: HTML 解析支持

## 📖 使用指南

### 关于图片上传
点击编辑器工具栏的 **图片图标**，选择本地图片。
- **本地模式下**: 图片文件会被直接复制到当前笔记所在的硬盘文件夹中。
- **浏览器模式下**: 图片会以 Base64 形式暂存在内存/LocalStorage 中（注意：浏览器存储空间有限，建议使用本地模式管理大量图片）。

### 关于同步滚动
在顶部工具栏点击 **“🔗 同步”** 按钮即可开启或关闭双屏同步滚动功能。该功能仅在“分栏模式”下有效。

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进这个项目！

## 📄 许可证

MIT License
