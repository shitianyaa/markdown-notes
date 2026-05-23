import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Code, 
  Heading1, 
  Heading2, 
  Quote, 
  Link as LinkIcon, 
  Save, 
  Check, 
  Strikethrough, 
  Highlighter, 
  Minus, 
  Eye, 
  Columns, 
  PenLine, 
  Image as ImageIcon, 
  Link2, 
  Unlink2
} from 'lucide-react';

interface EditorProps {
  content: string;
  fileName: string;
  onUpdate: (content: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  assets?: Record<string, string>; // Map of filename -> objectUrl/dataUrl
  readOnly?: boolean;
  theme?: 'light' | 'dark';
  onShowToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
}

type ViewMode = 'edit' | 'split' | 'read';

const Editor: React.FC<EditorProps> = ({ 
  content, 
  fileName, 
  onUpdate, 
  onUploadImage, 
  assets = {},
  readOnly = false,
  theme = 'light',
  onShowToast 
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [localContent, setLocalContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [syncScroll, setSyncScroll] = useState(true);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const scrollingSource = useRef<'editor' | 'preview' | null>(null);
  const scrollTimeout = useRef<any>(null);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localContent !== content) {
        setIsSaving(true);
        onUpdate(localContent);
        setTimeout(() => setIsSaving(false), 800);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localContent, onUpdate, content]);

  const handleScroll = (source: 'editor' | 'preview') => {
    if (!syncScroll || viewMode !== 'split') return;

    if (scrollingSource.current && scrollingSource.current !== source) return;

    scrollingSource.current = source;
    clearTimeout(scrollTimeout.current);
    
    scrollTimeout.current = setTimeout(() => {
        scrollingSource.current = null;
    }, 100);

    const editorEl = textareaRef.current;
    const previewEl = previewRef.current;

    if (!editorEl || !previewEl) return;

    if (source === 'editor') {
        const percentage = editorEl.scrollTop / (editorEl.scrollHeight - editorEl.clientHeight);
        previewEl.scrollTop = percentage * (previewEl.scrollHeight - previewEl.clientHeight);
    } else {
        const percentage = previewEl.scrollTop / (previewEl.scrollHeight - previewEl.clientHeight);
        editorEl.scrollTop = percentage * (editorEl.scrollHeight - editorEl.clientHeight);
    }
  };

  const updateText = (newText: string, newCursorPos: number | null, selectionEndPos?: number) => {
    setLocalContent(newText);
    const textarea = textareaRef.current;
    if (textarea && newCursorPos !== null) {
        setTimeout(() => {
            textarea.focus();
            if (selectionEndPos !== undefined) {
              textarea.setSelectionRange(newCursorPos, selectionEndPos);
            } else {
              textarea.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    }
  };

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    const newText = `${before}${prefix}${selection}${suffix}${after}`;
    const newCursorStart = start + prefix.length;
    const newCursorEnd = start + prefix.length + selection.length;

    updateText(newText, newCursorStart, newCursorEnd);
  };

  const insertCodeBlock = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    const hasNewlineBefore = before.endsWith('\n') || start === 0;
    const hasNewlineAfter = after.startsWith('\n') || end === text.length;
    const prefix = hasNewlineBefore ? '```\n' : '\n```\n';
    const suffix = hasNewlineAfter ? '\n```' : '\n```\n';

    const newText = `${before}${prefix}${selection}${suffix}${after}`;
    const newCursorStart = start + prefix.length;
    const newCursorEnd = start + prefix.length + selection.length;

    updateText(newText, newCursorStart, newCursorEnd);
  };

  const insertQuote = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    let newContentChunk = '';
    if (selection.length > 0) {
      newContentChunk = selection.split('\n').map(line => `> ${line}`).join('\n');
    } else {
      newContentChunk = '> ';
    }
    
    const hasNewlineBefore = before.endsWith('\n') || start === 0;
    const prefix = hasNewlineBefore ? '' : '\n';
    const newText = `${before}${prefix}${newContentChunk}${after}`;
    const newCursorPos = start + prefix.length + newContentChunk.length;
    
    updateText(newText, newCursorPos);
  };

  const handleImageClick = () => {
    if (onUploadImage) {
      fileInputRef.current?.click();
    } else {
      // Fallback if no upload handler
      insertMarkdown('![图片描述](', ')');
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadImage) return;

    // Reset input
    e.target.value = '';

    try {
      // Show some feedback or just wait? 
      // For now, blocking wait is fine for small files.
      const savedFileName = await onUploadImage(file);
      
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;

      // Insert standard Markdown image link: ![filename](filename)
      // This is clean and compatible with other editors
      const imageMarkdown = `![${file.name}](${savedFileName})`;

      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = `${before}${imageMarkdown}${after}`;
      
      updateText(newText, start + imageMarkdown.length);
      
    } catch (error) {
      console.error("Image upload failed", error);
      onShowToast?.("图片上传失败", "error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 'b': e.preventDefault(); insertMarkdown('**', '**'); break;
            case 'i': e.preventDefault(); insertMarkdown('*', '*'); break;
            case 's': e.preventDefault(); onUpdate(localContent); break; 
            case 'k': e.preventDefault(); insertMarkdown('[', '](url)'); break;
        }
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        insertMarkdown('  ');
    }
  };

  // Custom Image Renderer to resolve local assets and optimize for dark mode
  const ImageRenderer = ({ src, alt, ...props }: any) => {
    // Check if src is a relative path that matches one of our loaded assets
    let finalSrc = src;
    
    if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('/')) {
        // Try to find in assets map
        // Decode URI component because Markdown might encode spaces as %20
        const decodedSrc = decodeURIComponent(src);
        if (assets[decodedSrc]) {
            finalSrc = assets[decodedSrc];
        }
    }

    return (
      <div className="my-4">
        <img 
          src={finalSrc} 
          alt={alt} 
          className="max-w-full rounded-lg border border-[var(--border-color)] my-4"
          style={{
            // Apply subtle image optimization for dark mode
            filter: theme === 'dark' ? 'brightness(0.9) contrast(0.95) saturate(0.9)' : 'none',
            transition: 'filter 0.3s ease'
          }}
          {...props} 
        />
      </div>
    );
  };

  const ToolbarButton: React.FC<{ 
    icon: React.ElementType; 
    onClick: () => void; 
    tooltip: string; 
    active?: boolean 
  }> = ({ icon: Icon, onClick, tooltip, active }) => (
    <button
      onClick={onClick}
      title={tooltip}
      className={`p-1.5 rounded-md transition-all flex-shrink-0 ${
        active 
          ? 'bg-primary-100 text-primary-600' 
          : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
      }`}
    >
      <Icon size={16} />
    </button>
  );

  // Export functions
  const exportToLongImage = async () => {
    try {
      // Check if html2canvas is available
      if (typeof window.html2canvas === 'undefined') {
        // Dynamically load html2canvas
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = async () => {
          await performLongImageExport();
        };
        document.body.appendChild(script);
      } else {
        await performLongImageExport();
      }
    } catch (error) {
      console.error('Failed to export as long image:', error);
      onShowToast?.('导出长图失败', 'error');
    }
  };

  const performLongImageExport = async () => {
    // Get the actual markdown content element instead of the scroll container
    const markdownElement = previewRef.current?.querySelector('.markdown-body');
    if (!markdownElement) {
      console.error('Markdown element not found');
      onShowToast?.('导出长图失败：未找到内容元素', 'error');
      return;
    }

    // Show loading state
    const originalCursor = document.body.style.cursor;
    document.body.style.cursor = 'wait';

    try {
      // Create a clone of the markdown element to avoid affecting the original
      const clone = markdownElement.cloneNode(true) as HTMLElement;
      
      // Set styles for the clone
      clone.style.maxWidth = '800px';
      clone.style.padding = '40px';
      clone.style.backgroundColor = 'white';
      clone.style.color = 'black';
      clone.style.position = 'absolute';
      clone.style.top = '0';
      clone.style.left = '-9999px';
      clone.style.width = '800px';
      clone.style.zIndex = '9999';
      
      // Add clone to document
      document.body.appendChild(clone);

      // Add temporary styles for better export quality
      const exportStyle = document.createElement('style');
      exportStyle.innerHTML = `
        /* Ensure images are properly displayed */
        img {
          max-width: 100% !important;
          height: auto !important;
          object-fit: contain !important;
        }
        
        /* Ensure proper display for all elements */
        * {
          box-sizing: border-box !important;
        }
      `;
      document.head.appendChild(exportStyle);

      // Use html2canvas to capture the cloned element as a long image
      const canvas = await window.html2canvas(clone, {
        scale: 2, // Higher scale for better quality
        useCORS: true, // Enable CORS for images
        backgroundColor: '#ffffff', // Set white background for dark mode
        logging: true, // Enable logging for debugging
        scrollX: 0,
        scrollY: 0,
        windowWidth: clone.offsetWidth,
        windowHeight: clone.offsetHeight
      });

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${fileName.replace('.md', '')}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          onShowToast?.('导出长图成功', 'success');
        } else {
          console.error('Failed to create blob from canvas');
          onShowToast?.('导出长图失败：无法创建图片文件', 'error');
        }
      }, 'image/png', 0.9); // Use PNG format for better quality

      // Clean up
      document.head.removeChild(exportStyle);
      document.body.removeChild(clone);
    } catch (error) {
      console.error('Long image export failed:', error);
      onShowToast?.(`导出长图失败：${error instanceof Error ? error.message : '未知错误'}`, 'error');
    } finally {
      // Restore cursor
      document.body.style.cursor = originalCursor;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] relative">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Top Bar */}
      <div className="h-14 border-b border-[var(--border-color)] flex items-center justify-between px-6 bg-[var(--bg-primary)] z-10 sticky top-0 print:hidden">
        <div className="flex items-center gap-3 overflow-hidden">
            <div className="font-mono text-[10px] font-bold text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--border-color)] uppercase tracking-wide">
                MD
            </div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)] truncate max-w-[200px] md:max-w-md" title={fileName}>{fileName}</h1>
            {isSaving ? (
                <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 animate-pulse">
                    <Save size={12} /> 保存中...
                </span>
            ) : (
                <span className="text-xs text-green-600 flex items-center gap-1 opacity-0 transition-opacity duration-500 data-[saved=true]:opacity-100" data-saved={true}>
                     <Check size={12} /> 已保存
                </span>
            )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Export Button */}
          <button
            onClick={exportToLongImage}
            title="导出为长图"
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors border bg-[var(--bg-primary)] text-[var(--text-tertiary)] border-transparent hover:bg-[var(--bg-secondary)]"
          >
            <ImageIcon size={14} />
            <span className="hidden sm:inline">长图</span>
          </button>

          <div className="h-4 w-px bg-[var(--border-color)] mx-1"></div>

          {viewMode === 'split' && (
             <button
               onClick={() => setSyncScroll(!syncScroll)}
               title={syncScroll ? "同步滚动: 开启" : "同步滚动: 关闭"}
               className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors border ${syncScroll ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-[var(--bg-primary)] text-[var(--text-tertiary)] border-transparent hover:bg-[var(--bg-secondary)]'}`}
             >
               {syncScroll ? <Link2 size={14} /> : <Unlink2 size={14} />}
               <span className="hidden sm:inline">同步</span>
             </button>
          )}

          <div className="h-4 w-px bg-[var(--border-color)] mx-1"></div>

          <div className="flex items-center gap-0.5 bg-[var(--bg-secondary)] p-0.5 rounded-lg border border-[var(--border-color)]">
            <button
              onClick={() => setViewMode('edit')}
              title="编辑模式"
              className={`p-1.5 rounded-md transition-all ${viewMode === 'edit' ? 'bg-[var(--bg-primary)] text-primary-600' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
            >
              <PenLine size={14} />
            </button>
            <button
              onClick={() => setViewMode('split')}
              title="分栏模式"
              className={`p-1.5 rounded-md transition-all ${viewMode === 'split' ? 'bg-[var(--bg-primary)] text-primary-600' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
            >
              <Columns size={14} />
            </button>
            <button
              onClick={() => setViewMode('read')}
              title="阅读模式"
              className={`p-1.5 rounded-md transition-all ${viewMode === 'read' ? 'bg-[var(--bg-primary)] text-primary-600' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
            >
              <Eye size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      {viewMode !== 'read' && (
        <div className="border-b border-[var(--border-color)] px-4 py-2 flex items-center gap-1 bg-[var(--bg-secondary)] overflow-x-auto no-scrollbar print:hidden">
          <ToolbarButton icon={Heading1} onClick={() => insertMarkdown('# ')} tooltip="一级标题" />
          <ToolbarButton icon={Heading2} onClick={() => insertMarkdown('## ')} tooltip="二级标题" />
          <div className="w-px h-4 bg-[var(--border-color)] mx-1"></div>
          <ToolbarButton icon={Bold} onClick={() => insertMarkdown('**', '**')} tooltip="加粗 (Ctrl+B)" />
          <ToolbarButton icon={Italic} onClick={() => insertMarkdown('*', '*')} tooltip="斜体 (Ctrl+I)" />
          <ToolbarButton icon={Strikethrough} onClick={() => insertMarkdown('~~', '~~')} tooltip="删除线" />
          <ToolbarButton icon={Highlighter} onClick={() => insertMarkdown('<mark>', '</mark>')} tooltip="高亮" />
          <div className="w-px h-4 bg-[var(--border-color)] mx-1"></div>
          <ToolbarButton icon={List} onClick={() => insertMarkdown('- ')} tooltip="无序列表" />
          <ToolbarButton icon={ListOrdered} onClick={() => insertMarkdown('1. ')} tooltip="有序列表" />
          <ToolbarButton icon={Code} onClick={insertCodeBlock} tooltip="代码块" />
          <ToolbarButton icon={Quote} onClick={insertQuote} tooltip="引用" />
          <div className="w-px h-4 bg-[var(--border-color)] mx-1"></div>
          <ToolbarButton icon={LinkIcon} onClick={() => insertMarkdown('[', '](url)')} tooltip="链接 (Ctrl+K)" />
          <ToolbarButton icon={ImageIcon} onClick={handleImageClick} tooltip="插入图片" />
          <ToolbarButton icon={Minus} onClick={() => insertMarkdown('\n---\n')} tooltip="分割线" />
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className={`
          h-full relative transition-all duration-300
          ${viewMode === 'read' ? 'hidden' : 'block'} 
          ${viewMode === 'split' ? 'w-1/2 border-r border-[var(--border-color)]' : 'w-full'}
          print:hidden
        `}>
          <textarea
            ref={textareaRef}
            value={localContent}
            onScroll={() => handleScroll('editor')}
            onChange={(e) => setLocalContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-full p-8 resize-none focus:outline-none font-mono text-sm leading-relaxed text-[var(--text-primary)] bg-[var(--editor-bg)]"
            placeholder="开始写作..."
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        <div 
          ref={previewRef}
          onScroll={() => handleScroll('preview')}
          className={`
          h-full overflow-y-auto bg-[var(--preview-bg)] transition-all duration-300
          ${viewMode === 'edit' ? 'hidden' : 'block'}
          ${viewMode === 'split' ? 'w-1/2' : 'w-full'}
          print:block print:w-full print:overflow-visible print:h-auto
        `}>
          <div className={`
            mx-auto p-8 markdown-body transition-all duration-300
            ${viewMode === 'read' ? 'max-w-4xl' : 'max-w-3xl'}
            print:max-w-none print:p-0
          `}>
             {localContent ? (
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                        // Use our custom image renderer to resolve local assets
                        img: ImageRenderer
                    }}
                    urlTransform={(url) => url} 
                >
                    {localContent}
                </ReactMarkdown>
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-[var(--text-tertiary)] print:hidden">
                    <p className="italic">预览模式</p>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;