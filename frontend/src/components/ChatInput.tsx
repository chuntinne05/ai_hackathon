'use client';

import { useState } from 'react';

// Định nghĩa props: component này cần một hàm onSendMessage
// để "báo" cho component cha biết khi nào người dùng gửi tin nhắn
type Props = {
  onSendMessage: (message: string) => void;
};

export default function ChatInput({ onSendMessage }: Props) {
  // Tạo một state riêng để quản lý nội dung đang được gõ trong ô input
  const [input, setInput] = useState('');

  // Hàm này được gọi mỗi khi người dùng nhấn nút gửi hoặc Enter
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Ngăn trang web tải lại (hành vi mặc định của form)

    const trimmedInput = input.trim();
    if (trimmedInput) {
      onSendMessage(trimmedInput); // Gọi hàm của component cha và gửi nội dung đi
      setInput(''); // Xóa nội dung trong ô input sau khi gửi
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
      <input
        type="text"
        value={input} // Giá trị của ô input luôn được "điều khiển" bởi state 'input'
        onChange={(e) => setInput(e.target.value)} // Cập nhật state mỗi khi người dùng gõ
        placeholder="Let me know what u wanna know..."
        className="flex-1 rounded-md border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-blue-300"
        disabled={!input.trim()} // Vô hiệu hóa nút gửi nếu chưa có nội dung
      >
        Gửi
      </button>
    </form>
  );
}