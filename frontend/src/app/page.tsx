'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
type ContentSection = {
  id: string; // ID duy nhất (ví dụ: "policy_sec_1", "report_sec_A")
  text: string; // Nội dung văn bản
};
type MaxPayoutData = {
  expected_value: string | null;
  recommended_range: string | null; // Ví dụ: "10000-15000"
  probability_of_success: string | null; // Ví dụ: "80%"
};

type MaxPayoutResult = {
  message: string;
  ket_qua_tinh_toan_tu_hop_dong: string; // Đây là phần text tóm tắt từ AI
  du_lieu_trich_xuat: MaxPayoutData;
};
// Định nghĩa file được upload (Bao gồm cả Hồ sơ và Biên bản)
type UploadedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  fileUrl: string; // URL để render (nếu là .docx)
  fileObject: File; // File gốc
  uploadDate: Date;
  // Nội dung đã được AI cấu trúc hóa để highlight
  structuredContent: ContentSection[]; 
};
//Định nghĩa cho plan được suggest
type PlanAction = {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low'; // Mở rộng dựa trên "high" của bạn
  dueDate: string; // Quan trọng: Đây là key cho lịch (Giả định là YYYY-MM-DD hoặc ISO string)
  assignee: string;
  relatedSections: string[];
  estimatedTime: string;
};

type SuggestionPlan = {
  planId: string;
  claimId: string;
  status: string;
  actions: PlanAction[]; // Mảng các công việc
  totalEstimatedTime: string;
  criticalPath: string[];
  nextSteps: string; // Sẽ dùng cho tin nhắn chat
  timestamp: string;
};
// Định nghĩa tin nhắn Chat
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

// Định nghĩa chế độ xem cho cột bên phải
type RightPanelMode = 'report' | 'chat_notes';

// ============================================================================
// (MỚI) TYPES & INTERFACES (CHO CHECKLIST THẨM ĐỊNH)
// ============================================================================

type ValidationIssue = {
  issueType: string;
  severity: 'critical' | 'warning' | 'info';
  status:'fail' | 'pending' | 'pass';
  checklistItem: string;
  description: string;
  affectedSections: string[];
  recommendation: string;
};

type ClaimValidationResult = {
  status: 'approved' | 'rejected' | 'pending';
  isValid: boolean;
  confidence: number;
  estimatedAmount: number;
  maxCoverageAmount: number;
  issues: ValidationIssue[];
  summary: string;
};

type PriceCalculationResult = {
  expected_value: number;
  recommended_range: [number, number];
  probability_of_success: number;
  inputs_used: Record<string, any>; // Hoặc any
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function InsuranceWorkspace() {
  // === STATE MANAGEMENT ===

  // const [suggestionPromptVisible, setSuggestionPromptVisible] = useState(false);
  // const [isSuggesting, setIsSuggesting] = useState(false); 
  const [suggestionPlan, setSuggestionPlan] = useState<SuggestionPlan | null>(null);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  // Cột phải: Danh sách các file "Biên bản báo cáo"
  const [incidentReports, setIncidentReports] = useState<UploadedFile[]>([]);
  // Cột phải: ID của biên bản đang được xem
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // Cột trái: File "Hồ sơ bảo hiểm" (chỉ 1 file tại 1 thời điểm)
  const [insurancePolicy, setInsurancePolicy] = useState<UploadedFile | null>(null);

  // Cột phải: Chế độ xem (biên bản hay là chat/notes)
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('report');
  
  // Trạng thái highlight
  const [mappings, setMappings] = useState<Record<string, string>>({}); // {"report_id": "policy_id"}
  const [highlightedPolicyId, setHighlightedPolicyId] = useState<string | null>(null);
  
  // States cho Chat & Notes
  const [editorContent, setEditorContent] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // States giao diện
  const [isGlassEnabled, setIsGlassEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false); 

  // (MỚI) States cho Validation Checklist
  const [claimValidationResult, setClaimValidationResult] = useState<ClaimValidationResult | null>(null);
  const [isChecklistVisible, setIsChecklistVisible] = useState(false);
  const [isValidating, setIsValidating] = useState(false); // Loading cho riêng checklist

  const [showSuggestionPrompt, setShowSuggestionPrompt] = useState(false);
  const [isFetchingSuggestion, setIsFetchingSuggestion] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [priceCalculationResult, setPriceCalculationResult] = useState<PriceCalculationResult | null>(null)
  const [maxPayoutResult, setMaxPayoutResult] = useState<MaxPayoutResult | null>(null);
  const [isCalculatingMaxPayout, setIsCalculatingMaxPayout] = useState(false);
  const [isMaxPayoutModalVisible, setIsMaxPayoutModalVisible] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const reportViewerRef = useRef<HTMLDivElement>(null);  // Ref cho trình xem biên bản

  // === DERIVED STATE ===
  // Lấy object file biên bản đang active
  const activeReport = incidentReports.find(f => f.id === activeReportId);

  // ============================================================================
  // LOGIC API BACKEND (CẬP NHẬT)
  // ============================================================================

  // HÀM CHÍNH: Xử lý khi upload file "Biên bản" (FILE VĂN BẢN)
  const processIncidentReport = async (reportFile: File) => {
    setIsLoadingPolicy(true);
    setInsurancePolicy(null);
    setMappings({});
    setClaimValidationResult(null); // (MỚI) Reset checklist
    setIsChecklistVisible(false); // (MỚI) Ẩn checklist
    setIsValidating(false); // (MỚI) Reset loading checklist
    // setSuggestionPromptVisible(false); // (MỚI) Reset prompt
    // setIsSuggesting(false); // (MỚI) Reset loading
    setShowSuggestionPrompt(false);
    setPriceCalculationResult(null);
    setSuggestionPlan(null);
    setIsCalendarVisible(false);
    try {
      // === BƯỚC 1: GỌI API UPLOAD_REPORT ===
      console.log('[API] Đang gọi API tải lên (upload-report)...');
      
      // Tạo FormData để gửi file
      const formData = new FormData();
      formData.append('file', reportFile);
      
      // Gọi API backend
      const response = await fetch('http://127.0.0.1:8000/api/upload-report', {
        method: 'POST',
        body: formData,
      });
      console.log(response)
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Lỗi xử lý file');
      }
      
      const data = await response.json();
      setCustomerId(data.customerId)
      // Tạo object UploadedFile cho biên bản
      const newReportFile: UploadedFile = {
        id: data.reportId,
        name: data.reportName,
        type: data.reportType,
        size: data.reportSize,
        fileUrl: URL.createObjectURL(reportFile),
        fileObject: reportFile,
        uploadDate: new Date(),
        structuredContent: data.reportContent
      };
      
      // Tạo object UploadedFile cho hồ sơ bảo hiểm
      const policyFile: UploadedFile = {
        id: data.policy.id,
        name: data.policy.name,
        type: data.policy.type,
        size: data.policy.size,
        fileUrl: '',
        fileObject: new File([], 'policy.pdf'),
        uploadDate: new Date(data.policy.uploadDate),
        structuredContent: data.policy.structuredContent
      };
      
      // Cập nhật state (cho giao diện hiển thị ngay lập tức)
      setInsurancePolicy(policyFile);
      setMappings(data.mappings);
      setIncidentReports(prev => [...prev, newReportFile]);
      setActiveReportId(newReportFile.id);
      setRightPanelMode('report');
      
      console.log('✅ [API] Xử lý upload thành công:', {
        customerId: data.customerId,
        reportSections: data.reportContent.length,
        policySections: data.policy.structuredContent.length,
        mappings: Object.keys(data.mappings).length
      });
      console.log(data)
      // (MỚI) === BƯỚC 2: GỌI API VALIDATE_CLAIM ===
      console.log('[API] Đang gọi API thẩm định (validate-claim)...');
      setIsValidating(true); // Bật loading checklist
      try {
        const validationResponse = await fetch('http://127.0.0.1:8000/api/validate-claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportContent: data.reportContent,
            policyContent: data.policy.structuredContent,
            mappings: data.mappings,
            customerId: data.customerId
            // Gửi thêm context nếu API của bạn cần
            // reportContent: data.reportContent,
            // policyContent: data.policy.structuredContent
          }),
        });
        console.log(validationResponse)
        if (!validationResponse.ok) {
          const error = await validationResponse.json();
          throw new Error(error.detail || 'Lỗi khi thẩm định claim');
        }
        
        const validationData: ClaimValidationResult = await validationResponse.json();
        setClaimValidationResult(validationData); // (MỚI) Lưu kết quả
        console.log('✅ [API] Thẩm định thành công:', validationData);

        setShowSuggestionPrompt(true); // (MỚI) Hiện prompt gợi ý
        
      } catch (validationError) {
        console.error('❌ [API Validation] Lỗi:', validationError);
        // Không break, chỉ log lỗi, app vẫn tiếp tục
        alert(`Lỗi khi gọi API thẩm định: ${validationError}`);
      } finally {
        setIsValidating(false); // (MỚI) Tắt loading checklist
      }
      
    } catch (e) {
      console.error('❌ [API Upload] Lỗi:', e);
      alert(`Lỗi xử lý file: ${e}`);
    } finally {
      setIsLoadingPolicy(false); // Tắt loading chính
    }
  };


  
    // === HÀM XỬ LÝ SUGGEST API ===
    const handleSuggest = async () => {
    setShowSuggestionPrompt(false); // Ẩn notification
    setIsFetchingSuggestion(true); // Bật loading
    setRightPanelMode('chat_notes'); // Chuyển sang tab chat
    
    try {
      console.log('[API] Đang gọi API suggest...');
      const response = await fetch('http://127.0.0.1:8000/api/suggest-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportContent: activeReport?.structuredContent,
          policyContent: insurancePolicy?.structuredContent,
          validationResult: claimValidationResult,
          customerId: customerId
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Lỗi khi lấy suggestions');
      }
      
      const data: SuggestionPlan = await response.json(); // (CẬP NHẬT) Dùng type mới
      
      setSuggestionPlan(data); // (MỚI) Lưu toàn bộ plan data
      
      // (CẬP NHẬT) Thêm suggestion vào chat, dùng 'nextSteps'
      const suggestionMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.nextSteps || "Đây là kế hoạch đề xuất. Bạn có thể xem lịch trình cụ thể trong tab Calendar 📅", // (CẬP NHẬT)
        timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, suggestionMessage]);
      console.log('✅ [API] Suggest thành công, đã lưu plan.');
      
    } catch (error) {
      console.error('❌ [API Suggest] Lỗi:', error);
      
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Xin lỗi, đã có lỗi khi lấy suggestions. Vui lòng thử lại.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } 
  };

  const handleDeclineSuggest = () => {
    setShowSuggestionPrompt(false);
    console.log('[User] Đã từ chối suggestions');
    // await fetchPriceCalculation();
  };


  // ============================================================================
  // FILE UPLOAD HANDLERS
  // ============================================================================
  
  // HÀM PHỤ: Chỉ thêm file media (ảnh, video) vào danh sách
  const handleCalculateMaxPayout = async () => {
    // Chỉ chạy nếu có hồ sơ bảo hiểm
    if (!insurancePolicy || !customerId) {
      alert("Cần có hồ sơ bảo hiểm và ID khách hàng để bắt đầu tính toán.");
      return;
    }

    setIsCalculatingMaxPayout(true);
    setIsMaxPayoutModalVisible(false); // Đóng modal cũ (nếu có)
    setMaxPayoutResult(null);

    try {
      console.log('[API] Đang gọi API calculate_max_payout...');
      const policySections = insurancePolicy.structuredContent
        .map(sec => `[HỢP ĐỒNG] ${sec.text}`)
        .join('\n');
        
      const reportSections = activeReport?.structuredContent
          .map(section => section.text)
          .join('\n\n');
        
      const combinedText = `
        --- HỢP ĐỒNG BẢO HIỂM ---
        ${policySections}
        
        --- BIÊN BẢN BÁO CÁO TAI NẠN ---
        ${reportSections}
      `;
      const response = await fetch('http://127.0.0.1:8000/api/calculate_max_payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_text: combinedText
          // Ghi chú: Gửi thêm context nếu backend của bạn cần, ví dụ:
          // reportContent: activeReport?.structuredContent,
          // validationResult: claimValidationResult,
        }),
      });
      console.log("contract_text:",combinedText)
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Lỗi khi tính toán chi trả');
      }

      const data: MaxPayoutResult = await response.json();
      console.log(data)
      setMaxPayoutResult(data);
      setIsMaxPayoutModalVisible(true); // (QUAN TRỌNG) Mở modal khi có kết quả
      console.log('✅ [API] Tính toán chi trả tối đa thành công:', data);

    } catch (error) {
      console.error('❌ [API Max Payout] Lỗi:', error);
      alert(`Lỗi khi gọi API tính toán chi trả: ${error}`);
    } finally {
      setIsCalculatingMaxPayout(false);
    }
  };

  const addMediaFile = async (mediaFile: File) => {
    console.log(`[Hệ thống] Đang thêm file media: ${mediaFile.name}`);

    // === (MỚI) GỌI API VERIFY CLAIM ===
    // Chỉ gọi API nếu:
    // 1. File mới là ẢNH (backend chỉ nhận ảnh)
    // 2. Đã có một biên bản (text file) đang được load (activeReport)
    if (mediaFile.type.startsWith('image/') && activeReport && activeReport.structuredContent.length > 0) {
      
      console.log(`[API] File là ảnh, đang đối chiếu với biên bản: ${activeReport.name}...`);
      
      try {
        // 1. Chuẩn bị claim_text từ biên bản đang active
        const claim_text = activeReport.structuredContent
          .map(section => section.text)
          .join('\n\n');
        console.log(claim_text)
        // 2. Chuẩn bị FormData
        const formData = new FormData();
        formData.append('claim_text', claim_text);
        formData.append('file_anh', mediaFile, mediaFile.name); // 'file_anh' khớp với tên param của backend
        
        // 3. Gọi API (LƯU Ý: KHÔNG set 'Content-Type' header)
        const media_response = await fetch("http://127.0.0.1:8000/api/verify_claim", {
          method: 'POST',
          body: formData,
        });

        if (!media_response.ok) {
          const err = await media_response.json();
          throw new Error(err.detail || 'Lỗi từ API verify_claim');
        }

        const verificationData = await media_response.json();
        console.log('✅ [API] Verify claim (đối chiếu ảnh) thành công.');

        // 4. (Gợi ý) Thêm kết quả đối chiếu vào chat
        const verificationMessage: ChatMessage = {
          id: `msg-verify-${Date.now()}`,
          role: 'assistant',
          content: `🔍 **Kết quả đối chiếu (ảnh: ${mediaFile.name}):**\n\n${verificationData.ket_qua_doi_chieu}`,
          timestamp: new Date()
        };
        
        setChatMessages(prev => [...prev, verificationMessage]);
        // Cân nhắc chuyển sang tab chat để user thấy ngay
        // setRightPanelMode('chat_notes'); 

      } catch (error) {
        console.error('❌ [API Verify Claim] Lỗi:', error);
        // Báo lỗi trên chat
        const errorMessage: ChatMessage = {
          id: `msg-verify-err-${Date.now()}`,
          role: 'assistant',
          content: `❌ Đã có lỗi khi đối chiếu ảnh ${mediaFile.name}. Chi tiết: ${error}`,
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, errorMessage]);
      }
    } else if (mediaFile.type.startsWith('image/')) {
        console.warn("[Hệ thống] Tải ảnh lên nhưng không có biên bản (text file) nào đang active. Bỏ qua đối chiếu.");
    }
  const newMediaFile: UploadedFile = {
      id: `media-${Date.now()}-${mediaFile.name}`,
      name: mediaFile.name,
      type: mediaFile.type,
      size: mediaFile.size,
      fileUrl: URL.createObjectURL(mediaFile),
      fileObject: mediaFile,
      uploadDate: new Date(),
      structuredContent: [] // File media không có structured content
// (MỚI) Gán kết quả
    };

    setIncidentReports(prev => [...prev, newMediaFile]);

    // (MỚI) Tự động chọn file media vừa upload
    setActiveReportId(newMediaFile.id);
    setRightPanelMode('report');};

  // (HÀM HỖ TRỢ TỪ page.tsx)
  // Kiểm tra xem file có phải là file văn bản cần AI xử lý hay không
  const isTextReport = (file: File): boolean => {
    const textTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'text/plain',
      'text/markdown'
    ];
    const textExtensions = ['.docx', '.pdf', '.txt', '.md'];
    
    return textTypes.includes(file.type) || textExtensions.some(ext => file.name.endsWith(ext));
  };
  
  // (HÀM HỖ TRỢ TỪ page.tsx)
  // Kiểm tra file media (để lọc)
  const isMediaFile = (file: File): boolean => {
    return file.type.startsWith('image/') || file.type.startsWith('video/');
  };

  // (CẬP NHẬT TỪ page.tsx)
  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList); // Chuyển FileList thành Array

    // (MỚI) Tách file: ưu tiên xử lý file văn bản trước
    const textFile = files.find(isTextReport);
    const mediaFiles = files.filter(isMediaFile);
    const otherFiles = files.filter(f => !isTextReport(f) && !isMediaFile(f));

    if (textFile) {
      // Chỉ file VĂN BẢN đầu tiên mới kích hoạt quy trình AI
      await processIncidentReport(textFile);
    }
    
    // Thêm tất cả file media
    for (const file of mediaFiles) {
      addMediaFile(file);
    }
    
    // Báo lỗi cho các file không hỗ trợ
    if (otherFiles.length > 0) {
      alert(`Các file sau không được hỗ trợ: ${otherFiles.map(f => f.name).join(', ')}`);
    }
  };

  // (CẬP NHẬT TỪ page.tsx)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files); // Gửi toàn bộ FileList
    }
  };

  // ============================================================================
  // INTERACTIVE HIGHLIGHTING HANDLER (GIỮ NGUYÊN)
  // ============================================================================

  const handleReportTextSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    if (!selectedText || selectedText.length < 3) {
      setHighlightedPolicyId(null); // Xóa highlight nếu chọn text ngắn
      return;
    }

    const selectionNode = selection?.anchorNode?.parentElement;
    if (selectionNode && reportViewerRef.current?.contains(selectionNode)) {
      // Tìm section-id cha gần nhất
      const section = selectionNode.closest('[data-section-id]');
      if (section) {
        const reportSectionId = section.getAttribute('data-section-id');
        if (reportSectionId && mappings[reportSectionId]) {
          const policySectionId = mappings[reportSectionId];
          setHighlightedPolicyId(policySectionId); // SET HIGHLIGHT
        } else {
          setHighlightedPolicyId(null); // Không có mapping
        }
      }
    }
  };

  // Lắng nghe sự kiện nhả chuột trên trình xem biên bản
  useEffect(() => {
    const viewer = reportViewerRef.current;
    if (viewer) {
      viewer.addEventListener('mouseup', handleReportTextSelection);
      viewer.addEventListener('mouseleave', () => setHighlightedPolicyId(null)); // Xóa khi chuột rời
      
      return () => {
        viewer.removeEventListener('mouseup', handleReportTextSelection);
        viewer.removeEventListener('mouseleave', () => setHighlightedPolicyId(null));
      };
    }
  }, [mappings, reportViewerRef.current, activeReportId]); // Thêm activeReportId để gán lại event khi đổi tab

  
  // ============================================================================
  // AI CHAT HANDLER (GIỮ NGUYÊN)
  // ============================================================================

  const handleSendChatMessage = async (message: string) => {
    if (!message.trim()) return;
    
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMessage]);
    if (chatInputRef.current) chatInputRef.current.value = '';
    
    try {
      // Gọi API chat
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          reportContent: activeReport?.structuredContent || null,
          policyContent: insurancePolicy?.structuredContent || null,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Lỗi khi gọi API chat');
      }
      
      const data = await response.json();
      
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(data.timestamp)
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('❌ [CHAT API] Lỗi:', error);
      
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: 'Xin lỗi, đã có lỗi xảy ra khi xử lý câu hỏi của bạn. Vui lòng thử lại.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  // ============================================================================
  // RENDER: MAIN COMPONENT
  // ============================================================================

  // === RENDER: Helper - Trình xem nội dung (Chung cho cả 2 cột) ===
  const renderStructuredContent = (file: UploadedFile, highlightId: string | null, isGlass: boolean, ref?: React.Ref<HTMLDivElement>) => (
    <div 
      ref={ref} // Ref này chỉ dùng cho cột phải (biên bản)
      className="prose prose-sm max-w-none p-6 h-full overflow-y-auto"
      style={isGlass ? { color: 'white' } : { color: '#333' }}
    >
      <h2 className="font-bold text-2xl mb-4" style={isGlass ? { color: 'white' } : { color: 'black' }}>
        {file.name}
      </h2>
      {file.structuredContent.map(section => (
        <p
          key={section.id}
          data-section-id={section.id} // Quan trọng cho việc mapping
          className={`
            p-2 rounded-md transition-colors duration-300
            ${highlightId === section.id 
              ? 'bg-yellow-300 !text-black' // Lớp highlight
              : (ref ? 'cursor-pointer hover:bg-black/10' : '') // Chỉ cho phép hover ở cột biên bản
            }
          `}
        >
          {section.text}
        </p>
      ))}
    </div>
  );
  
  // === RENDER: Helper - Cột Chat & Notes (GIỮ NGUYÊN) ===
  const renderChatAndNotesPanel = () => (
    <div className="flex flex-col h-full">
      {/* 1. Chat Panel (2/3 trên) */}
      <div className="h-2/3 flex flex-col border-b" 
           style={isGlassEnabled ? { borderColor: 'rgba(255,255,255,0.2)' } : { borderColor: '#e5e7eb' }}
      >
        <h3 className={`p-4 font-semibold text-lg ${isGlassEnabled ? 'text-white' : 'text-gray-900'}`}>
          🤖 AI Teammate
        </h3>
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatMessages.length === 0 ? (
            <div className={`text-center mt-8 ${isGlassEnabled ? 'text-white/70' : 'text-gray-400'}`}>
              <p>Hỏi AI về hồ sơ hoặc biên bản...</p>
            </div>
          ) : (
            chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                    : (isGlassEnabled ? 'bg-black/30 text-white' : 'bg-gray-100 text-gray-800')
                }`}>
                  <div className="text-sm">
                <ReactMarkdown>
                  {msg.content}
                </ReactMarkdown>
              </div>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Chat Input */}
        <div className="p-4">
          <div className="flex gap-2">
            <input
              ref={chatInputRef}
              type="text"
              placeholder="Đặt câu hỏi..."
              onKeyPress={(e) => { if (e.key === 'Enter') handleSendChatMessage(chatInputRef.current?.value || ''); }}
              className={`flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 ${
                isGlassEnabled
                  ? 'bg-black/20 border-white/30 text-white placeholder-white/50 focus:ring-white'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-indigo-500'
              }`}
            />
            <button
              onClick={() => handleSendChatMessage(chatInputRef.current?.value || '')}
              className="px-6 py-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium"
            >
              Gửi
            </button>
          </div>
        </div>
      </div>
      
      {/* 2. Notes Panel (1/3 dưới) */}
      <div className="h-1/3 flex flex-col"> 
        <h3 className={`p-4 font-semibold text-lg ${isGlassEnabled ? 'text-white' : 'text-gray-900'}`}>
          📝 Ghi chú cá nhân
        </h3>
        <textarea
          value={editorContent}
          onChange={(e) => setEditorContent(e.target.value)}
          placeholder="Ghi chú về trường hợp này..."
          className={`
            flex-1 w-full p-4 resize-none font-mono text-sm leading-relaxed border-0 focus:outline-none
            ${isGlassEnabled
              ? 'bg-transparent text-white placeholder-white/50'
              : 'bg-white text-gray-900 placeholder-gray-400'
            }
          `}
        />
      </div>
    </div>
  );

  // === RENDER: Helper - Cột Biên bản (Report Viewer) (GIỮ NGUYÊN) ===
  const renderReportPanel = () => (
    <div className="flex flex-col h-full">
      {/* File tabs (Cho TẤT CẢ các file) */}
      <div className={`flex items-center gap-2 p-2 border-b overflow-x-auto ${
          isGlassEnabled ? 'bg-white/10 border-white/20' : 'bg-gray-50 border-gray-200'
      }`}>
        {incidentReports.map(file => (
          <button
            key={file.id}
            onClick={() => setActiveReportId(file.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
              activeReportId === file.id
                ? 'bg-indigo-500 text-white'
                : (isGlassEnabled ? 'bg-transparent text-white hover:bg-white/20' : 'bg-white text-gray-700 hover:bg-gray-100')
            }`}
          >
            {file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4" /> :
             file.type.startsWith('video/') ? <VideoIcon className="w-4 h-4" /> :
             <FileIcon className="w-4 h-4" />}
            <span className="text-sm font-medium">{file.name}</span>
          </button>
        ))}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600"
        >
          <PlusIcon className="w-4 h-4" />
          <span className="text-sm font-medium">Upload Thêm</span>
        </button>
      </div>

      {/* Document viewer (ĐÃ CẬP NHẬT) */}
      <div className="flex-1 overflow-y-auto">
        {activeReport ? (
          // Ưu tiên render media trước
          activeReport.type.startsWith('image/') ? (
            <div className="flex items-center justify-center h-full p-4">
              <img 
                src={activeReport.fileUrl} 
                alt={activeReport.name} 
                className="max-h-full max-w-full object-contain rounded-lg shadow-lg" 
              />
            </div>
          ) : activeReport.type.startsWith('video/') ? (
            <div className="flex items-center justify-center h-full p-4 bg-black/80">
              <video 
                src={activeReport.fileUrl} 
                controls 
                className="max-h-full max-w-full rounded-lg"
              >
                Trình duyệt của bạn không hỗ trợ video tag.
              </video>
            </div>
          ) : (
            // Nếu không phải media, thì là file text, dùng logic cũ
            activeReport.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? (
              <div className="p-4">
                  <p className={isGlassEnabled ? 'text-yellow-300' : 'text-red-600'}>
                    (Chế độ xem DOCX gốc đang được tải. Hiển thị nội dung đã trích xuất để đối chiếu.)
                  </p>
                  {/* Gắn ref vào đây để kích hoạt highlight */}
                  {renderStructuredContent(activeReport, null, isGlassEnabled, reportViewerRef)}
              </div>
            ) : (
              // DÙNG TRÌNH RENDER TỰ TẠO (HỖ TRỢ HIGHLIGHT)
              // Gắn ref vào đây để kích hoạt highlight
              renderStructuredContent(activeReport, null, isGlassEnabled, reportViewerRef)
            )
          )
        ) : (
          <div className={`flex items-center justify-center h-full ${isGlassEnabled ? 'text-white/70' : 'text-gray-400'}`}>
            <p>Chọn một file để xem</p>
          </div>
        )}
      </div>
    </div>
  );
  
  // ============================================================================
  // (MỚI) RENDER: Helper - Validation Checklist Modal
  // ============================================================================
  // ============================================================================
  // (MỚI) RENDER: Helper - Max Payout Modal (Ước tính chi trả)
  // ============================================================================
  const renderMaxPayoutModal = () => {
    
    // --- (MỚI) Logic xử lý dữ liệu để vẽ biểu đồ ---
    const chartData = useMemo(() => {
      if (!maxPayoutResult) return null;
      console.log(maxPayoutResult.du_lieu_trich_xuat)
      const { expected_value, recommended_range, probability_of_success } = maxPayoutResult.du_lieu_trich_xuat;

      // (SỬA LỖI) Hàm helper để parse số theo định dạng VN
      // Ví dụ: "10.000.000,50 VNĐ" -> 10000000.5
      // Ví dụ: "10.000.000" -> 10000000
      const parseVnNumber = (val: string | null): number => {
          if (!val) return 0;
          try {
            // 1. Xóa tất cả ký tự không phải số, dấu chấm, dấu phẩy
            const cleaned = val
                .replace(/[^0-9.,-]/g, '');
                
            // 2. Chuẩn hóa: xóa dấu chấm (ngàn), thay dấu phẩy (thập phân) bằng chấm
            const standardized = cleaned
                .replace(/\./g, '')      // "10.000,50" -> "10000,50"
                .replace(',', '.');     // "10000,50" -> "10000.50"
                
            // 3. Parse
            const result = parseFloat(standardized);
            return isNaN(result) ? 0 : result;
          } catch (e) {
            console.error('Lỗi parse số:', val, e);
            return 0;
          }
      };


      try {
        // 1. Xử lý Range (ví dụ: "10.000.000-15.000.000")
        const [minStr, maxStr] = recommended_range?.split('-') || ['0', '0'];
        const min = parseVnNumber(minStr); // (SỬA LỖI) Dùng hàm parse mới
        const max = parseVnNumber(maxStr); // (SỬA LỖI) Dùng hàm parse mới
        
        // 2. Xử lý Expected (ví dụ: "12.345.000,50")
        const expected = parseVnNumber(expected_value); // (SỬA LỖI) Dùng hàm parse mới
        
        // 3. Tính toán vị trí % của expected trong khoảng (min, max)
        const totalRange = max - min;
        const expectedPositionPercent = totalRange > 0 ? ((expected - min) / totalRange) * 100 : 50;

        // 4. Xử lý Probability (ví dụ: "80%") - Logic này vẫn đúng
        const probability = parseFloat(probability_of_success?.replace('%', '') || '0');
        
        return {
          min,
          max,
          expected,
          expectedPositionPercent: Math.max(0, Math.min(100, expectedPositionPercent)), // Giới hạn 0-100
          probability
        };

      } catch (e) {
        console.error("Lỗi parse dữ liệu biểu đồ:", e);
        return null;
      }
    }, [maxPayoutResult]);
    // --- Hết logic xử lý dữ liệu ---

    return (
      <AnimatePresence>
        {isMaxPayoutModalVisible && maxPayoutResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-8"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsMaxPayoutModalVisible(false)}
            ></div>
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`
                relative z-10 w-full max-w-2xl flex flex-col rounded-2xl shadow-xl overflow-hidden
                ${isGlassEnabled ? 'bg-white/20 backdrop-blur-xl border border-white/30 text-white' : 'bg-white border border-gray-300 text-gray-900'}
              `}
            >
              {/* Header */}
              <div className={`flex items-center justify-between p-4 border-b ${isGlassEnabled ? 'border-white/20' : 'border-gray-200'}`}>
                <h2 className="text-2xl font-bold">Ước tính Chi trả Tối đa</h2>
                <button onClick={() => setIsMaxPayoutModalVisible(false)} className={`p-2 rounded-full ${isGlassEnabled ? 'hover:bg-white/20' : 'hover:bg-gray-100'}`}>
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
              
              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. Kết quả tóm tắt từ AI */}
                <div className={`p-4 rounded-lg ${isGlassEnabled ? 'bg-black/20' : 'bg-gray-50 border'}`}>
                  <h3 className="font-semibold text-lg mb-2">Tóm tắt Tính toán từ Hợp đồng</h3>
                  <p className={`whitespace-pre-wrap ${isGlassEnabled ? 'text-white/90' : 'text-gray-700'}`}>
                    {maxPayoutResult.ket_qua_tinh_toan_tu_hop_dong}
                  </p>
                </div>

                {/* 2. Các chỉ số chính */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg ${isGlassEnabled ? 'bg-black/20' : 'bg-gray-50 border'}`}>
                    <span className="block opacity-70 text-sm">Giá trị Kỳ vọng (Expected)</span>
                    <span className="font-bold text-2xl text-blue-400">
                      {maxPayoutResult.du_lieu_trich_xuat.expected_value} VNĐ
                    </span>
                  </div>
                </div>

                {/* 3. Biểu đồ */}
           

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
  // ============================================================================
  // (MỚI) RENDER: Helper - Calendar Modal
  // ============================================================================
  const renderCalendarModal = () => {
    // State nội bộ cho lịch
    const [currentDate, setCurrentDate] = useState(new Date()); // Tháng/năm đang xem
    const [selectedDate, setSelectedDate] = useState<Date | null>(null); // Ngày đang chọn

    // (Memoized) Xử lý actions thành 1 map cho dễ tra cứu
    // Key là string 'YYYY-MM-DD', value là mảng các actions
    const tasksByDate = useMemo(() => {
      const map = new Map<string, PlanAction[]>();
      if (!suggestionPlan) return map;
      
      for (const action of suggestionPlan.actions) {
        try {
          // Chuẩn hóa dueDate về 'YYYY-MM-DD'
          // Rất quan trọng: Giả sử dueDate là "2025-10-28" hoặc "2025-10-28T10:00:00Z"
          const dateKey = action.dueDate.split('T')[0]; 
          
          if (!map.has(dateKey)) {
            map.set(dateKey, []);
          }
          map.get(dateKey)!.push(action);
        } catch (e) {
          console.error("Lỗi parse dueDate:", action.dueDate, e);
        }
      }
      return map;
    }, [suggestionPlan]);

    // Helper: Lấy key 'YYYY-MM-DD' từ object Date
    const toDateKey = (date: Date) => date.toISOString().split('T')[0];

    // Lấy task cho ngày đã chọn
    const tasksForSelectedDay = useMemo(() => {
      if (!selectedDate) return [];
      const dateKey = toDateKey(selectedDate);
      return tasksByDate.get(dateKey) || [];
    }, [selectedDate, tasksByDate]);

    // --- Logic tạo Lịch ---
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0=CN, 1=T2,...
    
    const paddingDays = Array(startDayOfWeek).fill(null);
    const monthDays = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
    
    const calendarGrid = [...paddingDays, ...monthDays];
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    
    // --- Navigation ---
    const goToPrevMonth = () => {
      setSelectedDate(null); // Reset selection
      setCurrentDate(new Date(year, month - 1, 1));
    };
    const goToNextMonth = () => {
      setSelectedDate(null); // Reset selection
      setCurrentDate(new Date(year, month + 1, 1));
    };

    return (
      <AnimatePresence>
        {isCalendarVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-8"
          >
            {/* Backdrop */}
            <div
className="absolute inset-0 bg-black/50"
              onClick={() => setIsCalendarVisible(false)}
            ></div>
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`
                relative z-10 w-full max-w-4xl h-[70vh] flex flex-col rounded-2xl shadow-xl overflow-hidden
                ${isGlassEnabled ? 'bg-white/20 backdrop-blur-xl border border-white/30 text-white' : 'bg-white border border-gray-300 text-gray-900'}
              `}
            >
              {/* Header */}
              <div className={`flex items-center justify-between p-4 border-b ${isGlassEnabled ? 'border-white/20' : 'border-gray-200'}`}>
                <h2 className="text-2xl font-bold">Lịch trình Kế hoạch</h2>
                <button onClick={() => setIsCalendarVisible(false)} className={`p-2 rounded-full ${isGlassEnabled ? 'hover:bg-white/20' : 'hover:bg-gray-100'}`}>
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
              
              {/* Body (chia 2 cột) */}
              <div className="flex-1 flex overflow-hidden">
                
                {/* Cột 1: Lịch */}
                <div className={`w-3/5 p-6 border-r ${isGlassEnabled ? 'border-white/20' : 'border-gray-200'} flex flex-col`}>
                  {/* Month/Year Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={goToPrevMonth} className={`p-2 rounded-full ${isGlassEnabled ? 'hover:bg-white/20' : 'hover:bg-gray-100'}`}>
                      <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <h3 className="font-bold text-xl">
                      {currentDate.toLocaleString('vi-VN', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button onClick={goToNextMonth} className={`p-2 rounded-full ${isGlassEnabled ? 'hover:bg-white/20' : 'hover:bg-gray-100'}`}>
                      <ChevronRightIcon className="w-6 h-6" />
                    </button>
                  </div>
                  
                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Day Headers */}
                    {dayNames.map(day => (
                      <div key={day} className="text-center font-semibold text-sm opacity-70 p-2">{day}</div>
                    ))}
                    
                    {/* Days */}
                    {calendarGrid.map((day, index) => {
                      if (!day) {
                        return <div key={`pad-${index}`}></div>; // Padding day
                      }
                      
                      const dateKey = toDateKey(day);
const hasTasks = tasksByDate.has(dateKey);
                      const isSelected = selectedDate && toDateKey(selectedDate) === dateKey;
                      
                      return (
                        <button
                          key={dateKey}
                          onClick={() => setSelectedDate(day)}
                          className={`
                            w-12 h-12 flex items-center justify-center rounded-full transition-all relative
                            ${isSelected 
                              ? 'bg-indigo-500 text-white font-bold' 
                              : (isGlassEnabled ? 'text-white hover:bg-white/20' : 'text-gray-700 hover:bg-gray-100')
                            }
                          `}
                        >
                          {day.getDate()}
                          {/* (MỚI) Đánh dấu ngày có task */}
                          {hasTasks && (
                            <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-red-400'}`}></div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Cột 2: Danh sách Task */}
                <div className="w-2/5 p-6 overflow-y-auto">
                  {selectedDate ? (
                    <>
                      <h3 className="font-bold text-lg mb-4">
                        Công việc ngày: {selectedDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </h3>
                      {tasksForSelectedDay.length > 0 ? (
                        <div className="space-y-4">
                          {tasksForSelectedDay.map(task => (
                            <div key={task.id} className={`p-4 rounded-lg ${isGlassEnabled ? 'bg-black/20' : 'bg-gray-50 border border-gray-200'}`}>
                              <h4 className="font-semibold">{task.title}</h4>
                              <p className="text-sm opacity-80 mt-1">{task.description}</p>
                              <div className="text-xs opacity-70 mt-2 flex justify-between">
                                <span>Giao cho: <strong>{task.assignee}</strong></span>
                                <span 
                                  className={task.priority === 'high' ? 'text-red-400 font-bold' : ''}
                                >
                                  Ưu tiên: {task.priority}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="opacity-70">Không có công việc nào cho ngày này.</p>
                      )}
                    </>
                  ) : (
<div className="flex items-center justify-center h-full">
                      <p className="opacity-70">Chọn một ngày để xem chi tiết</p>
                    </div>
                  )}
                </div>
                
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
  const renderValidationChecklistModal = () => (
    
    <AnimatePresence>
      {isChecklistVisible && claimValidationResult && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-8"
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsChecklistVisible(false)}
          ></div>
          
          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`
              relative z-10 w-full max-w-3xl h-[80vh] flex flex-col rounded-2xl shadow-xl overflow-hidden
              ${isGlassEnabled ? 'bg-white/20 backdrop-blur-xl border border-white/30 text-white' : 'bg-white border border-gray-300 text-gray-900'}
            `}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${isGlassEnabled ? 'border-white/20' : 'border-gray-200'}`}>
              <h2 className="text-2xl font-bold">Kết quả Thẩm định</h2>
              <button onClick={() => setIsChecklistVisible(false)} className={`p-2 rounded-full ${isGlassEnabled ? 'hover:bg-white/20' : 'hover:bg-gray-100'}`}>
                <XIcon className="w-6 h-6" />
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary Section */}
              <div className={`p-4 rounded-lg ${isGlassEnabled ? 'bg-black/20' : 'bg-gray-50'}`}>
                <h3 className="font-semibold text-lg mb-2">Tóm tắt</h3>
                <p className={`mb-4 ${isGlassEnabled ? 'text-white/90' : 'text-gray-700'}`}>{claimValidationResult.summary}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block opacity-70">Trạng thái</span>
                    <span className={`font-bold text-lg ${claimValidationResult.status === 'approved' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {claimValidationResult.status.toUpperCase()}
                    </span>
                  </div>
                  {/* <div>
                    <span className="block opacity-70">Ước tính chi trả</span>
                    <span className="font-bold text-lg">
                      {claimValidationResult.estimatedAmount.toLocaleString('vi-VN')} VNĐ
                    </span>
                  </div> */}
                </div>
              </div>
              
              {/* Checklist Section */}
              
              {/* Issues Section */}
                            {/* Issues Section */}
              {claimValidationResult.issues.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-3">Chi tiết đánh giá</h3>
                  <div className="space-y-4">
                    {claimValidationResult.issues.map((issue, index) => {
                      // Xác định màu dựa trên status
                      const statusColors = {
                        fail: {
                          border: isGlassEnabled ? 'border-red-400' : 'border-red-500',
                          bg: isGlassEnabled ? 'bg-black/20' : 'bg-red-50',
                          text: isGlassEnabled ? 'text-red-300' : 'text-red-700'
                        },
                        pending: {
                          border: isGlassEnabled ? 'border-yellow-400' : 'border-yellow-500',
                          bg: isGlassEnabled ? 'bg-black/20' : 'bg-yellow-50',
                          text: isGlassEnabled ? 'text-yellow-300' : 'text-yellow-700'
                        },
                        pass: {
                          border: isGlassEnabled ? 'border-green-400' : 'border-green-500',
                          bg: isGlassEnabled ? 'bg-black/20' : 'bg-green-50',
                          text: isGlassEnabled ? 'text-green-300' : 'text-green-700'
                        }
                      };
                      
                      const colors = statusColors[issue.status] || statusColors.fail;
                      
                      return (
                        <div 
                          key={index} 
                          className={`border-l-4 p-4 rounded-r-lg ${colors.bg} ${colors.border}`}
                        >
                          <p className={`font-semibold ${colors.text}`}>
                            {issue.description}
                          </p>
                          <p className="text-sm opacity-80 mt-1">
                            <strong>Khuyến nghị:</strong> {issue.recommendation}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // === RENDER: Helper - Suggestion Notification ===
  const renderSuggestionNotification = () => (
    <AnimatePresence>
      {showSuggestionPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-8 right-8 z-[90] max-w-md"
        >
          <div className={`
            rounded-2xl shadow-2xl p-6 border
            ${isGlassEnabled 
              ? 'bg-white/20 backdrop-blur-xl border-white/30 text-white' 
              : 'bg-white border-gray-300 text-gray-900'
            }
          `}>
            {/* Icon & Title */}
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <LightbulbIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">
                  💡 Gợi ý từ AI
                </h3>
                <p className={`text-sm ${isGlassEnabled ? 'text-white/80' : 'text-gray-600'}`}>
                  Tôi có một số gợi ý dành cho bạn trong việc hoàn thành checklist này. Bạn có muốn tôi đưa ra cho bạn không?
                </p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSuggest}
                disabled={isFetchingSuggestion}
                className="flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200
                  bg-gradient-to-r from-blue-500 to-indigo-600 text-white
                  hover:shadow-lg hover:scale-105 active:scale-95
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFetchingSuggestion ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/50 border-t-white"></div>
                    Đang tải...
                  </span>
                ) : (
                  '✅ Có, cho tôi xem'
                )}
              </button>
              
              <button
                onClick={handleDeclineSuggest}
                disabled={isFetchingSuggestion}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200
                  ${isGlassEnabled
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                ❌ Không, cảm ơn
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // === RENDER: GIAO DIỆN CHÍNH ===
  return (
    <div 
      className="h-screen w-full relative overflow-hidden"
      style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?ixlib=rb-4.1.0&auto=format&fit=crop&q=80&w=1974)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileUpload(e.target.files)}
        className="hidden"
        multiple={true} // (CẬP NHẬT) Cho phép upload nhiều file
        accept=".txt,.md,.docx,.pdf,image/*,video/*"
      />
      <div className="absolute inset-0 bg-black/30"></div>
      
      {/* (MỚI) Render Modal Checklist (nó sẽ tự ẩn/hiện) */}
      {renderValidationChecklistModal()}
      {renderCalendarModal()}
      {renderSuggestionNotification()}
      {renderMaxPayoutModal()}
      
      {/* === NÚT GLOBAL === */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsGlassEnabled(!isGlassEnabled)}
          className={`px-4 py-2 rounded-full transition-all text-sm ${
            isGlassEnabled
              ? 'bg-white/20 backdrop-blur-sm text-white border border-white/30'
              : 'bg-black/50 text-white border border-black/30'
          }`}
        >
          {isGlassEnabled ? '🪟 Glass' : '⬜ Normal'}
        </button>
      </div>

      {/* === NÚT CHUYỂN TAB DỌC (BÊN PHẢI) (CẬP NHẬT) === */}
      {incidentReports.length > 0 && ( 
        <div 
          className={`
            fixed top-1/2 -translate-y-1/2 right-6 z-50 
            flex flex-col gap-3 p-2 rounded-full border
            ${isGlassEnabled 
              ? 'bg-white/20 backdrop-blur-sm border-white/30' 
              : 'bg-white border-gray-300 shadow-lg'
            }
          `}
        >
          {/* Nút Biên bản */}
          <button
            onClick={() => setRightPanelMode('report')}
            title="Biên bản & Hồ sơ" // Tooltip
            className={`
              w-12 h-12 rounded-full flex items-center justify-center 
              transition-all duration-200
              ${rightPanelMode === 'report' 
                ? 'bg-indigo-500 text-white scale-110' 
                : (isGlassEnabled 
                    ? 'text-white hover:bg-white/30' 
                    : 'text-gray-700 hover:bg-gray-100'
                  )
              }
            `}
          >
            <FileIcon className="w-6 h-6" />
          </button>
          
          {/* Nút Chat */}
          <button
            onClick={() => setRightPanelMode('chat_notes')}
            title="Chat & Notes" // Tooltip
            className={`
              w-12 h-12 rounded-full flex items-center justify-center 
              transition-all duration-200
              ${rightPanelMode === 'chat_notes' 
                ? 'bg-indigo-500 text-white scale-110' 
                : (isGlassEnabled 
                    ? 'text-white hover:bg-white/30' 
                    : 'text-gray-700 hover:bg-gray-100'
                  )
              }
            `}
          >
            <ChatIcon className="w-6 h-6" />
          </button>
          
          {/* (MỚI) Nút Checklist (hoặc loading) */}
          {isValidating && (
            <div title="Đang thẩm định..." className={`w-12 h-12 rounded-full flex items-center justify-center ${isGlassEnabled ? 'text-white' : 'text-gray-700'}`}>
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/50 border-t-white"></div>
            </div>
          )}
          
          {!isValidating && claimValidationResult && (
            <button
              onClick={() => setIsChecklistVisible(true)}
              title="Xem Checklist Thẩm định" // Tooltip
              className={`
                w-12 h-12 rounded-full flex items-center justify-center 
                transition-all duration-200
                ${isChecklistVisible 
                  ? 'bg-indigo-500 text-white scale-110' 
                  : (isGlassEnabled 
                      ? 'text-white hover:bg-white/30' 
                      : 'text-gray-700 hover:bg-gray-100'
                    )
                }
                ${claimValidationResult.status !== 'approved' ? 'text-yellow-400' : 'text-green-400'}
                ${isChecklistVisible ? '' : (claimValidationResult.status !== 'approved' ? 'hover:text-yellow-300' : 'hover:text-green-300')}
              `}
            >
              <ChecklistIcon className="w-6 h-6" />

            </button>
            
          )}

          {/* (MỚI) Nút Tính toán Chi trả (Chỉ hiện khi có hồ sơ) */}
          {insurancePolicy && (
            <>
              {isCalculatingMaxPayout ? (
                <div title="Đang tính toán..." className={`w-12 h-12 rounded-full flex items-center justify-center ${isGlassEnabled ? 'text-white' : 'text-gray-700'}`}>
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/50 border-t-white"></div>
                </div>
              ) : (
                <button
                  onClick={handleCalculateMaxPayout}
                  title="Ước tính Chi trả Tối đa" // Tooltip
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center 
                    transition-all duration-200
                    ${isMaxPayoutModalVisible 
                      ? 'bg-indigo-500 text-white scale-110' 
                      : (isGlassEnabled 
                          ? 'text-white hover:bg-white/30' 
                          : 'text-gray-700 hover:bg-gray-100'
                        )
                    }
                  `}
                >
                  <DollarIcon className="w-6 h-6" />
                </button>
              )}
            </>
          )}

          {suggestionPlan && (
            <button
              onClick={() => setIsCalendarVisible(true)}
              title="Xem Lịch trình Kế hoạch" // Tooltip
              className={`
                w-12 h-12 rounded-full flex items-center justify-center 
                transition-all duration-200
                ${isCalendarVisible 
                  ? 'bg-indigo-500 text-white scale-110' 
                  : (isGlassEnabled 
                      ? 'text-white hover:bg-white/30' 
                      : 'text-gray-700 hover:bg-gray-100'
                    )
                }
              `}
            >
              <CalendarIcon className="w-6 h-6" />
            </button>
          )}
        </div>
      )}


      {incidentReports.length === 0 ? (
        // ============================================================================
        // RENDER: INITIAL SCREEN
        // ============================================================================
        <div className="relative z-10 flex h-full w-full items-center justify-center">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
            className={`
              w-full max-w-2xl rounded-3xl border-4 p-16 transition-all duration-300
              ${isGlassEnabled ? 'bg-white/20 backdrop-blur-xl border-white/30' : 'bg-white border-gray-300'}
              ${isDragging ? 'border-indigo-500 bg-white/40' : 'border-dashed'}
            `}
          >
            <div className={`text-center ${isGlassEnabled ? 'text-white' : 'text-gray-800'}`}>
              <UploadIcon className="w-24 h-24 mx-auto mb-6" />
              <h1 className="text-4xl font-bold mb-4">Insurance Workspace</h1>
              <p className="text-xl mb-8 opacity-90">
                Kéo thả file (Biên bản, Ảnh, Video) vào đây để bắt đầu
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 px-8 py-4 text-lg"
              >
                Upload File
              </button>
            </div>
          </div>
        </div>

      ) : (

        // ============================================================================
        // RENDER: MAIN WORKSPACE (Đã có file)
        // ============================================================================
        
        <div className="relative z-10 flex h-screen w-full pl-8 pb-8 pr-24 gap-8 pt-20"> 
          
          {/* ====== CỘT TRÁI: HỒ SƠ BẢO HIỂM ====== */}
          <div className={`
              w-1/2 flex flex-col rounded-2xl shadow-xl overflow-hidden transition-all duration-300
              ${isGlassEnabled ? 'bg-white/10 backdrop-blur-xl border border-white/30' : 'bg-white border border-gray-300'}
          `}>
            {isLoadingPolicy ? (
              <div className={`flex flex-col items-center justify-center h-full ${isGlassEnabled ? 'text-white' : 'text-gray-700'}`}>
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
                <p className="text-lg font-semibold">Đang tải hồ sơ bảo hiểm...</p>
                <p className={isGlassEnabled ? 'text-white/70' : 'text-gray-500'}>AI đang phân tích biên bản và truy vấn...</p>
              </div>
            ) : insurancePolicy ? (
              // Render hồ sơ
              renderStructuredContent(insurancePolicy, highlightedPolicyId, isGlassEnabled)
            ) : (
              <div className={`flex items-center justify-center h-full ${isGlassEnabled ? 'text-white/70' : 'text-gray-400'}`}>
                <p>Upload file văn bản (.pdf, .docx) để AI tìm hồ sơ bảo hiểm.</p>
              </div>
            )}
          </div>

          {/* ====== CỘT PHẢI: WORKSPACE (Biên bản HOẶC Chat/Notes) ====== */}
          <div className={`
              w-1/2 flex flex-col rounded-2xl shadow-xl overflow-hidden transition-all duration-300
              ${isGlassEnabled ? 'bg-white/20 backdrop-blur-xl border border-white/30' : 'bg-white border border-gray-300'}
          `}>
            {rightPanelMode === 'report' ? renderReportPanel() : renderChatAndNotesPanel()}
          </div>
        </div>
      )}
      
    </div>
  );
}

// ============================================================================
// (MỚI) DỮ LIỆU MOCK ĐỂ TEST
// ============================================================================
// ============================================================================
// ICONS (ĐÃ THÊM 4 ICON MỚI)
// ============================================================================

const UploadIcon = (props: any) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const FileIcon = (props: any) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const PlusIcon = (props: any) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const ChatIcon = (props: any) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const ImageIcon = (props: any) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l-1.586-1.586a2 2 0 00-2.828 0L6 14m6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const VideoIcon = (props: any) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h10a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
  </svg>
);

// (ICON MỚI) Dùng cho nút đóng modal
const XIcon = (props: any) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// (ICON MỚI) Dùng cho nút mở checklist
const ChecklistIcon = (props: any) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

// (ICON MỚI) Dùng cho checklist item 'met'
const CheckCircleIcon = (props: any) => (
  <svg {...props} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

// (ICON MỚI) Dùng cho checklist item 'unmet'
const XCircleIcon = (props: any) => (
  <svg {...props} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
  </svg>
);

const LightbulbIcon = (props: any) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const CalendarIcon = (props: any) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// (ICON MỚI) Dùng cho nút điều hướng lịch
const ChevronLeftIcon = (props: any) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = (props: any) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

const DollarIcon = (props: any) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.105 0 2 .895 2 2s-.895 2-2 2-2-.895-2-2 .895-2 2 2zm0 8c-1.105 0-2 .895-2 2s.895 2 2 2 2-.895 2-2-.895-2-2-2zm0-12a10 10 0 100 20 10 10 0 000-20z" />
  </svg>
);