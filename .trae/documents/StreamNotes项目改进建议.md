# StreamNotes主题切换功能实现计划

## 实现方案
采用CSS变量方案实现主题切换，通过切换根元素的CSS变量值来改变整个应用的主题。

## 实施步骤

### 1. 修改 `index.html`
**目标**：添加CSS变量定义，支持浅色和深色主题

**修改内容**：
- 在 `<style>` 标签中添加CSS变量定义
- 修改现有样式，使用CSS变量替代硬编码颜色
- 添加主题相关的CSS类

**预期效果**：应用支持通过CSS变量切换主题

### 2. 修改 `App.tsx`
**目标**：添加主题状态管理和切换逻辑

**修改内容**：
- 添加 `theme` 状态变量，支持 `light` 和 `dark` 两种主题
- 添加主题切换函数 `toggleTheme`
- 将主题状态持久化到localStorage
- 修改根元素的类名，应用当前主题

**预期效果**：应用能够管理主题状态，并在主题切换时更新UI

### 3. 修改 `Sidebar.tsx`
**目标**：添加主题切换按钮

**修改内容**：
- 在侧边栏添加主题切换按钮
- 确保侧边栏样式使用CSS变量

**预期效果**：用户可以通过侧边栏的按钮切换主题

### 4. 修改 `Editor.tsx`
**目标**：确保编辑器和Markdown渲染支持主题切换

**修改内容**：
- 修改编辑器样式，使用CSS变量
- 修改Markdown渲染样式，使用CSS变量
- 确保代码块、引用等元素支持主题切换

**预期效果**：编辑器和Markdown渲染能够根据当前主题自动调整样式

## 技术细节

### CSS变量定义
```css
:root {
  /* Light Theme Variables */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --border-color: #e2e8f0;
  --sidebar-bg: #ffffff;
  --editor-bg: #ffffff;
  --preview-bg: #ffffff;
  --code-bg: #1e293b;
  --code-text: #e2e8f0;
  --scrollbar-thumb: #cbd5e1;
  --scrollbar-thumb-hover: #94a3b8;
}

[data-theme="dark"] {
  /* Dark Theme Variables */
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --text-primary: #f1f5f9;
  --text-secondary: #cbd5e1;
  --border-color: #334155;
  --sidebar-bg: #1e293b;
  --editor-bg: #1e293b;
  --preview-bg: #1e293b;
  --code-bg: #0f172a;
  --code-text: #e2e8f0;
  --scrollbar-thumb: #475569;
  --scrollbar-thumb-hover: #64748b;
}
```

### 主题切换逻辑
```typescript
// App.tsx
const [theme, setTheme] = useState<'light' | 'dark'>(() => {
  // 从localStorage获取主题，默认使用系统主题
  const saved = localStorage.getItem('streamnotes_theme');
  if (saved) return saved as 'light' | 'dark';
  // 检测系统主题
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
});

const toggleTheme = () => {
  setTheme(prev => prev === 'light' ? 'dark' : 'light');
};

// 持久化主题到localStorage
useEffect(() => {
  localStorage.setItem('streamnotes_theme', theme);
  // 更新根元素的data-theme属性
  document.documentElement.setAttribute('data-theme', theme);
}, [theme]);
```

## 预期效果
- 用户可以通过侧边栏的按钮切换主题
- 主题状态会持久化到localStorage
- 支持系统主题检测
- 整个应用的UI会根据当前主题自动调整
- 编辑器和Markdown渲染也会支持主题切换

## 后续优化
- 添加更多主题选项（如 sepia 主题）
- 支持自定义主题颜色
- 添加主题切换动画

## 实施时间
预计需要1-2小时完成所有修改和测试。