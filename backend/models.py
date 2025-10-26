from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Literal
from enum import Enum

# ============================================================================
# ENUMS
# ============================================================================

class ClaimStatus(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_MORE_INFO = "needs_more_info"
    PENDING_REVIEW = "pending_review"

class ValidationIssueType(str, Enum):
    MISSING_DOCUMENT = "missing_document"
    EXCLUSION_CLAUSE = "exclusion_clause"
    COVERAGE_LIMIT = "coverage_limit"
    EXPIRED_POLICY = "expired_policy"
    INCOMPLETE_INFO = "incomplete_info"
    CONFLICTING_INFO = "conflicting_info"

class ActionPriority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ContentSection(BaseModel):
    id: str
    text: str

class PolicyFile(BaseModel):
    id: str
    name: str
    type: str
    size: int
    uploadDate: str
    structuredContent: List[ContentSection]

class ProcessedReport(BaseModel):
    reportId: str
    reportName: str
    reportType: str
    reportSize: int
    reportContent: List[ContentSection]
    customerId: str
    policy: PolicyFile
    mappings: Dict[str, str]

class ChatRequest(BaseModel):   
    message: str
    reportContent: Optional[List[ContentSection]] = None
    policyContent: Optional[List[ContentSection]] = None

class ChatResponse(BaseModel):
    response: str
    timestamp: str

class ValidationIssue(BaseModel):
    issueType: ValidationIssueType
    severity: str  # "critical", "warning", "info"
    status: str  # "pass/fail/pending"
    checklistItem: str # Tên mục kiểm tra cụ thể
    description: str
    affectedSections: List[str]
    recommendation: str 

class VerificationChecklistItem(BaseModel):
    checklistItem: str
    status: Literal["met", "unmet"]
    details: str
    affectedSections: List[str]

class ClaimValidationResult(BaseModel):
    claimId: str
    status: ClaimStatus
    isValid: bool
    confidence: float
    estimatedAmount: Optional[float] = None
    maxCoverageAmount: Optional[float] = None
    issues: List[ValidationIssue]
    summary: str
    timestamp: str

class ActionItem(BaseModel):
    id: str
    title: str
    description: str
    priority: ActionPriority
    dueDate: Optional[str] = None
    assignee: Optional[str] = None
    relatedSections: List[str]
    estimatedTime: str

class ActionPlan(BaseModel):
    planId: str
    claimId: str
    status: ClaimStatus
    actions: List[ActionItem]
    totalEstimatedTime: str
    criticalPath: List[str]
    nextSteps: str
    timestamp: str

class ValidateClaimRequest(BaseModel):
    reportContent: List[ContentSection]
    policyContent: List[ContentSection]
    mappings: Dict[str, str]
    customerId: str

class SuggestPlanRequest(BaseModel):
    reportContent: List[ContentSection]
    policyContent: List[ContentSection]
    validationResult: Optional[ClaimValidationResult] = None
    customerId: str

class CalculatePayoutRequest(BaseModel):
    contract_text: str