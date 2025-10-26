// File này định nghĩa các types cho message
// Quan trọng: Phải match với format mà API (RAG + RASA) sẽ trả về sau này

export type MessageRole = 'user' | 'bot';

// Message cơ bản
export interface Message {
  id: string;              // Unique ID cho mỗi message (quan trọng cho React key)
  role: MessageRole;       // Ai gửi: user hay bot
  text: string;            // Nội dung tin nhắn
  timestamp: Date;         // Thời gian gửi
  status?: 'sending' | 'sent' | 'error'; // Status cho user messages
}

export interface ExtendedMessage extends Message {
  status?: 'sending' | 'sent' | 'error';  // Trạng thái gửi
  metadata?: {
    intent?: string;        // Intent được nhận diện (VD: "greeting", "book_flight")
    confidence?: number;    // Độ tự tin của model (0-1)
    entities?: Array<{      // Entities được trích xuất
      entity: string;
      value: string;
    }>;
    sources?: string[];     // Nguồn tham khảo (cho RAG)
  };
}

/*
GIẢI THÍCH THIẾT KẾ:

1. MESSAGE ID:
   - Dùng để làm React key (thay vì index)
   - Backend sẽ generate, frontend tạm thời dùng Date.now() + random

2. TIMESTAMP:
   - Kiểu Date thay vì string để dễ format
   - Frontend tạo khi user gửi, backend override khi nhận response

3. EXTENDED MESSAGE:
   - Không bắt buộc dùng ngay
   - Chuẩn bị sẵn cho khi integrate RASA:
     * intent: RASA sẽ trả về intent của user
     * confidence: Score từ 0-1
     * entities: VD: "book flight to Hanoi" → entity: "location", value: "Hanoi"
     * sources: RAG sẽ trả về documents được dùng để gen answer

4. TẠI SAO TÁCH RA 2 INTERFACE:
   - Message: Dùng cho mock data hiện tại
   - ExtendedMessage: Dùng khi integrate backend
   - Extends cho phép backward compatible

VÍ DỤ RESPONSE TỪ RASA (TƯƠNG LAI):
{
  "text": "Tôi có thể giúp bạn đặt vé đến Hà Nội",
  "intent": "book_flight",
  "confidence": 0.95,
  "entities": [
    {"entity": "location", "value": "Hà Nội"}
  ]
}
*/