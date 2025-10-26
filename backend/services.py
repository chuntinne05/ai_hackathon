import json
import re
import io
import os
from datetime import datetime
from fastapi import HTTPException, UploadFile
from PIL import Image
from typing import List, Optional

# Import từ các module nội bộ
from config import model
from models import (
    ContentSection, PolicyFile, ClaimValidationResult, ValidationIssue,
    ActionPlan, ActionItem, ClaimStatus, ValidationIssueType, ActionPriority
)
from utils import extract_text_from_docx
from prompts import (
    PROMPT_PHAN_TICH_ANH, PROMPT_SO_SANH_KEYPOINTS, PROMPT_TINH_TOAN_TOI_DA
)

# ============================================================================
# UTILITY FUNCTIONS (AI-POWERED)
# ============================================================================

def _clean_json_response(response_text: str) -> str:
    """Helper để dọn dẹp markdown (```json) khỏi response của AI"""
    response_text = re.sub(r'^```json\s*', '', response_text)
    response_text = re.sub(r'^```\s*', '', response_text)
    response_text = re.sub(r'\s*```$', '', response_text)
    return response_text.strip()

async def structure_content_with_ai(text: str, file_type: str) -> List[ContentSection]:
    """Sử dụng Gemini AI để cấu trúc nội dung thành các sections"""
    
    if file_type == "report":
        prompt = f"""Phân tích biên bản báo cáo tai nạn bảo hiểm sau và chia thành các phần logic.
        
Yêu cầu:
- Mỗi phần nên chứa thông tin về: mô tả tai nạn, thông tin khách hàng, điều trị, chi phí, hoặc hồ sơ đính kèm
- Tạo ID theo format: report_sec_A, report_sec_B, report_sec_C, v.v.
- Mỗi phần nên có từ 2-5 câu, rõ ràng và súc tích

Text biên bản:
{text}

Trả về CHÍNH XÁC JSON array với format (không thêm markdown, chỉ JSON thuần):
[
  {{"id": "report_sec_A", "text": "nội dung phần A"}},
  {{"id": "report_sec_B", "text": "nội dung phần B"}}
]"""
    else:  # policy
        prompt = f"""Phân tích hợp đồng bảo hiểm sau và chia thành các điều khoản chính.

Yêu cầu:
- Mỗi điều khoản nên rõ ràng về quyền lợi, trách nhiệm, hoặc điều kiện
- Tạo ID theo format: policy_sec_1, policy_sec_2, policy_sec_3, v.v.
- Tập trung vào các điều khoản về tai nạn, chi phí y tế, loại trừ, và thủ tục bồi thường

Text hợp đồng:
{text}

Trả về CHÍNH XÁC JSON array với format (không thêm markdown, chỉ JSON thuần):
[
  {{"id": "policy_sec_1", "text": "nội dung điều khoản 1"}},
  {{"id": "policy_sec_2", "text": "nội dung điều khoản 2"}}
]"""

    try:
        response = model.generate_content(prompt)
        response_text = _clean_json_response(response.text)
        
        sections_data = json.loads(response_text)
        
        sections = []
        for idx, section_data in enumerate(sections_data):
            if isinstance(section_data, dict) and "id" in section_data and "text" in section_data:
                sections.append(ContentSection(**section_data))
            else:
                prefix = "report_sec_" if file_type == "report" else "policy_sec_"
                sections.append(ContentSection(
                    id=f"{prefix}{chr(65+idx) if file_type == 'report' else idx+1}",
                    text=str(section_data) if isinstance(section_data, str) else json.dumps(section_data)
                ))
        
        return sections
        
    except json.JSONDecodeError as e:
        print(f"JSON Parse Error: {e}")
        print(f"Response text: {response_text}")
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        prefix = "report_sec_" if file_type == "report" else "policy_sec_"
        return [
            ContentSection(
                id=f"{prefix}{chr(65+i) if file_type == 'report' else i+1}",
                text=p
            ) for i, p in enumerate(paragraphs[:10])
        ]
    except Exception as e:
        print(f"AI Error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý AI: {str(e)}")

async def extract_customer_id_with_ai(text: str) -> str:
    """Trích xuất mã khách hàng từ biên bản sử dụng AI"""
    
    prompt = f"""Từ văn bản biên bản bảo hiểm sau, hãy tìm và trả về MÃ KHÁCH HÀNG hoặc Số HỢP ĐỒNG bảo hiểm.

Các pattern thường gặp:
- "ID: XXX" hoặc "Mã KH: XXX"
- "Số HĐ: XXX" hoặc "Số hợp đồng: XXX"
- "CMND/CCCD: XXX"
- Mã có dạng BH-XXXXX, INS-XXXXX, hoặc số dài

Text biên bản:
{text[:1000]}

Chỉ trả về MÃ KHÁCH HÀNG duy nhất, không giải thích. Nếu không tìm thấy, trả về "UNKNOWN"."""

    try:
        response = model.generate_content(prompt)
        customer_id = response.text.strip()
        
        if customer_id and customer_id != "UNKNOWN" and len(customer_id) > 3:
            return customer_id
        return "UNKNOWN"
    except Exception as e:
        print(f"Error extracting customer ID: {e}")
        return "UNKNOWN"

async def fetch_insurance_policy(customer_id: str) -> PolicyFile:
    """Giả lập lấy hồ sơ bảo hiểm từ database"""
    # Trong thực tế, bạn sẽ query DB tại đây
    # Giả lập đọc file
    file_path = "policy_backend.docx" # Đảm bảo file này tồn tại
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file policy_backend.docx")

    with open(file_path, "rb") as f:
        file_bytes = f.read()
    policy_text = extract_text_from_docx(file_bytes)

    structured_content = await structure_content_with_ai(policy_text, "policy")
    
    return PolicyFile(
        id=f"policy-{customer_id}",
        name=f"Hợp đồng bảo hiểm - {customer_id}.pdf",
        type="application/pdf",
        size=len(file_bytes),
        uploadDate=datetime.now().isoformat(),
        structuredContent=structured_content
    )

async def create_mappings_with_ai(
    report_content: List[ContentSection],
    policy_content: List[ContentSection]
) -> dict:
    """Tạo mapping giữa biên bản và hợp đồng sử dụng AI"""
    
    report_text = "\n\n".join([f"ID: {s.id}\nNội dung: {s.text}" for s in report_content])
    policy_text = "\n\n".join([f"ID: {s.id}\nNội dung: {s.text}" for s in policy_content])
    
    prompt = f"""Bạn là chuyên gia bảo hiểm. Hãy phân tích và tạo liên kết giữa các phần trong BIÊN BẢN và ĐIỀU KHOẢN BẢO HIỂM.

BIÊN BẢN:
{report_text}

HỢP ĐỒNG BẢO HIỂM:
{policy_text}

Nhiệm vụ: Tìm mối liên hệ giữa từng phần trong biên bản với điều khoản tương ứng trong hợp đồng.

Trả về CHÍNH XÁC JSON object với format (không thêm markdown, chỉ JSON thuần):
{{
  "report_sec_A": "policy_sec_1",
  "report_sec_B": "policy_sec_2"
}}

Chỉ tạo mapping cho các cặp có liên quan rõ ràng."""

    try:
        response = model.generate_content(prompt)
        response_text = _clean_json_response(response.text)
        
        mappings = json.loads(response_text)
        
        valid_report_ids = {s.id for s in report_content}
        valid_policy_ids = {s.id for s in policy_content}
        
        filtered_mappings = {
            k: v for k, v in mappings.items()
            if k in valid_report_ids and v in valid_policy_ids
        }
        
        return filtered_mappings
        
    except Exception as e:
        print(f"Error creating mappings: {e}")
        mappings = {}
        for i, report_sec in enumerate(report_content[:len(policy_content)]):
            mappings[report_sec.id] = policy_content[i].id
        return mappings

# ============================================================================
# CORE AI SERVICES (Validation, Plan, Chat)
# ============================================================================

async def get_chat_response(
    message: str, 
    report_content: Optional[List[ContentSection]], 
    policy_content: Optional[List[ContentSection]]
) -> str:
    """Chat với AI về hồ sơ và biên bản"""
    context_parts = []
        
    if report_content:
        report_text = "\n".join([f"- {s.text}" for s in report_content])
        context_parts.append(f"BIÊN BẢN BÁO CÁO:\n{report_text}")
    
    if policy_content:
        policy_text = "\n".join([f"- {s.text}" for s in policy_content])
        context_parts.append(f"HỢP ĐỒNG BẢO HIỂM:\n{policy_text}")
    
    context = "\n\n".join(context_parts)
    
    prompt = f"""Bạn là một AI Teammate (đồng nghiệp AI) chuyên về nghiệp vụ bảo hiểm, 
đang hỗ trợ cho một nhân viên thẩm định (con người).

BỐI CẢNH HỒ SƠ:
{context}

CÂU HỎI TỪ ĐỒNG NGHIỆP:
{message}

NHIỆM VỤ:
Trả lời câu hỏi của đồng nghiệp một cách chuyên nghiệp, súc tích và đi thẳng vào vấn đề.

QUY TẮC ĐỊNH DẠNG (RẤT QUAN TRỌNG):
1.  **Chỉ sử dụng văn bản thuần (plain text).**
2.  Sử dụng ngắt dòng (`\n`) để tách các ý hoặc đoạn văn.
3.  **TUYỆT ĐỐI KHÔNG** sử dụng bất kỳ định dạng Markdown nào (không dùng `**in đậm**`, `*gạch đầu dòng*`, `- gạch đầu dòng`, `# heading`).

Hãy trả lời ngay bây giờ."""

    response = model.generate_content(prompt)
    return response.text

async def validate_claim_with_ai(
    report_content: List[ContentSection],
    policy_content: List[ContentSection],
    mappings: dict,
    customer_id: str
) -> ClaimValidationResult:
    """Validate claim sử dụng AI để kiểm tra tính hợp lệ và tạo checklist"""
    
    report_text = "\n".join([f"[{s.id}] {s.text}" for s in report_content])
    policy_text = "\n".join([f"[{s.id}] {s.text}" for s in policy_content])
    mappings_text = json.dumps(mappings, indent=2)
    
    prompt = f"""Bạn là chuyên gia thẩm định bảo hiểm. Hãy phân tích và đánh giá yêu cầu bồi thường sau:

BIÊN BẢN BÁO CÁO:
{report_text}

HỢP ĐỒNG BẢO HIỂM:
{policy_text}

LIÊN KẾT GIỮA BIÊN BẢN VÀ HỢP ĐỒNG:
{mappings_text}

Nhiệm vụ:
1. Xác định xem **claim có hợp lệ hay không**.
2. Kiểm tra **mức độ đầy đủ của thông tin**.
3. Đưa ra **kết quả cuối cùng** gồm trạng thái, độ tin cậy, số tiền ước tính, và các vấn đề.
4. Phản hồi **duy nhất bằng JSON hợp lệ**, không dùng markdown.

QUAN TRỌNG:
1. Khi tạo "issues", trường "issueType" PHẢI LÀ MỘT TRONG CÁC GIÁ TRỊ SAU:
   "missing_document", "exclusion_clause", "coverage_limit", "expired_policy", "incomplete_info", "conflicting_info"
2. Khi tạo "status" cho mỗi issue: "pass", "fail", "pending".
3. Khi tạo "status" (tổng), PHẢI LÀ MỘT TRONG CÁC GIÁ TRỊ: "approved", "rejected", "needs_more_info", "pending_review".
4. **BẮT BUỘC**: Phải tạo ít nhất 8-12 checklist items, bao gồm CẢ những mục đã PASS và những mục FAIL/PENDING.

Trả về JSON với format (không thêm markdown):
{{
  "status": "approved/rejected/needs_more_info/pending_review",
  "isValid": true/false,
  "confidence": 0.85,
  "estimatedAmount": 50000000,
  "maxCoverageAmount": 100000000,
  "issues": [
    {{
      "issueType": "incomplete_info",
      "severity": "critical/warning/info",
      "status": "pass/fail/pending",
      "checklistItem": "Tên mục kiểm tra cụ thể (VD: Giấy ra viện)",
      "description": "Mô tả chi tiết về mục này - tìm thấy gì, thiếu gì, hoặc vấn đề gì",
      "affectedSections": ["report_sec_A", "policy_sec_1"],
      "recommendation": "Hành động cần thực hiện (VD: Yêu cầu bổ sung giấy ra viện có đóng dấu bệnh viện)"
    }}
  ],
  "summary": "Tóm tắt tổng quan: X/Y tiêu chí đạt, Z tiêu chí cần bổ sung, A tiêu chí không đạt"
}}"""

    try:
        response = model.generate_content(prompt)
        response_text = _clean_json_response(response.text)
        
        result = json.loads(response_text)
        
        validated_issues = []
        for issue_data in result.get("issues", []):
            if "status" not in issue_data:
                issue_data["status"] = "pending"
            if "checklistItem" not in issue_data:
                issue_data["checklistItem"] = issue_data.get("description", "Mục kiểm tra")[:50]
            
            try:
                validated_issues.append(ValidationIssue(**issue_data))
            except Exception as e:
                print(f"⚠️ Skipping invalid issue: {e} | Data: {issue_data}")
                continue
        
        return ClaimValidationResult(
            claimId=f"claim-{customer_id}-{int(datetime.now().timestamp())}",
            status=ClaimStatus(result.get("status", "pending_review")),
            isValid=result.get("isValid", False),
            confidence=result.get("confidence", 0.5),
            estimatedAmount=result.get("estimatedAmount"),
            maxCoverageAmount=result.get("maxCoverageAmount"),            
            issues=validated_issues,
            summary=result.get("summary", "Đang xử lý đánh giá"),
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        print(f"Error validating claim: {e}")
        return ClaimValidationResult(
            claimId=f"claim-{customer_id}-{int(datetime.now().timestamp())}",
            status=ClaimStatus.PENDING_REVIEW,
            isValid=False,
            confidence=0.0,
            estimatedAmount=None,
            maxCoverageAmount=None,
            issues=[
                ValidationIssue(
                    issueType=ValidationIssueType.INCOMPLETE_INFO,
                    severity="critical",
                    status="fail",
                    checklistItem="Lỗi hệ thống",
                    description=f"Lỗi xử lý validation: {str(e)}",
                    affectedSections=[],
                    recommendation="Vui lòng thử lại hoặc liên hệ support"
                )
            ],
            summary="Không thể hoàn thành validation do lỗi hệ thống",
            timestamp=datetime.now().isoformat()
        )

async def suggest_action_plan_with_ai(
    report_content: List[ContentSection],
    policy_content: List[ContentSection],
    validation_result: Optional[ClaimValidationResult],
    customer_id: str
) -> ActionPlan:
    """Suggest action plan sử dụng AI"""
    
    report_text = "\n".join([f"[{s.id}] {s.text}" for s in report_content])
    policy_text = "\n".join([f"[{s.id}] {s.text}" for s in policy_content])
    
    validation_summary = ""
    if validation_result:
        validation_summary = f"""
KẾT QUẢ VALIDATION:
- Status: {validation_result.status}
- Valid: {validation_result.isValid}
- Issues: {len(validation_result.issues)} vấn đề
- Summary: {validation_result.summary}
"""
    
    prompt = f"""Bạn là chuyên gia quản lý claims bảo hiểm. Dựa vào thông tin sau, hãy đề xuất kế hoạch hành động chi tiết:

BIÊN BẢN:
{report_text}

HỢP ĐỒNG:
{policy_text}

{validation_summary}

Nhiệm vụ: Tạo action plan với các bước cụ thể để xử lý claim này. Mỗi action cần:
- Title rõ ràng
- Description chi tiết
- Priority (high/medium/low)
- Estimated time
- Related sections

Trả về JSON với format (không thêm markdown):
{{
  "status": "approved/rejected/needs_more_info/pending_review",
  "actions": [
    {{
      "id": "action_1",
      "title": "Xác minh thông tin khách hàng",
      "description": "Chi tiết cần làm gì",
      "priority": "high/medium/low",
      "dueDate": "2024-12-31",
      "assignee": "Claims Team/Medical Review/Finance",
      "relatedSections": ["report_sec_A", "policy_sec_1"],
      "estimatedTime": "2 hours"
    }}
  ],
  "totalEstimatedTime": "1 day",
  "criticalPath": ["action_1", "action_3"],
  "nextSteps": "Tóm tắt các bước tiếp theo"
}}"""

    try:
        response = model.generate_content(prompt)
        response_text = _clean_json_response(response.text)
        
        result = json.loads(response_text)
        
        actions = [ActionItem(**action) for action in result.get("actions", [])]
        claim_id = validation_result.claimId if validation_result else f"claim-{customer_id}-{int(datetime.now().timestamp())}"
        
        return ActionPlan(
            planId=f"plan-{int(datetime.now().timestamp())}",
            claimId=claim_id,
            status=ClaimStatus(result.get("status", "pending_review")),
            actions=actions,
            totalEstimatedTime=result.get("totalEstimatedTime", "Unknown"),
            criticalPath=result.get("criticalPath", []),
            nextSteps=result.get("nextSteps", "Đang xử lý"),
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        print(f"Error suggesting action plan: {e}")
        claim_id = validation_result.claimId if validation_result else f"claim-{customer_id}-{int(datetime.now().timestamp())}"
        
        return ActionPlan(
            planId=f"plan-{int(datetime.now().timestamp())}",
            claimId=claim_id,
            status=ClaimStatus.PENDING_REVIEW,
            actions=[
                ActionItem(
                    id="action_1",
                    title="Review documents",
                    description="Kiểm tra tất cả tài liệu đính kèm",
                    priority=ActionPriority.HIGH,
                    dueDate=None,
                    assignee="Claims Team",
                    relatedSections=[s.id for s in report_content[:2]],
                    estimatedTime="1 hour"
                )
            ],
            totalEstimatedTime="1 hour",
            criticalPath=["action_1"],
            nextSteps="Bắt đầu review tài liệu",
            timestamp=datetime.now().isoformat()
        )

# ============================================================================
# EXTRA AI SERVICES (Image, Calculation)
# ============================================================================

async def verify_claim_with_image(claim_text: str, image_file: UploadFile) -> str:
    """Service cho endpoint /verify_claim"""
    
    image_data = await image_file.read()
    try:
        img = Image.open(io.BytesIO(image_data))
        if img.mode == 'RGBA' or img.mode == 'P':
             img = img.convert('RGB')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Không thể xử lý file ảnh: {e}")

    try:
        # --- BƯỚC 1: Phân tích ảnh ---
        print("[LOG] Bước 1: Gửi ảnh cho Gemini để phân tích...")
        prompt_parts_1 = [PROMPT_PHAN_TICH_ANH, img]
        response_1 = model.generate_content(prompt_parts_1)
        image_analysis_result = response_1.text
        print("[LOG] Bước 1: Đã có kết quả phân tích ảnh.")

        # --- BƯỚC 2: So sánh, đối chiếu ---
        print("[LOG] Bước 2: Gửi claim và phân tích ảnh để đối chiếu...")
        
        comparison_input_text = f"""
        --- HỒ SƠ YÊU CẦU TỪ KHÁCH HÀNG ---
        {claim_text}
        --- HẾT HỒ SƠ ---
        
        --- BÁO CÁO TỰ ĐỘNG TỪ ẢNH HIỆN TRƯỜNG ---
        {image_analysis_result}
        --- HẾT BÁO CÁO ---
        """
        
        prompt_parts_2 = [PROMPT_SO_SANH_KEYPOINTS, comparison_input_text]
        response_2 = model.generate_content(prompt_parts_2)
        comparison_result = response_2.text
        print("[LOG] Bước 2: Đã có kết quả đối chiếu.")
        
        return comparison_result.strip()

    except Exception as e:
        print(f"[LỖI API GEMINI] {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi gọi API Gemini: {str(e)}")


async def calculate_payout_from_text(contract_text: str) -> dict:
    """Service cho endpoint /calculate_max_payout"""
    
    if not contract_text.strip():
        raise HTTPException(status_code=400, detail="Văn bản 'contract_text' không có nội dung.")

    try:
        print("[LOG] /calculate_max_payout/: Gửi hồ sơ cho Gemini để phân tích...")
        
        prompt = PROMPT_TINH_TOAN_TOI_DA.format(text=contract_text)
        response = model.generate_content(prompt)
        raw_text = response.text.strip()
        print("[LOG] /calculate_max_payout/: Đã có kết quả tính toán.")

        # --- Trích xuất dữ liệu ---
        expected_value_match = re.search(r"expected_value\s*[:=]\s*([\d.,]+)", raw_text, re.IGNORECASE)
        recommended_range_match = re.search(r"recommended_range\s*[:=]\s*(.+)", raw_text, re.IGNORECASE)
        probability_match = re.search(r"probability_of_success\s*[:=]\s*([\d.]+%?)", raw_text, re.IGNORECASE)

        expected_value_num = None
        if expected_value_match:
            try:
                expected_value_str = expected_value_match.group(1).replace(",", "").split(".")[0]
                expected_value_num = int(expected_value_str)
            except ValueError:
                expected_value_num = None

        recommended_range_str = recommended_range_match.group(1).strip() if recommended_range_match else None
        probability_str = probability_match.group(1) if probability_match else None

        data = {
            "expected_value": expected_value_num,
            "recommended_range": recommended_range_str,
            "probability_of_success": probability_str
        }

        # --- Lưu file JSON ---
        os.makedirs("outputs", exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"outputs/ket_qua_tinh_toan_{timestamp}.json"

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

        print(f"[LOG] /calculate_max_payout/: ✅ Đã lưu file JSON -> {output_path}")

        return {
            "message": "✅ Tính toán thành công.",
            "ket_qua_tinh_toan_tu_hop_dong": raw_text,
            "du_lieu_trich_xuat": data
        }

    except Exception as e:
        print(f"[LỖI API GEMINI] {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi gọi API Gemini: {str(e)}")