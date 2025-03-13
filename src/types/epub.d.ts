declare module 'epub' {
  interface EPubChapter {
    id: string;
    href: string;
    title?: string;
  }

  interface EPubFlow {
    id: string;
    href: string;
  }

  interface TocElement {
    id: string;
    order: number;
    title: string;
    href?: string;
    level?: number;
  }

  interface EpubSpine {
    contents: Array<string | TocElement>;
    items: any[];
  }

  class EPub {
    constructor(filePath: string);
    
    flow: Array<{ id: string; href: string }>;
    spine: { contents: Array<{ id: string; href: string }> };
    
    parse(): void;
    
    getChapter(
      chapterId: string, 
      callback: (error: Error | null, text: string | null) => void
    ): void;
    
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    
    getImage(id: string, callback: (error: Error | null, data: Buffer, mimeType: string) => void): void;
    
    getFile(id: string, callback: (error: Error | null, data: Buffer, mimeType: string) => void): void;
  }

  export = EPub;
} 