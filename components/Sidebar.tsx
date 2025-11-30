import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  FilePlus, 
  Trash2, 
  FolderPlus, 
  Search,
  Upload,
  HardDrive,
  Edit2,
  Eraser,
  Moon,
  Sun
} from 'lucide-react';
import { FileSystemItem, SearchResult } from '../types';
import { getChildItems, searchFileSystem } from '../utils/fsHelpers';
import HighlightedText from './HighlightedText';

interface SidebarProps {
  items: FileSystemItem[];
  activeFileId: string | null;
  onFileSelect: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onCreateItem: (type: 'file' | 'folder', parentId: string | null) => void;
  onDeleteItem: (id: string) => void;
  onRenameItem: (id: string, newName: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenLocalFolder: () => void;
  onSwitchToBrowserMode?: () => void;
  onCleanupAssets: () => void;
  isLocalMode: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  items,
  activeFileId,
  onFileSelect,
  onToggleFolder,
  onCreateItem,
  onDeleteItem,
  onRenameItem,
  searchQuery,
  onSearchChange,
  onOpenLocalFolder,
  onSwitchToBrowserMode,
  onCleanupAssets,
  isLocalMode,
  theme,
  onToggleTheme
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && renameInputRef.current) {
      renameInputRef.current.focus();
      
      // Intelligent selection: Select only filename, exclude extension
      const item = items.find(i => i.id === editingId);
      if (item && item.type === 'file' && item.name.lastIndexOf('.') > 0) {
        const dotIndex = item.name.lastIndexOf('.');
        renameInputRef.current.setSelectionRange(0, dotIndex);
      } else {
        renameInputRef.current.select();
      }
    }
  }, [editingId, items]);

  const startRenaming = (e: React.MouseEvent, item: FileSystemItem) => {
    e.stopPropagation();
    setEditingId(item.id);
    setRenameValue(item.name); 
  };

  const cancelRenaming = () => {
    setEditingId(null);
    setRenameValue('');
  };

  const submitRenaming = () => {
    if (editingId && renameValue.trim()) {
      onRenameItem(editingId, renameValue.trim());
      setEditingId(null);
    } else {
      cancelRenaming();
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      submitRenaming();
    } else if (e.key === 'Escape') {
      cancelRenaming();
    }
  };

  // Get search results
  const getSearchResults = (): SearchResult[] => {
    return searchFileSystem(items, searchQuery);
  };

  // Check if a folder should be open based on search results
  const shouldFolderBeOpen = (folderId: string, searchResults: SearchResult[]): boolean => {
    const hasMatchingChildren = searchResults.some(result => {
      const item = result.item;
      return item.parentId === folderId && result.matches;
    });
    return hasMatchingChildren;
  };

  // Recursive Tree Item Renderer
  const renderTreeItem = (item: FileSystemItem, depth: number = 0) => {
    // FILTER: Only show Folders and Markdown files
    const isMarkdownOrFolder = item.type === 'folder' || item.name.toLowerCase().endsWith('.md');
    if (!isMarkdownOrFolder) return null;

    const searchResults = getSearchResults();
    const itemResult = searchResults.find(result => result.item.id === item.id);
    
    // Check if this item matches the search
    const isItemMatch = itemResult?.matches || false;
    
    // Check if children have matches to keep folder open
    const isFolderOpen = searchQuery 
      ? shouldFolderBeOpen(item.id, searchResults) || item.isOpen
      : item.isOpen;

    // Check if this item should be shown
    const shouldShow = !searchQuery || isItemMatch || (item.type === 'folder' && shouldFolderBeOpen(item.id, searchResults));
    
    if (searchQuery && !shouldShow) return null;

    const isEditing = editingId === item.id;

    return (
      <div key={item.id}>
        <div
          className={`
            group flex items-center justify-between py-1 px-2 cursor-pointer select-none text-sm transition-colors border-l-2
            ${item.id === activeFileId 
              ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium border-[#238636]' 
              : isItemMatch 
                ? 'bg-yellow-50 text-[var(--text-primary)] font-medium border-yellow-300' 
                : 'border-transparent text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}
          `}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
             if (!isEditing) {
               item.type === 'folder' ? onToggleFolder(item.id) : onFileSelect(item.id);
             }
          }}
          onMouseEnter={() => setHoveredId(item.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <div className="flex items-center gap-2 truncate flex-1 h-6">
            {item.type === 'folder' && (
              <span className="opacity-70 text-slate-400 flex-shrink-0">
                {isFolderOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            )}
            <span className={`flex-shrink-0 ${item.type === 'folder' ? 'text-amber-400' : 'text-slate-400'}`}>
              {item.type === 'folder' ? (
                isFolderOpen ? <FolderOpen size={16} /> : <Folder size={16} />
              ) : (
                <FileText size={16} />
              )}
            </span>
            
            {isEditing ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={submitRenaming}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 bg-white border border-primary-300 rounded px-1 text-sm focus:outline-none focus:border-primary-500 h-6 font-mono"
              />
            ) : (
              <HighlightedText 
                text={item.name} 
                matches={itemResult?.nameMatches} 
                className="truncate"
              />
            )}
          </div>

          {/* Action Buttons on Hover */}
          {!isEditing && (
            <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${hoveredId === item.id ? 'visible' : 'invisible'}`}>
              {item.type === 'folder' && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onCreateItem('file', item.id); }}
                    className="p-1 hover:bg-white hover:shadow-sm rounded text-slate-500 hover:text-primary-600"
                    title="新建笔记"
                  >
                    <FilePlus size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onCreateItem('folder', item.id); }}
                    className="p-1 hover:bg-white hover:shadow-sm rounded text-slate-500 hover:text-amber-600"
                    title="新建文件夹"
                  >
                    <FolderPlus size={14} />
                  </button>
                </>
              )}
              <button
                onClick={(e) => startRenaming(e, item)}
                className="p-1 hover:bg-[var(--bg-secondary)] rounded text-[var(--text-tertiary)] hover:text-blue-600"
                title="重命名"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
                className="p-1 hover:bg-red-50 hover:text-red-600 rounded text-[var(--text-tertiary)]"
                title="删除"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Children Recursion */}
        {item.type === 'folder' && isFolderOpen && (
          <div>
            {getChildItems(items, item.id).map(child => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootItems = getChildItems(items, null);

  return (
    <div className="flex flex-col h-full bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] w-64 flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)] z-10">
        <div className="flex items-center justify-between font-bold text-[var(--text-primary)] mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white transition-colors ${isLocalMode ? 'bg-indigo-600' : 'bg-primary-600'}`}>
              {isLocalMode ? <HardDrive size={18} /> : <FileText size={18} />}
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm">StreamNotes</span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-1">{isLocalMode ? '本地模式' : '浏览器模式'}</span>
            </div>
          </div>
          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
            title={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="space-y-2 mb-3">
          <button
            onClick={onOpenLocalFolder}
            className="w-full flex items-center justify-center gap-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs font-semibold py-2 px-3 rounded-md transition-colors border border-[var(--border-color)]"
            title="打开电脑上的目录"
          >
            {isLocalMode ? '切换文件夹' : '打开本地文件夹'}
            <Upload size={14} />
          </button>
          
          {/* Switch to Browser Mode Button */}
          {isLocalMode && onSwitchToBrowserMode && (
            <button
              onClick={onSwitchToBrowserMode}
              className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold py-2 px-3 rounded-md transition-colors border border-blue-200"
              title="切换到浏览器存储模式"
            >
              切换到浏览器模式
              <FileText size={14} />
            </button>
          )}
        </div>

        {/* Root Actions & Clean */}
        <div className="flex gap-2 mb-3">
          <button 
            onClick={() => onCreateItem('file', null)}
            className="flex-1 flex items-center justify-center gap-1 bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-primary-300 hover:text-primary-600 text-[var(--text-primary)] text-xs font-medium py-1.5 px-2 rounded transition-all"
            title="新建根目录笔记"
          >
            <FilePlus size={14} />
            笔记
          </button>
          <button 
            onClick={() => onCreateItem('folder', null)}
            className="flex-1 flex items-center justify-center gap-1 bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-primary-300 hover:text-primary-600 text-[var(--text-primary)] text-xs font-medium py-1.5 px-2 rounded transition-all"
            title="新建根目录文件夹"
          >
            <FolderPlus size={14} />
            文件夹
          </button>
          <button
            onClick={onCleanupAssets}
            className="flex-shrink-0 flex items-center justify-center w-8 bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-red-300 hover:text-red-600 text-[var(--text-secondary)] text-xs font-medium py-1.5 rounded transition-all"
            title="清理未引用的图片"
          >
            <Eraser size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="relative group">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] group-focus-within:text-primary-500 transition-colors" />
          <input 
            type="text" 
            placeholder="搜索笔记..." 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 transition-all placeholder:text-[var(--text-tertiary)]"
          />
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {rootItems.length > 0 ? (
           rootItems.map(item => renderTreeItem(item))
        ) : (
          <div className="text-center mt-10 px-4 text-slate-400 text-sm">
            <p>没有可见文件。</p>
            <p className="text-xs mt-1">仅显示 .md 文件。</p>
          </div>
        )}
      </div>
      
      {/* Footer / Status */}
      <div className="p-2 border-t border-[var(--border-color)] bg-[var(--sidebar-bg)] text-[10px] text-[var(--text-tertiary)] text-center flex items-center justify-center gap-1">
        {isLocalMode ? (
           <>
             <HardDrive size={10} /> 正在同步到硬盘
           </>
        ) : (
           '已启用自动保存'
        )}
      </div>
    </div>
  );
};

export default Sidebar;