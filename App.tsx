import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import ToastContainer from './components/ToastContainer';
import { FileSystemItem } from './types';
import { initialData, generateId, deleteItemRecursive, scanLocalDirectory, verifyPermission } from './utils/fsHelpers';
import { Menu, Loader2, Info, Moon, Sun } from 'lucide-react';
import { Toast as ToastType } from './components/Toast';

const STORAGE_KEY = 'streamnotes_fs_data';

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<any>;
    html2canvas?: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;
  }
}

export default function App() {
  const [fileSystem, setFileSystem] = useState<FileSystemItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Load theme from localStorage or use system preference
    const saved = localStorage.getItem('streamnotes_theme');
    if (saved) return saved as 'light' | 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  
  // Cache for loaded image URLs (blob:...) for the current folder
  const [assets, setAssets] = useState<Record<string, string>>({});
  
  // Toast notifications state
  const [toasts, setToasts] = useState<ToastType[]>([]);
  
  // Show a toast notification
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration: number = 3000) => {
    const id = generateId();
    const newToast: ToastType = {
      id,
      message,
      type,
      duration
    };
    setToasts(prev => [...prev, newToast]);
  };
  
  // Close a toast notification
  const closeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Keep track of the root handle to enable operations at the root level
  const rootDirHandleRef = useRef<any>(null);

  // Load from LocalStorage on mount (Default Memory Mode)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        if (Array.isArray(parsed)) {
            setFileSystem(parsed);
        } else if (parsed.fileSystem) {
            setFileSystem(parsed.fileSystem || initialData);
            if (parsed.activeFileId) {
                const exists = parsed.fileSystem.some((i: any) => i.id === parsed.activeFileId);
                if (exists) setActiveFileId(parsed.activeFileId);
            }
            if (parsed.sidebarOpen !== undefined) setSidebarOpen(parsed.sidebarOpen);
        } else {
            setFileSystem(initialData);
        }
      } catch (e) {
        console.error("Failed to parse saved filesystem", e);
        setFileSystem(initialData);
      }
    } else {
      setFileSystem(initialData);
    }
    setIsLoaded(true);
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    if (isLoaded && !isLocalMode) {
      const stateToSave = {
          fileSystem,
          activeFileId,
          sidebarOpen
      };
      // Note: Storing large base64 images in localStorage might hit quota limits.
      // In a production app, we would use IndexedDB.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      } catch (e) {
        console.error("LocalStorage Save Failed (likely quota exceeded)", e);
      }
    }
  }, [fileSystem, activeFileId, sidebarOpen, isLoaded, isLocalMode]);

  // Theme Management
  useEffect(() => {
    // Persist theme to localStorage
    localStorage.setItem('streamnotes_theme', theme);
    // Apply theme to DOM
    document.documentElement.setAttribute('data-theme', theme);
    // Apply theme to body
    document.body.style.backgroundColor = `var(--bg-primary)`;
    document.body.style.color = `var(--text-primary)`;
  }, [theme]);

  // Toggle Theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // --- ASSET MANAGEMENT ---
  
  // Load assets (images) for the current active folder so they can be previewed
  useEffect(() => {
    const loadAssets = async () => {
        if (!activeFileId) return;
        const activeItem = fileSystem.find(i => i.id === activeFileId);
        if (!activeItem) return;

        // Determine parent ID (context for relative paths)
        const parentId = activeItem.parentId;
        
        // Find all "sibling" files that look like images
        const siblings = fileSystem.filter(i => i.parentId === parentId && i.type === 'file');
        const imageItems = siblings.filter(i => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(i.name));

        const newAssets: Record<string, string> = {};

        for (const item of imageItems) {
            // Check if we already have this asset loaded to avoid flickering/re-reading?
            // For simplicity, we reload. React handles DOM diffing.
            
            if (isLocalMode && item.handle) {
                 try {
                     const file = await item.handle.getFile();
                     newAssets[item.name] = URL.createObjectURL(file);
                 } catch(e) { 
                     console.error(`Failed to load asset ${item.name}`, e); 
                 }
            } else if (!isLocalMode && item.content) {
                 // Memory mode: content should be a Data URL (base64)
                 if (item.content.startsWith('data:')) {
                     newAssets[item.name] = item.content;
                 }
            }
        }
        
        // Only update if changed (simple check)
        setAssets(prev => {
            const prevKeys = Object.keys(prev).sort().join(',');
            const newKeys = Object.keys(newAssets).sort().join(',');
            if (prevKeys === newKeys && Object.keys(newAssets).length === Object.keys(prev).length) {
                // Should also check values, but for Blob URLs they change every time.
                // We'll just update to ensure freshness.
                return newAssets;
            }
            return newAssets;
        });
    };

    // Debounce slightly to avoid thrashing on quick file switches
    const timer = setTimeout(loadAssets, 50);
    return () => clearTimeout(timer);
  }, [activeFileId, fileSystem, isLocalMode]); // Re-run when file system changes (e.g. upload)


  // Helper function: Validate image file
  const validateImage = (file: File): void => {
    if (!activeFileId) throw new Error("No active file");
    
    const activeItem = fileSystem.find(i => i.id === activeFileId);
    if (!activeItem) throw new Error("File not found");
    
    // Check file type
    if (!/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file.name)) {
      throw new Error("Unsupported file type. Please upload an image file.");
    }
  };

  // Helper function: Generate unique file name
  const generateUniqueFileName = (file: File, parentId: string | null): string => {
    let fileName = file.name;
    let count = 1;
    
    while (fileSystem.some(i => i.parentId === parentId && i.name === fileName)) {
      const dotIndex = file.name.lastIndexOf('.');
      if (dotIndex > 0) {
        const name = file.name.substring(0, dotIndex);
        const ext = file.name.substring(dotIndex);
        fileName = `${name} (${count})${ext}`;
      } else {
        fileName = `${file.name} (${count})`;
      }
      count++;
    }
    
    return fileName;
  };

  // Helper function: Save image to disk (local mode)
  const saveImageToDisk = async (fileName: string, file: File, parentId: string | null): Promise<any> => {
    let parentHandle = null;
    if (parentId) {
      const parentItem = fileSystem.find(i => i.id === parentId);
      parentHandle = parentItem?.handle;
    } else {
      parentHandle = rootDirHandleRef.current;
    }

    if (!parentHandle) throw new Error("No permission to write to folder");

    // Create file
    const newFileHandle = await parentHandle.getFileHandle(fileName, { create: true });
    const writable = await newFileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    
    return newFileHandle;
  };

  // Helper function: Save image to memory (browser mode)
  const saveImageToMemory = (file: File): Promise<string> => {
    // Warning: LocalStorage quota is small (5MB).
    if (file.size > 1024 * 1024) {
      const confirm = window.confirm("文件较大 (>1MB)，可能会导致浏览器缓存已满。建议使用“本地模式”或压缩图片。是否继续？");
      if (!confirm) throw new Error("Cancelled by user");
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Helper function: Create file system item
  const createFileSystemItem = (fileName: string, parentId: string | null, handle: any = null, content?: string): FileSystemItem => {
    return {
      id: generateId(),
      parentId,
      name: fileName,
      type: 'file',
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      handle,
      isLoaded: true
    };
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    validateImage(file);
    
    const activeItem = fileSystem.find(i => i.id === activeFileId);
    const parentId = activeItem?.parentId;
    const fileName = generateUniqueFileName(file, parentId);

    if (isLocalMode) {
      // --- Local Mode: Write to Disk ---
      const newFileHandle = await saveImageToDisk(fileName, file, parentId);
      const newItem = createFileSystemItem(fileName, parentId, newFileHandle);
      setFileSystem(prev => [...prev, newItem]);
    } else {
      // --- Memory Mode: Store as Base64 in content ---
      const base64 = await saveImageToMemory(file);
      const newItem = createFileSystemItem(fileName, parentId, undefined, base64);
      setFileSystem(prev => [...prev, newItem]);
    }

    return fileName;
  };

  // Helper function: Show confirmation dialog
  const confirmCleanup = (): boolean => {
    return window.confirm(
      "确定要清理未引用的图片吗？\n程序将扫描当前文件结构，删除所有未被 Markdown 文件引用的图片。此操作不可撤销。"
    );
  };

  // Helper function: Get combined content of all markdown files in a folder
  const getMarkdownFilesContent = async (mdFiles: FileSystemItem[]): Promise<string> => {
    let combinedContent = "";
    
    for (const md of mdFiles) {
      let content = md.content || "";
      
      // In local mode, ensure we have the latest content
      if (isLocalMode && md.handle && !md.isLoaded) {
        try {
          const f = await md.handle.getFile();
          content = await f.text();
        } catch (e) {
          console.error(`无法读取文件 ${md.name} 进行扫描，跳过该文件`, e);
          continue;
        }
      }
      
      combinedContent += content + "\n";
    }
    
    return combinedContent;
  };

  // Helper function: Check if an image is referenced in the content
  const isImageReferenced = (imgName: string, content: string): boolean => {
    const escapedName = imgName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedName, 'g');
    return regex.test(content);
  };

  // Helper function: Scan a folder for orphaned images
  const scanFolderForOrphanedImages = async (folderId: string | null, allFiles: FileSystemItem[]): Promise<FileSystemItem[]> => {
    const siblings = allFiles.filter(i => i.parentId === folderId);
    const mdFiles = siblings.filter(i => i.name.toLowerCase().endsWith('.md'));
    const imgFiles = siblings.filter(i => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(i.name));

    if (imgFiles.length === 0) return [];

    const combinedContent = await getMarkdownFilesContent(mdFiles);
    const orphanedImages: FileSystemItem[] = [];

    for (const img of imgFiles) {
      if (!isImageReferenced(img.name, combinedContent)) {
        orphanedImages.push(img);
      }
    }

    return orphanedImages;
  };

  // Helper function: Delete orphaned images
  const deleteOrphanedImages = async (orphanedImages: FileSystemItem[]): Promise<number> => {
    let deletedCount = 0;
    for (const item of orphanedImages) {
      await handleDeleteItem(item.id, true); // true = skip confirm
      deletedCount++;
    }
    return deletedCount;
  };

  // Helper function: Show cleanup result
  const showCleanupResult = (deletedCount: number): void => {
    if (deletedCount === 0) {
      showToast("未发现孤立图片。", "info");
    } else {
      showToast(`清理完成！已删除 ${deletedCount} 个未引用图片。`, "success");
    }
  };

  // Main cleanup function
  const handleCleanupAssets = async () => {
    if (!confirmCleanup()) {
      return;
    }

    const allFiles = [...fileSystem];
    const folders = new Set(allFiles.map(i => i.parentId));
    folders.add(null);

    let allOrphanedImages: FileSystemItem[] = [];

    // Scan all folders for orphaned images
    for (const folderId of folders) {
      const orphanedImages = await scanFolderForOrphanedImages(folderId, allFiles);
      allOrphanedImages = [...allOrphanedImages, ...orphanedImages];
    }

    const deletedCount = await deleteOrphanedImages(allOrphanedImages);
    showCleanupResult(deletedCount);
  };

  // --- EXISTING HANDLERS ---

  // Helper function: Check browser support for File System Access API
  const checkBrowserSupport = (): boolean => {
    if (!window.showDirectoryPicker) {
      showToast("您的浏览器不支持文件系统访问 API。请使用 Chrome 或 Edge 浏览器。", "warning");
      return false;
    }
    return true;
  };

  // Helper function: Request directory access from user
  const requestDirectoryAccess = async (): Promise<any> => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      return dirHandle;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // User cancelled the operation, no need to show alert
        throw error;
      }
      throw new Error("无法打开文件夹: " + (error.message || "未知错误"));
    }
  };

  // Helper function: Load directory content
  const loadDirectoryContent = async (dirHandle: any): Promise<FileSystemItem[]> => {
    setIsLoaded(false);
    const items = await scanLocalDirectory(dirHandle);
    return items;
  };

  // Helper function: Update application state after loading directory
  const updateAppState = (items: FileSystemItem[], dirHandle: any): void => {
    rootDirHandleRef.current = dirHandle;
    setFileSystem(items);
    setIsLocalMode(true);
    setActiveFileId(null);
    setIsLoaded(true);
    setSidebarOpen(true);
  };

  // Helper function: Switch back to browser storage mode
  const switchToBrowserMode = () => {
    // Reset app state
    rootDirHandleRef.current = null;
    setIsLocalMode(false);
    setActiveFileId(null);
    
    // Load data from localStorage if available
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFileSystem(parsed);
        } else if (parsed.fileSystem) {
          setFileSystem(parsed.fileSystem || initialData);
        } else {
          setFileSystem(initialData);
        }
      } catch (e) {
        console.error("Failed to parse saved filesystem", e);
        setFileSystem(initialData);
      }
    } else {
      setFileSystem(initialData);
    }
    
    showToast("已切换到浏览器存储模式", "success");
  };

  const handleOpenLocalFolder = async () => {
    try {
      if (!checkBrowserSupport()) {
        return;
      }
      
      const dirHandle = await requestDirectoryAccess();
      const items = await loadDirectoryContent(dirHandle);
      updateAppState(items, dirHandle);
    } catch (error: any) {
      console.error("Error opening directory:", error);
      setIsLoaded(true);
      if (error.name !== 'AbortError') {
        showToast(error.message, "error");
      }
    }
  };

  const handleCreateItem = async (type: 'file' | 'folder', parentId: string | null) => {
    let newHandle: any = undefined;
    if (isLocalMode) {
      try {
        let parentHandle: any = null;
        if (parentId) {
            const parentItem = fileSystem.find(i => i.id === parentId);
            parentHandle = parentItem?.handle;
        } else {
            parentHandle = rootDirHandleRef.current;
        }
        if (!parentHandle) { alert("无法获取目标文件夹的权限。"); return; }

        let name = type === 'file' ? 'NewNote.md' : 'NewFolder';
        let count = 1;
        while (fileSystem.some(i => i.parentId === parentId && i.name === name)) {
            name = type === 'file' ? `NewNote (${count}).md` : `NewFolder (${count})`;
            count++;
        }

        if (type === 'file') {
            newHandle = await parentHandle.getFileHandle(name, { create: true });
        } else {
            newHandle = await parentHandle.getDirectoryHandle(name, { create: true });
        }
      } catch (err) {
        console.error("Failed to create file on disk", err);
        return;
      }
    }

    const baseName = type === 'file' ? '新建笔记' : '新建文件夹';
    let name = newHandle ? newHandle.name : baseName;

    if (!isLocalMode) {
        let count = 1;
        while (fileSystem.some(i => i.parentId === parentId && i.name === name)) {
            name = `${baseName} (${count})`;
            count++;
        }
    }

    const newItem: FileSystemItem = {
      id: generateId(),
      parentId,
      name,
      type,
      content: type === 'file' ? '' : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isOpen: true,
      handle: newHandle,
      isLoaded: true
    };

    setFileSystem(prev => [...prev, newItem]);
    
    if (type === 'file') {
        setActiveFileId(newItem.id);
        if (parentId) {
            setFileSystem(prev => prev.map(item => 
                item.id === parentId ? { ...item, isOpen: true } : item
            ));
        }
    }
  };

  const handleRenameItem = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    const item = fileSystem.find(i => i.id === id);
    if (!item || item.name === newName) return;

    const hasDuplicate = fileSystem.some(i => 
      i.parentId === item.parentId && i.id !== id && i.name.toLowerCase() === newName.trim().toLowerCase()
    );
    if (hasDuplicate) {
      showToast("重命名失败：该目录下已存在同名文件或文件夹。", "error");
      return;
    }

    let newHandle: any = null;
    if (isLocalMode && item.handle) {
      try {
        if (typeof item.handle.move === 'function') {
           await item.handle.move(newName);
        } else {
           let parentHandle: any = null;
           if (item.parentId) {
               const parentItem = fileSystem.find(p => p.id === item.parentId);
               parentHandle = parentItem?.handle;
           } else {
               parentHandle = rootDirHandleRef.current;
           }
           if (!parentHandle) { alert("无法访问父级目录权限。"); return; }
           
           if (item.type === 'folder') {
               // Try to use move method if available
               try {
                   // Check if parentHandle has getDirectoryHandle method
                   if (typeof parentHandle.getDirectoryHandle === 'function') {
                // Create a new directory with the new name
                const newDirHandle = await parentHandle.getDirectoryHandle(newName, { create: true });
                
                // Move all children from old folder to new folder
                for await (const [childName, childHandle] of item.handle.entries()) {
                    await childHandle.move(newDirHandle, childName);
                }
                
                // Delete the old folder
                await parentHandle.removeEntry(item.name, { recursive: false });
                
                newHandle = newDirHandle;
            } else {
                showToast("当前浏览器不支持文件夹重命名操作。", "warning");
                return;
            }
               } catch (err) {
                   console.error("Folder rename failed:", err);
                   showToast("文件夹重命名失败：" + (err as Error).message, "error");
                   return;
               }
           } else {
               // File Copy-Delete Strategy
               let content = item.content;
               if (!item.isLoaded) {
                 const fileData = await item.handle.getFile();
                 content = await fileData.text();
               }
               newHandle = await parentHandle.getFileHandle(newName, { create: true });
               const writable = await newHandle.createWritable();
               await writable.write(content || '');
               await writable.close();
               await parentHandle.removeEntry(item.name);
           }
        }
      } catch (err) {
        console.error("Rename failed", err);
        return;
      }
    }

    setFileSystem(prev => prev.map(i => i.id === id ? { ...i, name: newName, updatedAt: Date.now(), handle: newHandle || i.handle } : i));
  };

  const handleDeleteItem = async (id: string, skipConfirm = false) => {
    if (!skipConfirm && !window.confirm('您确定要删除此项吗？')) {
        return;
    }
    
    const itemToDelete = fileSystem.find(i => i.id === id);
    if (isLocalMode && itemToDelete?.handle) {
        try {
            let parentHandle: any = null;
            if (itemToDelete.parentId) {
                const parentItem = fileSystem.find(p => p.id === itemToDelete.parentId);
                parentHandle = parentItem?.handle;
            } else {
                parentHandle = rootDirHandleRef.current;
            }
            if (parentHandle) await parentHandle.removeEntry(itemToDelete.name, { recursive: true });
        } catch(e) {
            console.error("Failed to delete from disk", e);
            return;
        }
    }
    const newFs = deleteItemRecursive(fileSystem, id);
    setFileSystem(newFs);
    if (activeFileId === id) setActiveFileId(null);
  };

  const handleToggleFolder = (id: string) => {
    setFileSystem(prev => prev.map(item => item.id === id ? { ...item, isOpen: !item.isOpen } : item));
  };

  const handleFileSelect = async (id: string) => {
    setActiveFileId(id);
    const file = fileSystem.find(i => i.id === id);
    if (file && isLocalMode && !file.isLoaded && file.handle) {
      // Only read text files into content
      if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file.name)) {
          // Do not read binary images into 'content' string
          return;
      }

      setIsLoadingFile(true);
      try {
        const fileData = await file.handle.getFile();
        const text = await fileData.text();
        setFileSystem(prev => prev.map(i => i.id === id ? { ...i, content: text, isLoaded: true } : i));
      } catch (error) {
        console.error("Failed to read local file:", error);
      } finally {
        setIsLoadingFile(false);
      }
    }
  };

  const handleUpdateFile = async (content: string) => {
    setFileSystem(prev => prev.map(item => item.id === activeFileId ? { ...item, content, updatedAt: Date.now() } : item));
    if (isLocalMode && activeFileId) {
       const file = fileSystem.find(i => i.id === activeFileId);
       if (file && file.handle) {
          try {
             const writable = await file.handle.createWritable();
             await writable.write(content);
             await writable.close();
          } catch (e) { console.error("Write failed", e); }
       }
    }
  };

  const activeFile = fileSystem.find(item => item.id === activeFileId);

  if (!isLoaded) {
    return <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)] text-[var(--text-tertiary)] gap-2"><Loader2 className="animate-spin" /> 加载中...</div>;
  }

  return (
    <div className="flex h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans overflow-hidden print:h-auto print:overflow-visible">
      <div className={`fixed inset-y-0 left-0 z-20 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 print:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar 
          items={fileSystem}
          activeFileId={activeFileId}
          onFileSelect={handleFileSelect}
          onToggleFolder={handleToggleFolder}
          onCreateItem={handleCreateItem}
          onDeleteItem={(id) => handleDeleteItem(id)}
          onRenameItem={handleRenameItem}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenLocalFolder={handleOpenLocalFolder}
          onSwitchToBrowserMode={switchToBrowserMode}
          onCleanupAssets={handleCleanupAssets}
          isLocalMode={isLocalMode}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </div>
      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-10 md:hidden print:hidden" onClick={() => setSidebarOpen(false)}></div>}
      
      <div className="flex-1 flex flex-col h-full min-w-0 print:h-auto print:overflow-visible">
        <div className="md:hidden flex items-center p-3 border-b border-[var(--border-color)] bg-[var(--bg-primary)] print:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-1 mr-2 text-[var(--text-primary)]"><Menu size={20} /></button>
          <span className="font-semibold text-[var(--text-primary)]">StreamNotes</span>
        </div>

        {activeFile ? (
          isLoadingFile ? (
            <div className="flex-1 flex items-center justify-center text-[var(--text-tertiary)] gap-2"><Loader2 className="animate-spin" /> 读取文件...</div>
          ) : (
            <Editor 
              key={activeFile.id}
              fileName={activeFile.name}
              content={activeFile.content || ''}
              onUpdate={handleUpdateFile}
              onUploadImage={handleImageUpload}
              assets={assets}
              theme={theme}
              onShowToast={showToast}
            />
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-tertiary)] p-8 bg-[var(--bg-secondary)] print:hidden">
            <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mb-4">
              <Info size={32} className="text-[var(--text-tertiary)]" />
            </div>
            <p className="text-lg font-medium text-[var(--text-primary)]">没有选择笔记</p>
            <p className="text-sm mt-2 max-w-xs text-center">在侧边栏选择一个文件，或者创建一个新笔记开始写作。</p>
            {!isLocalMode && (
              <button onClick={handleOpenLocalFolder} className="mt-6 px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-primary-300 hover:text-primary-600 text-[var(--text-primary)] text-sm font-medium rounded-md transition-all">打开本地文件夹</button>
            )}
          </div>
        )}
      </div>
      
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </div>
  );
}