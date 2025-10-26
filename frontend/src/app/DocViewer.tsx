// DocxViewer.tsx
import React, { useState, useEffect } from 'react';
import * as mammoth from 'mammoth';

type Props = {
  file: File;
};

export default function DocxViewer({ file }: Props) {
  const [htmlContent, setHtmlContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state khi file thay đổi
    setIsLoading(true);
    setHtmlContent('');
    setError(null);

    const reader = new FileReader();

    // 1. Đọc file (File Object) như là một ArrayBuffer
    reader.readAsArrayBuffer(file);

    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;

      if (arrayBuffer) {
        try {
          // 2. Mammoth chuyển đổi ArrayBuffer sang HTML
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setHtmlContent(result.value); // result.value là chuỗi HTML
        } catch (err) {
          console.error('Lỗi khi chuyển đổi DOCX:', err);
          setError('Không thể đọc nội dung file Word này.');
        } finally {
          setIsLoading(false);
        }
      }
    };

    reader.onerror = (err) => {
      console.error('FileReader error:', err);
      setError('Lỗi khi đọc file.');
      setIsLoading(false);
    };
  }, [file]); // Chạy lại mỗi khi prop `file` thay đổi

  if (isLoading) {
    return <div className="p-4 text-center">Đang xử lý file Word...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  // 3. Render HTML ra DOM
  // Dùng `dangerouslySetInnerHTML` vì mammoth đã trả về HTML
  // Thêm class 'prose' (từ @tailwindcss/typography) để style tự động
  return (
    <div
      className="prose prose-lg max-w-none p-4"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}