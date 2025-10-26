'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Hàm xử lý đăng nhập
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setTimeout(() => {
      // KIỂM TRA TÀI KHOẢN VÀ MẬT KHẨU MẪU
      if (email === 'admin@example.com' && password === 'password123') {
        // Lưu trạng thái đăng nhập vào localStorage
        // Trong một ứng dụng thực tế, bạn sẽ lưu token (JWT) ở đây
        localStorage.setItem('isAuthenticated', 'true');
        
        // Chuyển hướng đến trang chat chính
        router.push('/');
      } else {
        setError('Email hoặc mật khẩu không chính xác.');
      }
      setIsLoading(false);
    }, 1500); // Giả lập độ trễ mạng
  };

  return (
    <div
      className="flex h-screen w-full flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Lớp phủ tối */}
      <div className="absolute inset-0 bg-black/20"></div>

      {/* Form đăng nhập với hiệu ứng kính */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/30 bg-white/20 p-8 shadow-2xl backdrop-blur-xl">
        <h1 className="text-3xl font-bold text-white text-center mb-2">Đăng Nhập</h1>
        <p className="text-white/80 text-center mb-8">Chào mừng bạn quay trở lại!</p>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* Trường nhập Email */}
          <div>
            <label className="text-sm font-medium text-white/90">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email của bạn"
              required
              className="mt-2 block w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 focus:border-white/50 focus:outline-none focus:ring-0 transition-all"
            />
          </div>

          {/* Trường nhập Mật khẩu */}
          <div>
            <label className="text-sm font-medium text-white/90">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu của bạn"
              required
              className="mt-2 block w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 focus:border-white/50 focus:outline-none focus:ring-0 transition-all"
            />
          </div>

          {/* Hiển thị lỗi nếu có */}
          {error && (
            <div className="rounded-lg bg-red-500/30 p-3 text-center text-sm text-white">
              {error}
            </div>
          )}

          {/* Nút Đăng nhập */}
          <button
            type="submit"
            disabled={isLoading}
            className={`
              w-full rounded-lg px-5 py-3.5 text-center font-semibold text-white transition-all
              ${isLoading 
                ? 'bg-indigo-400/50 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50'
              }
            `}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang xử lý...
              </div>
            ) : 'Đăng Nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}
