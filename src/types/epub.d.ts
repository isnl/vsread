declare module 'epub' {
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
    constructor(epubfile: string, imagewebroot?: string, chapterwebroot?: string);
    
    spine: EpubSpine;
    
    on(event: 'end', callback: () => void): void;
    on(event: 'error', callback: (err: Error) => void): void;
    on(event: string, callback: Function): void;
    
    parse(): void;
    
    getChapter(chapterId: string, callback: (error: Error | null, text: string) => void): void;
    
    getImage(id: string, callback: (error: Error | null, data: Buffer, mimeType: string) => void): void;
    
    getFile(id: string, callback: (error: Error | null, data: Buffer, mimeType: string) => void): void;
  }

  export = EPub;
} 