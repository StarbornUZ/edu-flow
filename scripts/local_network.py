"""Local tarmoq IP va barcha servis URL larini ko'rsatadi."""
import socket
import sys

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try:
    s.connect(("8.8.8.8", 80))
    ip = s.getsockname()[0]
finally:
    s.close()

if len(sys.argv) > 1 and sys.argv[1] == "--ip-only":
    print(ip)
    sys.exit(0)

print()
print("=" * 56)
print("  EduFlow -- Local Tarmoq Ulanish Manzillari")
print("=" * 56)
print(f"\n  Local IP: {ip}\n")

print("  Infra (bir xil tarmoqdagi qurilmalardan):")
print(f"    PostgreSQL  ->  {ip}:15432")
print(f"    Redis       ->  {ip}:16379")
print()
print("  Tools (make up-tools keyin):")
print(f"    pgAdmin     ->  http://{ip}:15050")
print(f"    Mailpit     ->  http://{ip}:15025")
print()
print("  Workers (make up-workers keyin):")
print(f"    Flower      ->  http://{ip}:15555")
print()
print("  Backend API:")
print(f"    Host dev    ->  http://{ip}:8000  (make dev)")
print(f"    Docker      ->  http://{ip}:18000  (make up-app)")
print(f"    Swagger     ->  http://{ip}:8000/docs")
print()
print("  Frontend .env.local:")
print(f"    NEXT_PUBLIC_API_URL=http://{ip}:8000")
print()
print("  DATABASE_URL (boshqa mashinadan):")
print(f"    postgresql+asyncpg://eduflow:eduflow_dev_pass@{ip}:15432/eduflow")
print()
print("  REDIS_URL (boshqa mashinadan):")
print(f"    redis://:eduflow_redis_pass@{ip}:16379")
print()
print("  Not: Firewall portlarini ochiq qoldiring:")
print("    8000, 15432, 15050, 15025, 15555, 16379, 18000")
print()
