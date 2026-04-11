"""
Pydantic v2 schemas for parent-facing API responses.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


# Fees

class ParentPaymentRecord(BaseModel):
    id: int
    date: str
    amount: float
    payment_method: str
    transaction_id: Optional[str]


class ParentFeeStatus(BaseModel):
    has_plan: bool
    status: str              # "paid" | "partial" | "unpaid" | "overdue" | "no_plan"
    total_fee: float
    amount_paid: float
    outstanding_balance: float
    due_date: Optional[str]
    is_overdue: bool
    academic_period: Optional[str]
    payment_history: List[ParentPaymentRecord] = []


# Events

class ParentEventItem(BaseModel):
    id: int
    title: str
    type: str
    start_date: str
    end_date: str
    start_time: Optional[str]
    end_time: Optional[str]
    description: Optional[str]


# Grades

class ParentGradeItem(BaseModel):
    subject: str
    assessment: str
    date: str
    grade: str        # display string, e.g. "85 / 100"
    percentage: float # 0–100


class ParentGradesSummary(BaseModel):
    overall_grade: Optional[str]
    items: List[ParentGradeItem] = []
