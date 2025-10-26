// Component hiển thị trạng thái của message (sending/sent/error)
// Giúp user biết message đã được gửi thành công hay chưa

type MessageStatus = 'sending' | 'sent' | 'error';

type Props = {
  status: MessageStatus;
};

export default function MessageStatus({ status }: Props) {
  // Chỉ hiển thị status cho message của user (bot không cần)
  
  if (status === 'sending') {
    return (
      <div className="flex items-center gap-1" title="Đang gửi...">
        {/* Single checkmark - đang gửi */}
        <svg className="h-4 w-4 text-gray-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  if (status === 'sent') {
    return (
      <div className="flex items-center gap-1" title="Đã gửi">
        {/* Double checkmark - đã gửi thành công */}
        <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <svg className="h-4 w-4 text-blue-400 -ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-1" title="Gửi thất bại - Click để thử lại">
        {/* Warning icon - lỗi */}
        <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
          />
        </svg>
      </div>
    );
  }

  return null;
}

/*
GIẢI THÍCH DESIGN:

1. STATUS STATES:
   - sending: 1 checkmark + pulse animation (đang xử lý)
   - sent: 2 checkmark xanh (thành công)
   - error: Icon warning đỏ (thất bại)

2. VISUAL CUES:
   - animate-pulse cho sending: Tạo cảm giác "đang chờ"
   - -ml-2 cho checkmark thứ 2: Overlap để giống WhatsApp/Telegram
   - Color coding: gray (waiting) → blue (success) → red (error)

3. UX DETAILS:
   - title attribute: Tooltip khi hover
   - Size 4x4: Nhỏ gọn, không làm rối message

4. TƯƠNG LAI:
   - Thêm "seen" status (2 checkmark xanh đậm hơn)
   - Thêm onClick cho error status để retry
   - Animate transition giữa các states

CÁCH DÙNG:
<MessageStatus status="sending" />
<MessageStatus status="sent" />
<MessageStatus status="error" />
*/