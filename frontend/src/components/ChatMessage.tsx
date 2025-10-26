'use client';

import { useState } from 'react';
import MessageStatus from '@/components/MessageStatus';
import CopyButton from '@/components/CopyButton';
import MarkdownMessage from '@/components/MarkdownMessage';

type MessageStatusType = 'sending' | 'sent' | 'error';

type Props = {
  text: string;
  role: 'user' | 'bot';
  timestamp?: Date;
  status?: MessageStatusType; // Chỉ cho user messages
  onRetry?: () => void; // Callback khi click retry (nếu error)
};

export default function ChatMessage({ text, role, timestamp, status, onRetry }: Props) {
  const isUser = role === 'user';
  const [isHovered, setIsHovered] = useState(false);

  // Check xem message có chứa markdown không
  const hasMarkdown = text.includes('**') || text.includes('`') || text.includes('#') || text.includes('[');

  // Format thời gian
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div 
      className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white text-sm font-semibold">
            U
          </div>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm">
            🤖
          </div>
        )}
      </div>

      {/* Message content */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {/* Message bubble */}
        <div
          className={`group relative rounded-lg p-3 ${
            isUser
              ? 'bg-blue-500 text-white rounded-br-none' 
              : 'bg-gray-100 text-gray-900 rounded-bl-none'
          } ${status === 'error' ? 'border-2 border-red-500' : ''}`}
          onClick={status === 'error' ? onRetry : undefined}
          style={{ cursor: status === 'error' ? 'pointer' : 'default' }}
        >
          {/* Message text - với hoặc không markdown */}
          {hasMarkdown && !isUser ? (
            <div className={isUser ? 'text-white' : 'text-gray-900'}>
              <MarkdownMessage content={text} />
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">{text}</p>
          )}

          {/* Copy button - chỉ show khi hover vào bot message */}
          {!isUser && isHovered && (
            <div className="absolute -right-8 top-1">
              <CopyButton text={text} />
            </div>
          )}
        </div>

        {/* Timestamp và Status */}
        <div className={`flex items-center gap-2 mt-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          {timestamp && (
            <span className="text-xs text-gray-500">
              {formatTime(timestamp)}
            </span>
          )}
          
          {/* Message status - chỉ cho user messages */}
          {isUser && status && (
            <MessageStatus status={status} />
          )}
          
          {/* Error retry hint */}
          {status === 'error' && (
            <span className="text-xs text-red-500">
              Click để thử lại
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/*
GIẢI THÍCH CÁC FEATURES MỚI:

1. MESSAGE STATUS:
   - Prop 'status' optional cho user messages
   - Hiển thị icon sending/sent/error
   - Error messages có red border để nổi bật

2. COPY BUTTON:
   - Chỉ show cho bot messages (không cần copy tin của mình)
   - Hiện khi hover (isHovered state)
   - Absolute position bên cạnh message bubble

3. MARKDOWN RENDERING:
   - Check hasMarkdown: Có chứa **, `, #, [ không?
   - Nếu có + là bot message → dùng MarkdownMessage
   - User messages: luôn plain text (để tránh user inject markdown)

4. RETRY ON ERROR:
   - Error messages có cursor pointer
   - onClick gọi onRetry callback
   - Show hint "Click để thử lại"

5. IMPROVED STYLING:
   - max-w-[75%]: Message không quá rộng
   - Gradient avatar cho bot (đẹp hơn)
   - group class: Dùng cho group-hover effects sau này

6. HOVER STATE:
   - Track onMouseEnter/onMouseLeave
   - Show/hide copy button dựa vào state này
   - Smooth UX không làm rối message

7. ACCESSIBILITY:
   - Cursor pointer cho error messages
   - Clear visual feedback (red border + text)
   - Title attributes trên icons

USAGE EXAMPLE:

// User message đang gửi
<ChatMessage 
  role="user" 
  text="Hello"
  timestamp={new Date()}
  status="sending"
/>

// Bot message với markdown
<ChatMessage 
  role="bot" 
  text="Here's code:\n```python\nprint('hi')\n```"
  timestamp={new Date()}
/>

// User message bị lỗi + retry
<ChatMessage 
  role="user" 
  text="Failed message"
  timestamp={new Date()}
  status="error"
  onRetry={() => handleRetry(messageId)}
/>
*/