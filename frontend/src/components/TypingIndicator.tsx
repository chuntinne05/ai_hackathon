export default function TypingIndicator() {
  return (
    <div className="flex items-end justify-start">
      <div className="max-w-xs rounded-lg bg-gray-200 p-3 lg:max-w-md">
        <div className="flex space-x-1">
          {/* 3 chấm nhỏ với animation stagger (chạy lần lượt) */}
          <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.3s]"></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.15s]"></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500"></div>
        </div>
      </div>
    </div>
  );
}