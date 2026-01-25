# StreamNotes - 特色分支

## 分支介绍

这个分支是 StreamNotes 的特色优化版本，包含了多项功能增强和性能优化，专注于提升用户体验和功能完整性。

## 主要功能

### 1. 长图导出功能
- ✅ 支持将笔记导出为高质量长图
- ✅ 完整显示所有内容，包括长图片
- ✅ 2x 缩放，确保高质量输出
- ✅ 自动处理深色模式
- ✅ 支持跨域图片
- ✅ 一键导出，操作简单

### 2. 图片上传优化
- ✅ 自动缩放上传的图片
- ✅ 最大宽度/高度：1200px
- ✅ 保持图片比例
- ✅ 支持本地模式和浏览器模式
- ✅ 减少文件大小，提高性能

### 3. 搜索功能优化
- ✅ 只搜索文件名，提高搜索速度
- ✅ 实时显示搜索结果
- ✅ 匹配结果高亮显示
- ✅ 流畅的输入体验
- ✅ 响应速度提升

### 4. 代码重构
- ✅ 重构长函数，提高代码可读性
- ✅ 职责分离，便于维护
- ✅ 优化代码结构
- ✅ 提高代码质量

### 5. Toast 通知系统
- ✅ 美观的通知提示
- ✅ 4 种通知类型：成功、错误、警告、信息
- ✅ 自动消失，不阻塞用户操作
- ✅ 支持手动关闭
- ✅ 平滑的动画效果

### 6. 本地模式和浏览器模式
- ✅ 支持切换到浏览器存储模式
- ✅ 支持切换到本地文件夹模式
- ✅ 数据分别存储，互不干扰
- ✅ 清晰的模式标识
- ✅ 一键切换，操作简单

## 技术栈

- **前端框架**: React 18
- **开发语言**: TypeScript
- **构建工具**: Vite
- **样式框架**: Tailwind CSS
- **图标库**: Lucide React
- **Markdown 渲染**: React Markdown
- **图片处理**: Canvas API, html2canvas
- **本地存储**: localStorage, File System Access API

## 安装和使用

### 1. 克隆仓库

```bash
git clone https://github.com/shitianyaa/markdown-notes.git
cd streamnotes
```

### 2. 切换到特色分支

```bash
git checkout feature/long-image-export
```

### 3. 安装依赖

```bash
npm install
```

### 4. 启动开发服务器

```bash
npm run dev
```

### 5. 构建生产版本

```bash
npm run build
```

### 6. 预览生产版本

```bash
npm run preview
```

## 功能详细说明

### 长图导出功能

1. 打开要导出的笔记
2. 点击顶部工具栏的 "长图" 按钮
3. 等待图片生成（可能需要几秒钟）
4. 图片会自动下载到浏览器的默认下载文件夹
5. 文件名格式：`笔记名称.png`

### 图片上传优化

1. 点击编辑器工具栏的图片按钮
2. 选择要上传的图片
3. 系统会自动缩放图片
4. 图片会被保存到当前文件夹
5. 笔记中会插入图片引用

### 搜索功能

1. 在侧边栏的搜索框中输入关键词
2. 实时显示匹配的文件
3. 匹配的文件名会高亮显示
4. 匹配的文件夹会自动展开

### 本地模式和浏览器模式

1. **浏览器模式**: 默认模式，数据存储在浏览器的 localStorage 中
2. **本地模式**: 点击 "打开本地文件夹" 按钮，选择本地目录，数据存储在本地文件系统中
3. **切换模式**: 在本地模式下，点击 "切换到浏览器模式" 按钮，切换回浏览器存储模式

## 项目结构

```
streamnotes/
├── components/          # React 组件
│   ├── Editor.tsx      # 编辑器组件
│   ├── Sidebar.tsx     # 侧边栏组件
│   ├── Toast.tsx       # Toast 通知组件
│   └── ToastContainer.tsx # Toast 容器组件
├── utils/              # 工具函数
│   └── fsHelpers.ts    # 文件系统辅助函数
├── App.tsx             # 主应用组件
├── index.tsx           # 应用入口
├── types.ts            # TypeScript 类型定义
├── package.json        # 项目依赖
├── tsconfig.json       # TypeScript 配置
└── vite.config.ts      # Vite 配置
```

## 贡献指南

1. Fork 仓库
2. 创建新的分支
3. 提交你的更改
4. 创建 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请通过以下方式联系：

- GitHub Issues: https://github.com/shitianyaa/markdown-notes/issues
- Email: your.email@example.com

## 更新日志

### v1.0.0
- ✅ 初始版本
- ✅ 长图导出功能
- ✅ 图片上传优化
- ✅ 搜索功能优化
- ✅ 代码重构
- ✅ Toast 通知系统
- ✅ 本地模式和浏览器模式切换

---

**StreamNotes** - 一个功能强大的 Markdown 笔记应用，专注于用户体验和功能完整性。
