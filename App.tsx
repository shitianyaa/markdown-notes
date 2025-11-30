import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import { FileSystemItem } from './types';
import { initialData, generateId, deleteItemRecursive, scanLocalDirectory, verifyPermission, copyDirectory } from './utils/fsHelpers';
import { Menu, Loader2, Info } from 'lucide-react';

const STORAGE_KEY = 'streamnotes_fs_data';

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<any>;
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
  
  // Cache for loaded image URLs (blob:...) for the current folder
  const [assets, setAssets] = useState<Record<string, string>>({});

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


  const handleImageUpload = async (file: File): Promise<string> => {
    if (!activeFileId) throw new Error("No active file");
    
    const activeItem = fileSystem.find(i => i.id === activeFileId);
    if (!activeItem) throw new Error("File not found");
    
    const parentId = activeItem.parentId;
    let fileName = file.name;
    
    // Simple renaming if file exists: image.png -> image (1).png
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

    if (isLocalMode) {
        // --- Local Mode: Write to Disk ---
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

        // Update File System State
        const newItem: FileSystemItem = {
            id: generateId(),
            parentId,
            name: fileName,
            type: 'file',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            handle: newFileHandle,
            isLoaded: true // Binary content on disk
        };
        setFileSystem(prev => [...prev, newItem]);
        
    } else {
        // --- Memory Mode: Store as Base64 in content ---
        // Warning: LocalStorage quota is small (5MB). 
        if (file.size > 1024 * 1024) {
            const confirm = window.confirm("文件较大 (>1MB)，可能会导致浏览器缓存已满。建议使用“本地模式”或压缩图片。是否继续？");
            if (!confirm) throw new Error("Cancelled by user");
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result as string;
                
                const newItem: FileSystemItem = {
                    id: generateId(),
                    parentId,
                    name: fileName,
                    type: 'file',
                    content: base64, // Store data directly in content
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    isLoaded: true
                };
                
                setFileSystem(prev => [...prev, newItem]);
                resolve(fileName);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    return fileName;
  };

  const handleCleanupAssets = async () => {
    if (!window.confirm("确定要清理未引用的图片吗？\n程序将扫描当前文件结构，删除所有未被 Markdown 文件引用的图片。此操作不可撤销。")) {
        return;
    }

    const itemsToDelete: FileSystemItem[] = [];
    const allFiles = [...fileSystem];
    
    // Group files by parentId (folder) to respect relative paths context
    const folders = new Set(allFiles.map(i => i.parentId));
    folders.add(null);

    // This operation might be slow on local FS with many files, show loading state ideally
    // But for now we block.
    
    for (const folderId of folders) {
        const siblings = allFiles.filter(i => i.parentId === folderId);
        const mdFiles = siblings.filter(i => i.name.toLowerCase().endsWith('.md'));
        const imgFiles = siblings.filter(i => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(i.name));

        if (imgFiles.length === 0) continue;

        let combinedContent = "";
        
        // Aggregate all markdown content in this folder
        for (const md of mdFiles) {
            let content = md.content || "";
            // In local mode, if content isn't loaded in memory, we might miss references.
            // Ideally we should read the file. 
            // For safety, if local mode file is NOT loaded, we will force read it to ensure we don't accidentally delete used images.
            if (isLocalMode && md.handle && !md.isLoaded) {
                 try {
                     const f = await md.handle.getFile();
                     content = await f.text();
                 } catch (e) {
                     console.error(`无法读取文件 ${md.name} 进行扫描，跳过该文件夹清理`, e);
                     continue; // Skip scanning this folder to be safe
                 }
            }
            combinedContent += content + "\n";
        }

        // Check if images are referenced in the combined content
        for (const img of imgFiles) {
             // Escape special chars for regex
             const escapedName = img.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
             // Look for standard markdown syntax or html img tags that reference this filename
             // Note: This is a loose check. It assumes unique filenames per folder (which FS enforces).
             const regex = new RegExp(escapedName, 'g');
             
             if (!regex.test(combinedContent)) {
                 itemsToDelete.push(img);
             }
        }
    }

    if (itemsToDelete.length === 0) {
        alert("未发现孤立图片。");
        return;
    }

    let deletedCount = 0;
    for (const item of itemsToDelete) {
        await handleDeleteItem(item.id, true); // true = skip confirm
        deletedCount++;
    }
    
    alert(`清理完成！已删除 ${deletedCount} 个未引用图片。`);
  };

  // --- EXISTING HANDLERS ---

  const handleOpenLocalFolder = async () => {
    try {
      if (!window.showDirectoryPicker) {
        alert("您的浏览器不支持文件系统访问 API。请使用 Chrome 或 Edge 浏览器。");
        return;
      }
      
      const dirHandle = await window.showDirectoryPicker();
      rootDirHandleRef.current = dirHandle;

      setIsLoaded(false);
      const items = await scanLocalDirectory(dirHandle);
      
      setFileSystem(items);
      setIsLocalMode(true);
      setActiveFileId(null);
      setIsLoaded(true);
      setSidebarOpen(true);
    } catch (error: any) {
      console.error("Error opening directory:", error);
      setIsLoaded(true);
      if (error.name !== 'AbortError') {
        alert("无法打开文件夹: " + (error.message || "未知错误"));
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
      alert("重命名失败：该目录下已存在同名文件或文件夹。");
      return;
    }

    let newHandle: any = null;
    let performFullRescan = false;

    if (isLocalMode && item.handle) {
      try {
        // 1. Try native move() first (Chrome 110+)
        if (typeof item.handle.move === 'function') {
           await item.handle.move(newName);
        } 
        else {
           // 2. Fallback: Copy & Delete
           let parentHandle: any = null;
           if (item.parentId) {
               const parentItem = fileSystem.find(p => p.id === item.parentId);
               parentHandle = parentItem?.handle;
           } else {
               parentHandle = rootDirHandleRef.current;
           }
           if (!parentHandle) { alert("无法访问父级目录权限。"); return; }
           
           if (item.type === 'folder') {
               // Recursive Copy for Folders
               const newDirHandle = await parentHandle.getDirectoryHandle(newName, { create: true });
               await copyDirectory(item.handle, newDirHandle);
               await parentHandle.removeEntry(item.name, { recursive: true });
               
               // For folders, invalidating handles is tricky. It's safer to rescan.
               performFullRescan = true;
           } else {
               // File Copy
               // Read file content as Blob to support binary files (like images)
               const fileData = await item.handle.getFile();
               
               newHandle = await parentHandle.getFileHandle(newName, { create: true });
               const writable = await newHandle.createWritable();
               await writable.write(fileData);
               await writable.close();
               
               await parentHandle.removeEntry(item.name);
           }
        }
      } catch (err) {
        console.error("Rename failed", err);
        alert("重命名操作失败 (可能是权限不足或文件被占用)");
        return;
      }
    }

    if (performFullRescan && isLocalMode) {
         // Rescan to ensure all children have valid handles
         const newItems = await scanLocalDirectory(rootDirHandleRef.current);
         // Restore open folders state (best effort by name match)
         const openFolderNames = new Set(fileSystem.filter(i => i.isOpen).map(i => i.name));
         if (item.isOpen) openFolderNames.add(newName); 

         // Try to preserve active file selection if it wasn't destroyed
         const activeItem = fileSystem.find(i => i.id === activeFileId);
         let newActiveId = null;
         if (activeItem) {
             const match = newItems.find(i => i.name === activeItem.name && i.type === activeItem.type);
             if (match) newActiveId = match.id;
         }

         setFileSystem(newItems.map(i => ({
             ...i,
             isOpen: i.type === 'folder' && openFolderNames.has(i.name)
         })));
         
         if (newActiveId) setActiveFileId(newActiveId);

    } else {
        // Simple state update
        setFileSystem(prev => prev.map(i => i.id === id ? { ...i, name: newName, updatedAt: Date.now(), handle: newHandle || i.handle } : i));
    }
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
    return <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-500 gap-2"><Loader2 className="animate-spin" /> 加载中...</div>;
  }

  return (
    <div className="flex h-screen w-full bg-white text-slate-900 font-sans overflow-hidden print:h-auto print:overflow-visible">
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
          onCleanupAssets={handleCleanupAssets}
          isLocalMode={isLocalMode}
        />
      </div>
      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-10 md:hidden print:hidden" onClick={() => setSidebarOpen(false)}></div>}
      
      <div className="flex-1 flex flex-col h-full min-w-0 print:h-auto print:overflow-visible">
        <div className="md:hidden flex items-center p-3 border-b border-slate-200 bg-white print:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-1 mr-2 text-slate-600"><Menu size={20} /></button>
          <span className="font-semibold text-slate-700">StreamNotes</span>
        </div>

        {activeFile ? (
          isLoadingFile ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 gap-2"><Loader2 className="animate-spin" /> 读取文件...</div>
          ) : (
            <Editor 
              key={activeFile.id}
              fileName={activeFile.name}
              content={activeFile.content || ''}
              onUpdate={handleUpdateFile}
              onUploadImage={handleImageUpload}
              assets={assets}
            />
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 bg-slate-50/50 print:hidden">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm"><Info size={32} className="text-slate-300" /></div>
            <p className="text-lg font-medium text-slate-600">没有选择笔记</p>
            <p className="text-sm mt-2 max-w-xs text-center">在侧边栏选择一个文件，或者创建一个新笔记开始写作。</p>
            {!isLocalMode && (
              <button onClick={handleOpenLocalFolder} className="mt-6 px-4 py-2 bg-white border border-slate-200 hover:border-primary-300 hover:text-primary-600 text-slate-600 text-sm font-medium rounded-md shadow-sm transition-all">打开本地文件夹</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}