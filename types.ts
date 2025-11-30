export type ItemType = 'file' | 'folder';

export interface FileSystemItem {
  id: string;
  parentId: string | null;
  name: string;
  type: ItemType;
  content?: string; // Content is optional (loaded on demand for local files)
  createdAt: number;
  updatedAt: number;
  isOpen?: boolean; // For folders (UI state)
  handle?: any; // FileSystemHandle (for local mode)
  isLoaded?: boolean; // Track if content has been read from disk
}

export type FileSystemState = FileSystemItem[];

export interface SearchResult {
  item: FileSystemItem;
  matches: boolean;
}