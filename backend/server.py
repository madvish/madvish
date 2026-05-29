from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Default categories + keyword classifier
# ---------------------------------------------------------------------------
DEFAULT_CATEGORIES = [
    {"name": "Eating Out", "icon": "burger"},
    {"name": "Groceries", "icon": "cart"},
    {"name": "Travel", "icon": "car"},
    {"name": "Shopping", "icon": "bag"},
    {"name": "Entertainment", "icon": "film"},
    {"name": "Mobile & Internet", "icon": "phone"},
    {"name": "Utilities", "icon": "bulb"},
    {"name": "Miscellaneous", "icon": "box"},
]

DEFAULT_KEYWORDS = {
    "Eating Out": ["swiggy", "zomato", "chai", "samosa", "restaurant", "cafe", "coffee",
                   "pizza", "dominos", "mcdonald", "kfc", "burger", "biryani", "lunch",
                   "dinner", "breakfast", "snack", "dosa", "tea", "starbucks", "food",
                   "dhaba", "hotel", "eat", "meal", "juice", "icecream", "bakery"],
    "Groceries": ["grocery", "groceries", "bigbasket", "dmart", "blinkit", "zepto",
                  "instamart", "vegetables", "veggies", "milk", "supermarket", "kirana",
                  "fruits", "ration", "provision"],
    "Travel": ["uber", "ola", "rapido", "metro", "petrol", "diesel", "fuel", "bus",
               "train", "irctc", "cab", "auto", "rickshaw", "flight", "indigo", "toll",
               "parking", "redbus", "travel", "taxi"],
    "Shopping": ["amazon", "flipkart", "myntra", "ajio", "shopping", "store", "mall",
                 "clothes", "shoes", "nykaa", "meesho", "decathlon", "ikea", "shirt"],
    "Entertainment": ["netflix", "movie", "bookmyshow", "spotify", "hotstar", "cinema",
                      "pvr", "inox", "game", "gaming", "prime", "youtube", "concert",
                      "subscription", "playstation"],
    "Mobile & Internet": ["recharge", "jio", "airtel", "vi", "vodafone", "mobile",
                         "internet", "broadband", "wifi", "data", "postpaid", "prepaid",
                         "act fibernet", "fiber"],
    "Utilities": ["electricity", "water", "gas", "bill", "rent", "dth", "tata power",
                  "maintenance", "cylinder", "lpg", "bescom", "society"],
    "Miscellaneous": [],
}

WALLET_KEYWORDS = {
    "upi_lite": ["upi lite", "upi-lite", "upilite"],
    "paytm": ["paytm wallet", "paytm"],
}


def now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    icon: str
    type: str = "expense"
    isDefault: bool = True


class CategoryCreate(BaseModel):
    user_id: str
    name: str
    icon: str = "box"
    type: str = "expense"


class Expense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: float
    description: str = ""
    categoryId: Optional[str] = None
    date: int = Field(default_factory=now_ms)
    note: str = ""
    paymentMethod: str = "cash"  # cash | upi_lite | paytm
    source: str = "manual"  # manual | sms
    smsReference: Optional[str] = None
    isWalletSpend: bool = False
    linkedWalletLoadId: Optional[str] = None
    reviewed: bool = True
    merchant: Optional[str] = None
    clientId: Optional[str] = None


class ExpenseCreate(BaseModel):
    user_id: str
    amount: float
    description: str = ""
    categoryId: Optional[str] = None
    date: Optional[int] = None
    note: str = ""
    paymentMethod: str = "cash"
    source: str = "manual"
    smsReference: Optional[str] = None
    merchant: Optional[str] = None
    clientId: Optional[str] = None


class ExpenseUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    categoryId: Optional[str] = None
    note: Optional[str] = None
    paymentMethod: Optional[str] = None
    reviewed: Optional[bool] = None


class WalletLoad(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: float
    walletType: str  # upi_lite | paytm
    date: int = Field(default_factory=now_ms)
    smsReference: Optional[str] = None
    status: str = "unresolved"  # unresolved | partially_allocated | fully_allocated
    clientId: Optional[str] = None


class WalletLoadCreate(BaseModel):
    user_id: str
    amount: float
    walletType: str
    date: Optional[int] = None
    smsReference: Optional[str] = None
    clientId: Optional[str] = None


class ParseRequest(BaseModel):
    user_id: str
    text: str


class SmsIngestRequest(BaseModel):
    user_id: str
    text: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def ensure_seeded(user_id: str):
    """Idempotently seed default categories + classifier for a user."""
    count = await db.categories.count_documents({"user_id": user_id})
    if count == 0:
        cats = []
        name_to_id = {}
        for c in DEFAULT_CATEGORIES:
            cat = Category(user_id=user_id, name=c["name"], icon=c["icon"])
            doc = cat.model_dump()
            cats.append(doc)
            name_to_id[c["name"]] = cat.id
        await db.categories.insert_many(cats)
        # seed classifier keyword -> category id
        kw_docs = []
        for cat_name, words in DEFAULT_KEYWORDS.items():
            cid = name_to_id.get(cat_name)
            for w in words:
                kw_docs.append({"user_id": user_id, "keyword": w.lower(), "categoryId": cid})
        if kw_docs:
            await db.classifier.insert_many(kw_docs)


async def get_misc_category_id(user_id: str) -> Optional[str]:
    doc = await db.categories.find_one({"user_id": user_id, "name": "Miscellaneous"}, {"_id": 0})
    return doc["id"] if doc else None


async def predict_category(user_id: str, text: str) -> Optional[str]:
    """Keyword-based classifier. Returns categoryId or Miscellaneous."""
    text_l = (text or "").lower()
    # longer keywords first for specificity
    rows = await db.classifier.find({"user_id": user_id}, {"_id": 0}).to_list(2000)
    rows.sort(key=lambda r: len(r["keyword"]), reverse=True)
    for r in rows:
        if r["keyword"] and re.search(r"\b" + re.escape(r["keyword"]) + r"\b", text_l):
            return r["categoryId"]
    return await get_misc_category_id(user_id)


async def learn_keyword(user_id: str, text: str, category_id: str):
    """Learn from user correction: map salient words from text to chosen category."""
    if not category_id or not text:
        return
    stop = {"and", "for", "the", "a", "an", "to", "of", "at", "in", "on", "with",
            "rs", "inr", "paid", "bought", "spent"}
    words = re.findall(r"[a-zA-Z]+", text.lower())
    for w in words:
        if len(w) < 3 or w in stop:
            continue
        existing = await db.classifier.find_one({"user_id": user_id, "keyword": w})
        if existing:
            await db.classifier.update_one(
                {"user_id": user_id, "keyword": w}, {"$set": {"categoryId": category_id}}
            )
        else:
            await db.classifier.insert_one(
                {"user_id": user_id, "keyword": w, "categoryId": category_id}
            )


def extract_amount(text: str) -> Optional[float]:
    """Extract first monetary amount from text."""
    if not text:
        return None
    cleaned = text.replace(",", "")
    # rs / ₹ / inr prefixed numbers preferred
    m = re.search(r"(?:rs\.?|₹|inr)\s*([0-9]+(?:\.[0-9]{1,2})?)", cleaned, re.IGNORECASE)
    if m:
        return float(m.group(1))
    m = re.search(r"([0-9]+(?:\.[0-9]{1,2})?)", cleaned)
    if m:
        return float(m.group(1))
    return None


def extract_description(text: str) -> str:
    """Strip the leading amount + currency words, keep the rest as description."""
    if not text:
        return ""
    desc = re.sub(r"(?:rs\.?|₹|inr)", " ", text, flags=re.IGNORECASE)
    desc = re.sub(r"[0-9]+(?:[.,][0-9]+)?", " ", desc)
    stop_lead = r"^(?:\s*(?:for|on|spent|paid|bought|at)\s+)+"
    desc = re.sub(stop_lead, "", desc.strip(), flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", desc).strip()


def detect_wallet_type(text: str) -> Optional[str]:
    tl = (text or "").lower()
    for wtype, kws in WALLET_KEYWORDS.items():
        for kw in kws:
            if kw in tl:
                return wtype
    return None


def parse_sms(text: str):
    """Parse a bank/UPI SMS. Returns dict with kind/amount/merchant/reference/walletType."""
    tl = (text or "").lower()
    amount = extract_amount(text)
    wallet_type = detect_wallet_type(text)
    is_load = wallet_type is not None and ("load" in tl or "added" in tl or "wallet" in tl)
    is_debit = any(k in tl for k in ["debited", "debit", "spent", "paid", "sent", "purchase", "txn"])

    # transaction reference
    ref = None
    mref = re.search(r"(?:ref(?:erence)?\s*(?:no\.?|number)?\s*[:#]?\s*|upi[:\s]*|txn[:\s]*|rrn[:\s]*)([a-zA-Z0-9]{6,})", text, re.IGNORECASE)
    if mref:
        ref = mref.group(1)

    # merchant: text after "to" / "for" / "at"
    merchant = None
    mm = re.search(r"(?:to|at|for)\s+([A-Za-z][A-Za-z0-9&.\-' ]{2,30})", text)
    if mm:
        merchant = mm.group(1).strip().rstrip(".")
        merchant = re.sub(r"\b(via|on|avl|bal|a/c|ac|upi|ref|txn|rrn|dated)\b.*$", "", merchant, flags=re.IGNORECASE).strip()

    kind = "wallet_load" if is_load else "expense"
    return {
        "kind": kind,
        "amount": amount,
        "merchant": merchant,
        "reference": ref,
        "walletType": wallet_type,
        "isDebit": is_debit or is_load,
    }


async def recalc_wallet_status(user_id: str, load_id: str):
    load = await db.wallet_loads.find_one({"id": load_id, "user_id": user_id}, {"_id": 0})
    if not load:
        return
    linked = await db.expenses.find(
        {"user_id": user_id, "linkedWalletLoadId": load_id}, {"_id": 0}
    ).to_list(1000)
    allocated = sum(e["amount"] for e in linked)
    if allocated <= 0:
        status = "unresolved"
    elif allocated >= load["amount"] - 0.001:
        status = "fully_allocated"
    else:
        status = "partially_allocated"
    await db.wallet_loads.update_one(
        {"id": load_id, "user_id": user_id}, {"$set": {"status": status}}
    )


async def link_wallet(user_id: str, expense: dict):
    """Link a wallet spend to the most recent non-fully-allocated load of that type."""
    wtype = "upi_lite" if expense["paymentMethod"] == "upi_lite" else "paytm"
    load = await db.wallet_loads.find_one(
        {"user_id": user_id, "walletType": wtype, "status": {"$ne": "fully_allocated"}},
        {"_id": 0}, sort=[("date", -1)],
    )
    if load:
        expense["linkedWalletLoadId"] = load["id"]
    return load["id"] if load else None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "Flow API"}


@api_router.post("/seed")
async def seed(user_id: str = Query(...)):
    await ensure_seeded(user_id)
    return {"ok": True}


@api_router.get("/categories", response_model=List[Category])
async def get_categories(user_id: str = Query(...)):
    await ensure_seeded(user_id)
    rows = await db.categories.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    return [Category(**r) for r in rows]


@api_router.post("/categories", response_model=Category)
async def create_category(body: CategoryCreate):
    cat = Category(user_id=body.user_id, name=body.name, icon=body.icon,
                   type=body.type, isDefault=False)
    await db.categories.insert_one(cat.model_dump())
    return cat


@api_router.post("/parse")
async def parse(body: ParseRequest):
    await ensure_seeded(body.user_id)
    amount = extract_amount(body.text)
    desc = extract_description(body.text)
    cat_id = await predict_category(body.user_id, body.text)
    return {"amount": amount, "description": desc, "categoryId": cat_id}


@api_router.post("/parse-sms")
async def parse_sms_route(body: ParseRequest):
    await ensure_seeded(body.user_id)
    parsed = parse_sms(body.text)
    cat_id = None
    if parsed["kind"] == "expense":
        cat_text = " ".join(filter(None, [parsed.get("merchant"), body.text]))
        cat_id = await predict_category(body.user_id, cat_text)
    parsed["categoryId"] = cat_id
    return parsed


@api_router.post("/expenses", response_model=Expense)
async def create_expense(body: ExpenseCreate):
    await ensure_seeded(body.user_id)
    # Idempotency: if this clientId was already inserted (e.g. a retried
    # request after a lost response), return the existing record.
    if body.clientId:
        existing = await db.expenses.find_one(
            {"user_id": body.user_id, "clientId": body.clientId}, {"_id": 0}
        )
        if existing:
            return Expense(**existing)
    is_wallet = body.paymentMethod in ("upi_lite", "paytm")
    cat_id = body.categoryId
    if not cat_id:
        cat_id = await predict_category(body.user_id, f"{body.description} {body.note} {body.merchant or ''}")
    exp = Expense(
        user_id=body.user_id,
        amount=body.amount,
        description=body.description,
        categoryId=cat_id,
        date=body.date if body.date else now_ms(),
        note=body.note,
        paymentMethod=body.paymentMethod,
        source=body.source,
        smsReference=body.smsReference,
        isWalletSpend=is_wallet,
        reviewed=(body.source != "sms"),
        merchant=body.merchant,
        clientId=body.clientId,
    )
    doc = exp.model_dump()
    linked_id = None
    if is_wallet:
        linked_id = await link_wallet(body.user_id, doc)
    await db.expenses.insert_one(doc)
    if linked_id:
        await recalc_wallet_status(body.user_id, linked_id)
    # learn from explicit category selection
    if body.categoryId and body.description:
        await learn_keyword(body.user_id, body.description, body.categoryId)
    return Expense(**{k: v for k, v in doc.items() if k != "_id"})


@api_router.get("/expenses", response_model=List[Expense])
async def list_expenses(
    user_id: str = Query(...),
    start: Optional[int] = None,
    end: Optional[int] = None,
    reviewed_only: bool = False,
):
    q = {"user_id": user_id}
    if start is not None or end is not None:
        q["date"] = {}
        if start is not None:
            q["date"]["$gte"] = start
        if end is not None:
            q["date"]["$lte"] = end
    if reviewed_only:
        q["$or"] = [{"source": {"$ne": "sms"}}, {"reviewed": True}]
    rows = await db.expenses.find(q, {"_id": 0}).sort("date", -1).to_list(5000)
    return [Expense(**r) for r in rows]


@api_router.patch("/expenses/{expense_id}", response_model=Expense)
async def update_expense(expense_id: str, body: ExpenseUpdate, user_id: str = Query(...)):
    exp = await db.expenses.find_one({"id": expense_id, "user_id": user_id}, {"_id": 0})
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    category_changed = "categoryId" in updates and updates["categoryId"] != exp.get("categoryId")
    if "paymentMethod" in updates:
        updates["isWalletSpend"] = updates["paymentMethod"] in ("upi_lite", "paytm")
    if updates:
        await db.expenses.update_one({"id": expense_id, "user_id": user_id}, {"$set": updates})
    # learn from correction
    if category_changed and updates.get("categoryId"):
        await learn_keyword(user_id, exp.get("description", "") or exp.get("merchant", "") or "", updates["categoryId"])
    if exp.get("linkedWalletLoadId"):
        await recalc_wallet_status(user_id, exp["linkedWalletLoadId"])
    new = await db.expenses.find_one({"id": expense_id, "user_id": user_id}, {"_id": 0})
    return Expense(**new)


@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user_id: str = Query(...)):
    exp = await db.expenses.find_one({"id": expense_id, "user_id": user_id}, {"_id": 0})
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    await db.expenses.delete_one({"id": expense_id, "user_id": user_id})
    if exp.get("linkedWalletLoadId"):
        await recalc_wallet_status(user_id, exp["linkedWalletLoadId"])
    return {"ok": True}


@api_router.get("/pending-review", response_model=List[Expense])
async def pending_review(user_id: str = Query(...)):
    rows = await db.expenses.find(
        {"user_id": user_id, "source": "sms", "reviewed": False}, {"_id": 0}
    ).sort("date", -1).to_list(1000)
    return [Expense(**r) for r in rows]


@api_router.post("/wallet-loads", response_model=WalletLoad)
async def create_wallet_load(body: WalletLoadCreate):
    await ensure_seeded(body.user_id)
    if body.clientId:
        existing = await db.wallet_loads.find_one(
            {"user_id": body.user_id, "clientId": body.clientId}, {"_id": 0}
        )
        if existing:
            return WalletLoad(**existing)
    load = WalletLoad(
        user_id=body.user_id, amount=body.amount, walletType=body.walletType,
        date=body.date if body.date else now_ms(), smsReference=body.smsReference,
        clientId=body.clientId,
    )
    await db.wallet_loads.insert_one(load.model_dump())
    return load


@api_router.get("/wallet-loads")
async def list_wallet_loads(user_id: str = Query(...)):
    rows = await db.wallet_loads.find({"user_id": user_id}, {"_id": 0}).sort("date", -1).to_list(1000)
    result = []
    for r in rows:
        linked = await db.expenses.find(
            {"user_id": user_id, "linkedWalletLoadId": r["id"]}, {"_id": 0}
        ).sort("date", -1).to_list(1000)
        allocated = sum(e["amount"] for e in linked)
        result.append({
            **r,
            "allocated": round(allocated, 2),
            "remaining": round(r["amount"] - allocated, 2),
            "linkedExpenses": linked,
        })
    return result


@api_router.post("/sms/ingest")
async def sms_ingest(body: SmsIngestRequest):
    await ensure_seeded(body.user_id)
    parsed = parse_sms(body.text)
    if parsed["amount"] is None:
        raise HTTPException(status_code=422, detail="Could not extract amount from SMS")

    ref = parsed.get("reference")
    # duplicate prevention by reference
    if ref:
        dup_exp = await db.expenses.find_one({"user_id": body.user_id, "smsReference": ref}, {"_id": 0})
        dup_load = await db.wallet_loads.find_one({"user_id": body.user_id, "smsReference": ref}, {"_id": 0})
        if dup_exp or dup_load:
            return {"duplicate": True, "kind": parsed["kind"]}

    if parsed["kind"] == "wallet_load":
        load = WalletLoad(
            user_id=body.user_id, amount=parsed["amount"],
            walletType=parsed["walletType"], smsReference=ref,
        )
        await db.wallet_loads.insert_one(load.model_dump())
        return {"duplicate": False, "kind": "wallet_load", "record": WalletLoad(**load.model_dump()).model_dump()}

    cat_id = await predict_category(body.user_id, f"{parsed.get('merchant') or ''} {body.text}")
    exp = Expense(
        user_id=body.user_id, amount=parsed["amount"],
        description=parsed.get("merchant") or "SMS Transaction",
        categoryId=cat_id, source="sms", smsReference=ref, reviewed=False,
        merchant=parsed.get("merchant"),
    )
    await db.expenses.insert_one(exp.model_dump())
    return {"duplicate": False, "kind": "expense", "record": Expense(**exp.model_dump()).model_dump()}


def month_bounds(year: int, month: int):
    start = int(datetime(year, month, 1, tzinfo=timezone.utc).timestamp() * 1000)
    if month == 12:
        end = int(datetime(year + 1, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
    else:
        end = int(datetime(year, month + 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
    return start, end


async def build_report(user_id: str, start: int, end: int):
    cats = await db.categories.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    cat_map = {c["id"]: c for c in cats}
    rows = await db.expenses.find({
        "user_id": user_id,
        "date": {"$gte": start, "$lt": end},
        "$or": [{"source": {"$ne": "sms"}}, {"reviewed": True}],
    }, {"_id": 0}).sort("date", -1).to_list(5000)

    total = sum(r["amount"] for r in rows)
    by_cat = {}
    sms_total = 0.0
    manual_total = 0.0
    for r in rows:
        cid = r.get("categoryId") or "uncategorized"
        by_cat.setdefault(cid, 0.0)
        by_cat[cid] += r["amount"]
        if r.get("source") == "sms":
            sms_total += r["amount"]
        else:
            manual_total += r["amount"]

    breakdown = []
    for cid, amt in sorted(by_cat.items(), key=lambda x: x[1], reverse=True):
        cat = cat_map.get(cid, {"name": "Uncategorized", "icon": "box"})
        breakdown.append({
            "categoryId": cid,
            "name": cat["name"],
            "icon": cat["icon"],
            "amount": round(amt, 2),
            "percent": round((amt / total * 100), 1) if total > 0 else 0,
        })
    return {
        "total": round(total, 2),
        "count": len(rows),
        "breakdown": breakdown,
        "transactions": rows,
        "smsTotal": round(sms_total, 2),
        "manualTotal": round(manual_total, 2),
    }


@api_router.get("/dashboard")
async def dashboard(user_id: str = Query(...), year: Optional[int] = None, month: Optional[int] = None):
    await ensure_seeded(user_id)
    now = datetime.now(timezone.utc)
    year = year or now.year
    month = month or now.month
    start, end = month_bounds(year, month)
    report = await build_report(user_id, start, end)

    # daily average based on days elapsed (current month) or days in month
    if year == now.year and month == now.month:
        days = now.day
    else:
        days = (datetime.fromtimestamp(end / 1000, tz=timezone.utc) -
                datetime.fromtimestamp(start / 1000, tz=timezone.utc)).days
    daily_avg = round(report["total"] / days, 2) if days > 0 else 0

    return {
        "month": month,
        "year": year,
        "total": report["total"],
        "dailyAverage": daily_avg,
        "topCategories": report["breakdown"][:3],
        "breakdown": report["breakdown"],
        "smsTotal": report["smsTotal"],
        "manualTotal": report["manualTotal"],
        "recent": report["transactions"][:5],
        "count": report["count"],
    }


@api_router.get("/reports")
async def reports(
    user_id: str = Query(...),
    period: str = "monthly",
    year: Optional[int] = None,
    month: Optional[int] = None,
    start: Optional[int] = None,
    end: Optional[int] = None,
):
    await ensure_seeded(user_id)
    now = datetime.now(timezone.utc)
    if period == "monthly":
        year = year or now.year
        month = month or now.month
        s, e = month_bounds(year, month)
    elif period == "yearly":
        year = year or now.year
        s = int(datetime(year, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
        e = int(datetime(year + 1, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
    else:  # custom
        if start is None or end is None:
            raise HTTPException(status_code=422, detail="start and end required for custom range")
        s, e = start, end
    return await build_report(user_id, s, e)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
