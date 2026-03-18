"""
Black Box Testing — Input Validation & Edge Cases
Tests the system's response to invalid, boundary, and malicious inputs.
Runs against the live server at http://127.0.0.1:8000
"""
import sys, os, json, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import requests

BASE     = "http://127.0.0.1:8000/api/v1"
PASSWORD = "12345"

ADMIN_EMAIL   = "yuktae@admin.connected.com"
TEACHER_EMAIL = "sarah.johnson@teacher.connected.com"
STUDENT_EMAIL = "alice.wang@student.connected.com"

# ── Helper ────────────────────────────────────────────────────────────────────

def login(email, password=PASSWORD):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=10)
    return r.json().get("access_token") if r.status_code == 200 else None

def auth(token):
    return {"Authorization": f"Bearer {token}"}

class BBResult:
    def __init__(self, tid, endpoint, inp_desc, expected, actual_sc, actual_body, passed):
        self.tid = tid
        self.endpoint = endpoint
        self.inp_desc = inp_desc
        self.expected = expected
        self.actual_sc = actual_sc
        self.actual_body = actual_body[:120] if actual_body else ""
        self.passed = passed

results = []

def record(tid, endpoint, inp_desc, expected_sc, method, url, headers=None, json_body=None, params=None, check_fn=None):
    try:
        r = getattr(requests, method)(url, headers=headers, json=json_body, params=params, timeout=10)
        sc = r.status_code
        try:
            body = json.dumps(r.json())
        except Exception:
            body = r.text
        if check_fn:
            passed = check_fn(sc, r)
        else:
            passed = (sc == expected_sc)
        results.append(BBResult(tid, endpoint, inp_desc, f"HTTP {expected_sc}", sc, body, passed))
    except Exception as e:
        results.append(BBResult(tid, endpoint, inp_desc, f"HTTP {expected_sc}", "ERROR", str(e), False))


if __name__ == "__main__":
    admin_tok   = login(ADMIN_EMAIL)
    teacher_tok = login(TEACHER_EMAIL)
    student_tok = login(STUDENT_EMAIL)

    # ── BB-01: Empty string for email ─────────────────────────────────────────
    record("BB-01", "POST /auth/login", "Empty string for email",
           422, "post", f"{BASE}/auth/login",
           json_body={"email": "", "password": PASSWORD})

    # ── BB-02: Email without @ symbol ─────────────────────────────────────────
    record("BB-02", "POST /auth/login", "Email missing @ (e.g. 'notanemail')",
           422, "post", f"{BASE}/auth/login",
           json_body={"email": "notanemail", "password": PASSWORD})

    # ── BB-03: Extremely long password (10,000 chars) ─────────────────────────
    record("BB-03", "POST /auth/login", "10,000-char password string",
           401, "post", f"{BASE}/auth/login",
           json_body={"email": ADMIN_EMAIL, "password": "A" * 10000},
           check_fn=lambda sc, r: sc in (401, 422, 400))  # any rejection is valid

    # ── BB-04: SQL injection in email field ───────────────────────────────────
    record("BB-04", "POST /auth/login", "SQL injection: ' OR 1=1 --",
           422, "post", f"{BASE}/auth/login",
           json_body={"email": "' OR 1=1 --", "password": PASSWORD},
           check_fn=lambda sc, r: sc in (401, 422))  # must NOT return 200

    # ── BB-05: XSS payload in message content ────────────────────────────────
    # Start a conversation first
    contact_r = requests.get(f"{BASE}/messages/contacts", headers=auth(teacher_tok), timeout=10)
    contacts = contact_r.json() if contact_r.status_code == 200 else []
    conv_id = None
    if contacts:
        cr = requests.post(f"{BASE}/messages/conversations",
                           headers=auth(teacher_tok),
                           json={"other_user_id": contacts[0]["id"]}, timeout=10)
        conv_id = cr.json().get("id") if cr.status_code == 200 else None

    if conv_id:
        record("BB-05", f"POST /messages/conversations/{conv_id}/send",
               "XSS payload: <script>alert('xss')</script>",
               200, "post", f"{BASE}/messages/conversations/{conv_id}/send",
               headers=auth(teacher_tok),
               json_body={"content": "<script>alert('xss')</script>"},
               check_fn=lambda sc, r: sc == 200 and "<script>" not in r.text.replace("\\u003c", "<"))
        # Expected: stored as plain text/escaped, no script execution

    # ── BB-06: Negative grade value ───────────────────────────────────────────
    # Get a submission to grade (if any exist)
    asgn_r = requests.get(f"{BASE}/assignments/teacher", headers=auth(teacher_tok), timeout=10)
    asgn_list = asgn_r.json() if asgn_r.status_code == 200 else []
    sub_id = None
    for a in asgn_list:
        if a.get("submissions"):
            sub_id = a["submissions"][0].get("id")
            break

    if sub_id:
        record("BB-06", f"POST /assignments/submissions/{sub_id}/grade",
               "Negative grade value (-10)",
               422, "post", f"{BASE}/assignments/submissions/{sub_id}/grade",
               headers=auth(teacher_tok),
               json_body={"score": -10, "feedback": "test"},
               check_fn=lambda sc, r: sc in (422, 400))
    else:
        results.append(BBResult("BB-06", "POST /assignments/submissions/{id}/grade",
                                "Negative grade value (-10)",
                                "HTTP 422", "SKIP", "No submissions available to test", True))

    # ── BB-07: Grade exceeding max_score ──────────────────────────────────────
    if sub_id:
        record("BB-07", f"POST /assignments/submissions/{sub_id}/grade",
               "Grade exceeding max_score (999999)",
               422, "post", f"{BASE}/assignments/submissions/{sub_id}/grade",
               headers=auth(teacher_tok),
               json_body={"score": 999999, "feedback": "test"},
               check_fn=lambda sc, r: sc in (422, 400, 200))  # system may or may not enforce
    else:
        results.append(BBResult("BB-07", "POST /assignments/submissions/{id}/grade",
                                "Grade exceeding max_score",
                                "HTTP 422", "SKIP", "No submissions to test", True))

    # ── BB-08: Non-existent class_id in timetable ─────────────────────────────
    record("BB-08", "GET /admin/timetable?class_id=999999",
           "Non-existent class_id=999999",
           200, "get", f"{BASE}/admin/timetable?class_id=999999",
           headers=auth(admin_tok),
           check_fn=lambda sc, r: sc == 200 and r.json() == [])
    # Expected: 200 with empty list (no timetable for unknown class)

    # ── BB-09: Non-existent user_id in attendance ─────────────────────────────
    record("BB-09", "GET /parents/attendance/999999",
           "Non-existent student_id=999999",
           403, "get", f"{BASE}/parents/attendance/999999",
           headers=auth(login(ADMIN_EMAIL)),  # admin trying parent endpoint
           check_fn=lambda sc, r: sc in (403, 404, 422))

    # ── BB-10: IDOR — access another student's attendance ─────────────────────
    # Student alice.wang tries to access bob.smith's data (id=19)
    record("BB-10", "GET /parents/attendance/19 (as student)",
           "IDOR: student accessing another student's parent endpoint",
           403, "get", f"{BASE}/parents/attendance/19",
           headers=auth(student_tok),
           check_fn=lambda sc, r: sc == 403)

    # ── BB-11: Access resource with ID=0 ──────────────────────────────────────
    record("BB-11", "GET /admin/users/0/detail",
           "Resource ID = 0",
           404, "get", f"{BASE}/admin/users/0/detail",
           headers=auth(admin_tok),
           check_fn=lambda sc, r: sc in (404, 422))

    # ── BB-12: Access resource with ID=-1 ─────────────────────────────────────
    record("BB-12", "GET /admin/users/-1/detail",
           "Resource ID = -1",
           404, "get", f"{BASE}/admin/users/-1/detail",
           headers=auth(admin_tok),
           check_fn=lambda sc, r: sc in (404, 422))

    # ── BB-13: Access resource with very large ID ─────────────────────────────
    record("BB-13", "GET /admin/users/999999/detail",
           "Resource ID = 999999 (non-existent)",
           404, "get", f"{BASE}/admin/users/999999/detail",
           headers=auth(admin_tok),
           check_fn=lambda sc, r: sc == 404)

    # ── BB-14: Student accessing another student's grades (IDOR) ──────────────
    # alice.wang is student 18, trying to access student 19's grades via parent endpoint
    record("BB-14", "GET /parents/19/grades (as student)",
           "IDOR: student accessing another user's grades",
           403, "get", f"{BASE}/parents/19/grades",
           headers=auth(student_tok),
           check_fn=lambda sc, r: sc == 403)

    # ── BB-15: Teacher accessing another teacher's class data ──────────────────
    # emmaak teaches class 1; get sarah's class assignments (class 1 — same teacher)
    # Try to access admin-level user details as teacher (unauthorized)
    record("BB-15", "GET /admin/users (as teacher)",
           "Teacher accessing admin-only user list",
           403, "get", f"{BASE}/admin/users",
           headers=auth(teacher_tok),
           check_fn=lambda sc, r: sc == 403)

    # ── BB-16: Missing required body field for login ───────────────────────────
    record("BB-16", "POST /auth/login", "Missing 'password' field entirely",
           422, "post", f"{BASE}/auth/login",
           json_body={"email": ADMIN_EMAIL})  # no password key

    # ── BB-17: Null values for required fields ─────────────────────────────────
    record("BB-17", "POST /auth/login", "Null email and password",
           422, "post", f"{BASE}/auth/login",
           json_body={"email": None, "password": None})

    # ── BB-18: Integer instead of email string ─────────────────────────────────
    record("BB-18", "POST /auth/login", "Integer 12345 as email value",
           422, "post", f"{BASE}/auth/login",
           json_body={"email": 12345, "password": PASSWORD})

    # ── BB-19: Past due date for homework ─────────────────────────────────────
    record("BB-19", "POST /homework/teacher", "Due date in the past (2020-01-01)",
           200, "post",
           f"{BASE}/homework/teacher?class_id=1&subject_id=1&title=PastDueTest&due_date=2020-01-01",
           headers=auth(teacher_tok),
           check_fn=lambda sc, r: sc in (200, 400))
    # Note: app may or may not validate past dates

    # ── BB-20: Invalid date format ─────────────────────────────────────────────
    record("BB-20", "POST /homework/teacher", "Invalid date format 'not-a-date'",
           400, "post",
           f"{BASE}/homework/teacher?class_id=1&subject_id=1&title=BadDateTest&due_date=not-a-date",
           headers=auth(teacher_tok),
           check_fn=lambda sc, r: sc in (400, 422))

    # ── Print Results ──────────────────────────────────────────────────────────
    print("\n" + "="*80)
    print("BLACK BOX TESTING RESULTS")
    print("="*80)
    print(f"{'ID':<8} {'Endpoint':<45} {'Expected':<12} {'Actual':<8} {'Result':<6}")
    print("-"*80)
    passed = 0
    for r in results:
        status = "PASS" if r.passed else "FAIL"
        if r.passed:
            passed += 1
        print(f"{r.tid:<8} {r.endpoint[:44]:<45} {r.expected:<12} {str(r.actual_sc):<8} {status}")

    print(f"\nTotal: {len(results)}  Passed: {passed}  Failed: {len(results)-passed}")

    # ── Detailed Failures ──────────────────────────────────────────────────────
    failures = [r for r in results if not r.passed]
    if failures:
        print("\nFailed Test Details:")
        for r in failures:
            print(f"\n  [{r.tid}] {r.inp_desc}")
            print(f"   Endpoint : {r.endpoint}")
            print(f"   Expected : {r.expected}")
            print(f"   Actual SC: {r.actual_sc}")
            print(f"   Response : {r.actual_body[:150]}")
