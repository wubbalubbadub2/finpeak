"""PDF upload endpoint."""

import os
import tempfile

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_org
from ..models import Organization
from ..schemas import UploadResponse, TransactionOut
from ..services.parsing import process_upload

router = APIRouter(tags=["upload"])


@router.post("/upload", response_model=UploadResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=422, detail="Only PDF files are accepted")

    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=422, detail="File too large (max 10MB)")
        tmp.write(content)
        tmp_path = tmp.name

    try:
        upload_rec, db_txs = process_upload(db, org.id, tmp_path, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing error: {e}")
    finally:
        os.unlink(tmp_path)

    categorized = sum(1 for tx in db_txs if tx.category_name)

    tx_out = []
    for tx in db_txs:
        tx_out.append(TransactionOut(
            id=tx.id,
            date=tx.date,
            doc_number=tx.doc_number,
            debit=float(tx.debit) if tx.debit else None,
            credit=float(tx.credit) if tx.credit else None,
            signed_amount=tx.signed_amount,
            counterparty=tx.counterparty,
            counterparty_bin=tx.counterparty_bin,
            payment_description=tx.payment_description,
            knp=tx.knp,
            category_name=tx.category_name,
            category_confidence=tx.category_confidence,
            activity_type=tx.activity_type,
            direction=tx.direction,
            categorization_source=tx.categorization_source,
            bank=upload_rec.bank,
            account_number=upload_rec.account_number,
        ))

    return UploadResponse(
        file_id=upload_rec.id,
        filename=file.filename,
        bank=upload_rec.bank,
        account_number=upload_rec.account_number,
        period_start=upload_rec.period_start,
        period_end=upload_rec.period_end,
        transaction_count=len(db_txs),
        categorized_count=categorized,
        transactions=tx_out,
    )
