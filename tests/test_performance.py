"""
Performance Testing — API Response Times
Makes 10 sequential requests per endpoint and records timing statistics.
"""
import requests
import time
import json
import statistics

BASE     = "http://127.0.0.1:8000/api/v1"
PASSWORD = "12345"
N_RUNS   = 10

def login(email):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": PASSWORD}, timeout=15)
    return r.json().get("access_token") if r.status_code == 200 else None

def auth(token):
    return {"Authorization": f"Bearer {token}"}

# Pre-obtain tokens
admin_tok   = login("yuktae@admin.connected.com")
teacher_tok = login("sarah.johnson@teacher.connected.com")
student_tok = login("alice.wang@student.connected.com")
parent_tok  = login("john.smith@parent.connected.com")


def bench(label, method, url, headers=None, json_body=None, n=N_RUNS, threshold_ms=500):
    times = []
    status_codes = []
    for _ in range(n):
        start = time.perf_counter()
        r = getattr(requests, method)(url, headers=headers, json=json_body, timeout=15)
        end = time.perf_counter()
        times.append((end - start) * 1000)
        status_codes.append(r.status_code)
    avg = statistics.mean(times)
    mn  = min(times)
    mx  = max(times)
    med = statistics.median(times)
    under = avg < threshold_ms
    return {
        "label": label,
        "url": url.replace(BASE, ""),
        "method": method.upper(),
        "n": n,
        "avg_ms": round(avg, 1),
        "min_ms": round(mn, 1),
        "max_ms": round(mx, 1),
        "median_ms": round(med, 1),
        "under_500ms": under,
        "status_codes": list(set(status_codes)),
    }


if __name__ == "__main__":
    print("Running performance tests (10 requests per endpoint)...\n")

    tests = [
        bench("POST /auth/login", "post", f"{BASE}/auth/login",
              json_body={"email": "yuktae@admin.connected.com", "password": PASSWORD}),
        bench("GET /auth/me", "get", f"{BASE}/auth/me",
              headers=auth(admin_tok)),
        bench("GET /teachers/timetable", "get", f"{BASE}/teachers/timetable",
              headers=auth(teacher_tok)),
        bench("GET /students/timetable", "get", f"{BASE}/students/timetable",
              headers=auth(student_tok)),
        bench("GET /students/attendance", "get", f"{BASE}/students/attendance",
              headers=auth(student_tok)),
        bench("GET /admin/dashboard", "get", f"{BASE}/admin/dashboard",
              headers=auth(admin_tok)),
        bench("GET /messages/conversations", "get", f"{BASE}/messages/conversations",
              headers=auth(teacher_tok)),
        bench("GET /homework/student", "get", f"{BASE}/homework/student",
              headers=auth(student_tok)),
        bench("GET /assignments/student", "get", f"{BASE}/assignments/student",
              headers=auth(student_tok)),
        bench("GET /parents/19/grades", "get", f"{BASE}/parents/19/grades",
              headers=auth(parent_tok)),
        bench("GET /admin/users", "get", f"{BASE}/admin/users",
              headers=auth(admin_tok)),
        bench("GET /teachers/stats", "get", f"{BASE}/teachers/stats",
              headers=auth(teacher_tok)),
    ]

    # Print table
    print(f"{'Endpoint':<40} {'Method':<8} {'Avg(ms)':<10} {'Min(ms)':<10} {'Max(ms)':<10} {'Median':<10} {'<500ms?':<8} {'Status'}")
    print("-"*110)
    for t in tests:
        flag = "YES" if t["under_500ms"] else "NO "
        sc   = str(t["status_codes"])
        print(f"{t['label']:<40} {t['method']:<8} {t['avg_ms']:<10} {t['min_ms']:<10} {t['max_ms']:<10} {t['median_ms']:<10} {flag:<8} {sc}")

    # Summary
    passing = sum(1 for t in tests if t["under_500ms"])
    print(f"\nEndpoints under 500ms: {passing}/{len(tests)}")
    slowest = max(tests, key=lambda x: x["avg_ms"])
    fastest = min(tests, key=lambda x: x["avg_ms"])
    print(f"Slowest: {slowest['label']} ({slowest['avg_ms']}ms avg)")
    print(f"Fastest: {fastest['label']} ({fastest['avg_ms']}ms avg)")

    # Save raw results as JSON for report
    with open("tests/perf_results.json", "w") as f:
        json.dump(tests, f, indent=2)
    print("\nRaw results saved to tests/perf_results.json")
