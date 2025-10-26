import json
import os
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, HTTPException, Form

# Import models
from models import (
    ProcessedReport, ChatRequest, ChatResponse, ClaimValidationResult,
    ActionPlan, ValidateClaimRequest, SuggestPlanRequest, CalculatePayoutRequest
)

# Import services
import services
import utils

# Khởi tạo Router
router = APIRouter()

# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.post("/upload-report", response_model=ProcessedReport)
async def upload_report(file: UploadFile = File(...)):
    """Upload biên bản báo cáo và xử lý với AI"""
    try:
        file_bytes = await file.read()
        text = utils.extract_text_from_file(file, file_bytes)
        
        if not text or len(text) < 50:
            raise HTTPException(status_code=400, detail="File không chứa đủ nội dung để xử lý")
        
        report_content = await services.structure_content_with_ai(text, "report")
        customer_id = await services.extract_customer_id_with_ai(text)
        policy = await services.fetch_insurance_policy(customer_id)
        mappings = await services.create_mappings_with_ai(report_content, policy.structuredContent)
        
        return ProcessedReport(
            reportId=f"report-{datetime.now().timestamp()}",
            reportName=file.filename,
            reportType=file.content_type,
            reportSize=len(file_bytes),
            reportContent=report_content,
            customerId=customer_id,
            policy=policy,
            mappings=mappings
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Lỗi /upload-report: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý file: {str(e)}")

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat với AI về hồ sơ và biên bản"""
    try:
        response_text = await services.get_chat_response(
            request.message,
            request.reportContent,
            request.policyContent
        )
        
        return ChatResponse(
            response=response_text,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        print(f"Lỗi /chat: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý chat: {str(e)}")

@router.post("/verify_claim")
async def verify_claim_with_gemini_endpoint(
    claim_text: str = Form(...),
    file_anh: UploadFile = File(..., description="File ảnh (.jpg, .png) làm bằng chứng.")
):
    """Đối chiếu văn bản claim với bằng chứng hình ảnh"""
    try:
        result = await services.verify_claim_with_image(claim_text, file_anh)
        return {"ket_qua_doi_chieu": result}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Lỗi /verify_claim: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý verify_claim: {str(e)}")

@router.post("/calculate_max_payout/", summary="Tính toán số tiền chi trả dự kiến từ hợp đồng")
async def calculate_max_payout_from_contract_endpoint(
    request: CalculatePayoutRequest
):
    """Tính toán số tiền chi trả tối đa dựa trên văn bản"""
    try:
        result = await services.calculate_payout_from_text(request.contract_text)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Lỗi /calculate_max_payout: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý calculate_max_payout: {str(e)}")

@router.post("/validate-claim", response_model=ClaimValidationResult)
async def validate_claim(request: ValidateClaimRequest):
    """Validate claim - Kiểm tra tính hợp lệ của yêu cầu bồi thường"""
    try:
        validation_result = await services.validate_claim_with_ai(
            report_content=request.reportContent,
            policy_content=request.policyContent,
            mappings=request.mappings,
            customer_id=request.customerId
        )
        return validation_result
    except Exception as e:
        print(f"Lỗi /validate-claim: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi validate claim: {str(e)}")

@router.post("/suggest-plan", response_model=ActionPlan)
async def suggest_plan(request: SuggestPlanRequest):
    """Suggest action plan - Đề xuất kế hoạch hành động xử lý claim"""
    try:
        action_plan = await services.suggest_action_plan_with_ai(
            report_content=request.reportContent,
            policy_content=request.policyContent,
            validation_result=request.validationResult,
            customer_id=request.customerId
        )
        return action_plan
    except Exception as e:
        print(f"Lỗi /suggest-plan: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi suggest plan: {str(e)}")

@router.post("/full-analysis", response_model=dict)
async def full_analysis(request: ValidateClaimRequest):
    """Full analysis - Phân tích toàn diện claim (validation + action plan)"""
    try:
        # Step 1: Validate claim
        validation_result = await services.validate_claim_with_ai(
            report_content=request.reportContent,
            policy_content=request.policyContent,
            mappings=request.mappings,
            customer_id=request.customerId
        )
        
        # Step 2: Generate action plan based on validation
        action_plan = await services.suggest_action_plan_with_ai(
            report_content=request.reportContent,
            policy_content=request.policyContent,
            validation_result=validation_result,
            customer_id=request.customerId
        )
        
        return {
            "validation": validation_result.dict(),
            "actionPlan": action_plan.dict(),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Lỗi /full-analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi full analysis: {str(e)}")

@router.get("/claim-status/{claim_id}")
async def get_claim_status(claim_id: str):
    """(Demo) Lấy trạng thái hiện tại của claim"""
    return {
        "claimId": claim_id,
        "status": "pending_review",
        "lastUpdated": datetime.now().isoformat(),
        "assignedTo": "Claims Team",
        "progress": 45,
        "message": "Đang chờ bổ sung tài liệu"
    }

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
        "features": [
            "upload-report",
            "chat",
            "validate-claim",
            "suggest-plan",
            "full-analysis"
        ]
    }