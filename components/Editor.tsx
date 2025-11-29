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
}

type ViewMode = 'edit' | 'split' | 'read';

const Editor: React.FC<EditorProps> = ({ 
  content, 
  fileName, 
  onUpdate, 
  onUploadImage, 
  assets = {},
  readOnly = false 
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
      alert("图片上传失败");
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

  // Custom Image Renderer to resolve local assets
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
      <img 
        src={finalSrc} 
        alt={alt} 
        className="max-w-full rounded-lg border border-slate-200 shadow-sm my-4"
        {...props} 
      />
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
          : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900'
      }`}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-white relative">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Top Bar */}
      <div className="h-14 border-b border-slate-200 flex items-center justify-between px-6 bg-white z-10 sticky top-0 print:hidden">
        <div className="flex items-center gap-3 overflow-hidden">
            <div className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-wide">
                MD
            </div>
            <h1 className="text-lg font-semibold text-slate-800 truncate max-w-[200px] md:max-w-md" title={fileName}>{fileName}</h1>
            {isSaving ? (
                <span className="text-xs text-slate-400 flex items-center gap-1 animate-pulse">
                    <Save size={12} /> 保存中...
                </span>
            ) : (
                <span className="text-xs text-green-600 flex items-center gap-1 opacity-0 transition-opacity duration-500 data-[saved=true]:opacity-100" data-saved={true}>
                     <Check size={12} /> 已保存
                </span>
            )}
        </div>
        
        <div className="flex items-center gap-3">
          {viewMode === 'split' && (
             <button
               onClick={() => setSyncScroll(!syncScroll)}
               title={syncScroll ? "同步滚动: 开启" : "同步滚动: 关闭"}
               className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                 syncScroll 
                  ? 'bg-blue-50 text-blue-600 border-blue-200' 
                  : 'bg-white text-slate-500 border-transparent hover:bg-slate-50'
               }`}
             >
               {syncScroll ? <Link2 size={14} /> : <Unlink2 size={14} />}
               <span className="hidden sm:inline">同步</span>
             </button>
          )}

          <div className="h-4 w-px bg-slate-300 mx-1"></div>

          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('edit')}
              title="编辑模式"
              className={`p-1.5 rounded-md transition-all ${viewMode === 'edit' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <PenLine size={14} />
            </button>
            <button
              onClick={() => setViewMode('split')}
              title="分栏模式"
              className={`p-1.5 rounded-md transition-all ${viewMode === 'split' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Columns size={14} />
            </button>
            <button
              onClick={() => setViewMode('read')}
              title="阅读模式"
              className={`p-1.5 rounded-md transition-all ${viewMode === 'read' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Eye size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      {viewMode !== 'read' && (
        <div className="border-b border-slate-200 px-4 py-2 flex items-center gap-1 bg-slate-50 overflow-x-auto no-scrollbar print:hidden">
          <ToolbarButton icon={Heading1} onClick={() => insertMarkdown('# ')} tooltip="一级标题" />
          <ToolbarButton icon={Heading2} onClick={() => insertMarkdown('## ')} tooltip="二级标题" />
          <div className="w-px h-4 bg-slate-300 mx-1"></div>
          <ToolbarButton icon={Bold} onClick={() => insertMarkdown('**', '**')} tooltip="加粗 (Ctrl+B)" />
          <ToolbarButton icon={Italic} onClick={() => insertMarkdown('*', '*')} tooltip="斜体 (Ctrl+I)" />
          <ToolbarButton icon={Strikethrough} onClick={() => insertMarkdown('~~', '~~')} tooltip="删除线" />
          <ToolbarButton icon={Highlighter} onClick={() => insertMarkdown('<mark>', '</mark>')} tooltip="高亮" />
          <div className="w-px h-4 bg-slate-300 mx-1"></div>
          <ToolbarButton icon={List} onClick={() => insertMarkdown('- ')} tooltip="无序列表" />
          <ToolbarButton icon={ListOrdered} onClick={() => insertMarkdown('1. ')} tooltip="有序列表" />
          <ToolbarButton icon={Code} onClick={insertCodeBlock} tooltip="代码块" />
          <ToolbarButton icon={Quote} onClick={insertQuote} tooltip="引用" />
          <div className="w-px h-4 bg-slate-300 mx-1"></div>
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
          ${viewMode === 'split' ? 'w-1/2 border-r border-slate-200' : 'w-full'}
          print:hidden
        `}>
          <textarea
            ref={textareaRef}
            value={localContent}
            onScroll={() => handleScroll('editor')}
            onChange={(e) => setLocalContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-full p-8 resize-none focus:outline-none font-mono text-sm leading-relaxed text-slate-700 bg-white"
            placeholder="开始写作..."
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        <div 
          ref={previewRef}
          onScroll={() => handleScroll('preview')}
          className={`
          h-full overflow-y-auto bg-white transition-all duration-300
          ${viewMode === 'edit' ? 'hidden' : 'block'}
          ${viewMode === 'split' ? 'w-1/2' : 'w-full'}
          print:block print:w-full print:overflow-visible print:h-auto
        `}>
          <div className={`
            mx-auto p-8 markdown-body text-slate-800 transition-all duration-300
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
                <div className="h-full flex flex-col items-center justify-center text-slate-300 print:hidden">
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