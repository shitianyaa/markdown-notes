import { FileSystemItem } from '../types';

export const generateId = (): string => Math.random().toString(36).substring(2, 9);

export const sortFileSystem = (items: FileSystemItem[]): FileSystemItem[] => {
  return [...items].sort((a, b) => {
    // Folders first
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    // Then alphabetical
    return a.name.localeCompare(b.name);
  });
};

export const getChildItems = (items: FileSystemItem[], parentId: string | null): FileSystemItem[] => {
  return sortFileSystem(items.filter((item) => item.parentId === parentId));
};

export const deleteItemRecursive = (items: FileSystemItem[], itemId: string): FileSystemItem[] => {
  const item = items.find((i) => i.id === itemId);
  if (!item) return items;

  let newItems = items.filter((i) => i.id !== itemId);

  // If folder, delete children recursively
  if (item.type === 'folder') {
    const children = items.filter((i) => i.parentId === itemId);
    children.forEach((child) => {
      newItems = deleteItemRecursive(newItems, child.id);
    });
  }

  return newItems;
};

// --- Local File System Access API Helpers ---

// Verify permissions for a handle
export async function verifyPermission(fileHandle: any, readWrite: boolean) {
  const options = { mode: readWrite ? 'readwrite' : 'read' };
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
}

// Recursively copy directory content
export async function copyDirectory(sourceHandle: any, destHandle: any) {
  for await (const entry of sourceHandle.values()) {
    if (entry.kind === 'file') {
      const sourceFile = await entry.getFile();
      const destFileHandle = await destHandle.getFileHandle(entry.name, { create: true });
      const writable = await destFileHandle.createWritable();
      await writable.write(sourceFile);
      await writable.close();
    } else if (entry.kind === 'directory') {
      const newDirHandle = await destHandle.getDirectoryHandle(entry.name, { create: true });
      await copyDirectory(entry, newDirHandle);
    }
  }
}

// Recursively scan a directory handle and build our internal FileSystemItem tree
export async function scanLocalDirectory(
  dirHandle: any, 
  parentId: string | null = null
): Promise<FileSystemItem[]> {
  const items: FileSystemItem[] = [];

  for await (const entry of dirHandle.values()) {
    // Skip hidden files/folders (starting with dot)
    if (entry.name.startsWith('.')) continue;

    const id = generateId(); // We generate a temporary ID for the UI
    const isFolder = entry.kind === 'directory';

    const item: FileSystemItem = {
      id,
      parentId,
      name: entry.name,
      type: isFolder ? 'folder' : 'file',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      handle: entry,
      isOpen: false,
      isLoaded: false, // Content not loaded yet
    };

    items.push(item);

    if (isFolder) {
      const children = await scanLocalDirectory(entry, id);
      items.push(...children);
    }
  }

  return items;
}

// Initial Demo Data
export const initialData: FileSystemItem[] = [
  { id: 'root-folder-1', parentId: null, name: '个人生活', type: 'folder', createdAt: Date.now(), updatedAt: Date.now(), isOpen: true, isLoaded: true },
  { id: 'root-folder-2', parentId: null, name: '工作', type: 'folder', createdAt: Date.now(), updatedAt: Date.now(), isOpen: false, isLoaded: true },
  { id: 'note-1', parentId: 'root-folder-1', name: '想法.md', type: 'file', content: '# 我的绝妙点子\n\n- [ ] 写一个 React 应用\n- [ ] 学习 Tailwind CSS\n- [ ] 使用 Gemini API', createdAt: Date.now(), updatedAt: Date.now(), isLoaded: true },
  { id: 'note-2', parentId: 'root-folder-1', name: '日记.md', type: 'file', content: '# 每日日记\n\n今天是个好日子。我写了一些代码。', createdAt: Date.now(), updatedAt: Date.now(), isLoaded: true },
  { id: 'note-3', parentId: 'root-folder-2', name: '会议纪要.md', type: 'file', content: '## Q3 计划\n\n**参会者:** Alice, Bob, Charlie\n\n### 待办事项\n1. 审查指标\n2. 更新路线图', createdAt: Date.now(), updatedAt: Date.now(), isLoaded: true },
  { 
    id: 'note-welcome', 
    parentId: null, 
    name: '使用说明.md', 
    type: 'file', 
    createdAt: Date.now(), 
    updatedAt: Date.now(), 
    isLoaded: true,
    content: `# 👋 欢迎使用 StreamNotes

StreamNotes 是一个**本地优先**且功能强大的 Markdown 笔记应用。您的数据完全由您掌控。

以下是详细的功能指南。

## 🖥️ 界面与按钮说明

### 1. 侧边栏 (左侧)

这里是您的文件指挥中心。

*   **📂 打开本地文件夹**: 点击顶部的按钮，可以直接挂载电脑上的真实文件夹。
    *   *优势*: 您可以使用 VS Code 或 Obsidian 同时编辑这些文件。
*   **📄 新建笔记**: 在根目录创建一个新的 \`.md\` 文件。
*   **📁 新建文件夹**: 在根目录创建一个新文件夹。
*   **🧹 清理资源 (扫帚图标)**: **核心功能！**
    *   点击后，程序会扫描当前所有文件夹，自动删除那些**没有在任何 Markdown 笔记中被引用**的图片文件。
    *   *用途*: 防止删除笔记中的图片引用后，图片文件依然残留在硬盘中占用空间。
*   **🔍 搜索**: 实时过滤文件名和文件内容。

> **小技巧**: 悬停在文件或文件夹上，会出现重命名 (✏️) 和删除 (🗑️) 按钮。侧边栏默认隐藏非 \`.md\` 文件（如图片），以保持界面整洁。

---

### 2. 顶部工具栏 (右侧)

控制您的写作视图。

*   **🔗 同步 (同步滚动)**:
    *   *开启状态*: 滚动左侧编辑区，右侧预览区会智能跟随（反之亦然）。
    *   *关闭状态*: 两侧独立滚动。
*   **✏️ (编辑模式)**: 仅显示编辑器，适合专注码字。
*   **⚖️ (分栏模式)**: 标准的 Markdown 写作模式，左写右看。
*   **👀 (阅读模式)**: 仅显示渲染后的文档，适合查阅。
*   **💾 (保存状态)**: 自动保存。绿色勾号表示内容已安全写入。

---

### 3. 格式工具栏 (编辑器上方)

快速插入 Markdown 语法。

| 图标 | 功能 | 快捷键 | 说明 |
| :--- | :--- | :--- | :--- |
| **H1/H2** | 标题 | - | 插入一级或二级标题 |
| **B** | **加粗** | \`Ctrl+B\` | 强调文本 |
| **I** | *斜体* | \`Ctrl+I\` | 倾斜文本 |
| **~~** | ~~删除线~~ | - | 表示废弃的内容 |
| **🖊️** | <mark>高亮</mark> | - | 像荧光笔一样标记重点 |
| **列表** | 无序/有序 | - | 插入列表项 |
| **{ }** | 代码块 | - | 插入多行代码区域 |
| **"** | 引用 | - | 插入引用块 |
| **🔗** | 链接 | \`Ctrl+K\` | 插入超链接 |
| **🖼️** | **图片上传** | - | **点击选择本地图片**。图片会自动保存到当前文件夹，并以相对路径引用。 |
| **—** | 分割线 | - | 插入水平分割线 |

---

## 🖼️ 图片管理机制

StreamNotes 采用**资源同级存储**策略：

1.  **上传**: 点击工具栏图片按钮，选择图片 (PNG, JPG, GIF 等)。
2.  **存储**: 图片会被保存为独立文件（如 \`image.png\`），存放在笔记同级目录下。侧边栏会自动隐藏这些图片文件。
3.  **引用**: 笔记中会插入 \`![图片名](image.png)\`。
4.  **清理**: 如果您在笔记中删除了 \`![...]\` 引用，图片文件仍会存在。点击侧边栏顶部的 **🧹 扫帚图标** 可一键清除这些“孤儿”文件。

## ⌨️ 常用快捷键

*   \`Ctrl + S\`: 立即保存
*   \`Ctrl + B\`: 加粗
*   \`Ctrl + I\`: 斜体
*   \`Ctrl + K\`: 插入链接
*   \`Tab\`: 缩进 (2个空格)

---

祝您写作愉快！` 
  },
];