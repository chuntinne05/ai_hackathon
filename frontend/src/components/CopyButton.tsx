'use client';

import { useState } from 'react';

type Props = {
  text: string; // Text cần copy
};

export default function CopyButton({ text }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(text);
      
      // Show "Copied!" feedback
      setCopied(true);
      
      // Reset sau 2 giây
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Có thể thêm error toast notification ở đây
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="rounded p-1 hover:bg-gray-100 transition-colors"
      title={copied ? 'Đã copy!' : 'Copy tin nhắn'}
    >
      {copied ? (
        // Checkmark icon khi đã copy
        <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        // Copy icon mặc định
        <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" 
          />
        </svg>
      )}
    </button>
  );
}

/*
GIẢI THÍCH:

1. CLIPBOARD API:
   - navigator.clipboard.writeText(): Modern API để copy
   - Async/await vì là Promise
   - Try/catch để handle lỗi (VD: permission denied)

2. VISUAL FEEDBACK:
   - State 'copied' để toggle icon
   - Copy icon → Checkmark icon (2s) → Copy icon
   - Color change: gray → green

3. UX ENHANCEMENTS:
   - hover:bg-gray-100: Subtle highlight khi hover
   - transition-colors: Smooth color transition
   - title attribute: Tooltip

4. ERROR HANDLING:
   - console.error nếu copy fail
   - Sau này có thể thêm toast notification

5. ACCESSIBILITY:
   - Button có title rõ ràng
   - Keyboard accessible (button native)

CÁCH TÍCH HỢP:
- Đặt button này trong ChatMessage component
- Show khi hover vào message
- Chỉ show cho bot messages (không cần copy tin nhắn của chính mình)
*/