"""make help uchun Makefile ni parse qiladi."""
import re
import sys
from pathlib import Path

makefile = Path(__file__).parent.parent / "Makefile"
targets: list[tuple[str, str]] = []

with open(makefile, encoding="utf-8") as f:
    for line in f:
        m = re.match(r'^([a-zA-Z][a-zA-Z0-9_-]*):.*?##\s+(.+)', line)
        if m:
            targets.append((m.group(1), m.group(2)))

t_map = dict(targets)

groups = {
    "Infra":     ["up", "up-tools", "up-workers", "up-app", "up-all", "down", "reset"],
    "Build":     ["build", "build-prod", "pull"],
    "Logs":      ["logs", "logs-postgres", "logs-redis", "logs-backend", "logs-celery"],
    "Shell":     ["shell-db", "shell-redis", "shell-backend", "ps", "status"],
    "Migration": ["migrate", "migrate-down", "migrate-history", "migration"],
    "Dev":       ["dev", "install", "install-dev", "setup"],
    "Network":   ["ip", "network"],
}

print()
print("EduFlow -- Makefile buyruqlari")
print("=" * 52)

shown: set[str] = set()
for group, names in groups.items():
    print(f"\n  [{group}]")
    for name in names:
        if name in t_map:
            print(f"    make {name:<22} {t_map[name]}")
            shown.add(name)

other = [(n, d) for n, d in targets if n not in shown and not n.startswith("_")]
if other:
    print("\n  [Boshqa]")
    for name, desc in other:
        print(f"    make {name:<22} {desc}")

print()
print("Misollar:")
print("  make up         -> DB + Redis ishga tushirish")
print("  make up-tools   -> pgAdmin + Mailpit ham")
print("  make migrate    -> Alembic migratsiyalarini qo'llash")
print("  make network    -> Barcha URL larni ko'rsatish")
print("  make dev        -> Dev server (hot-reload)")
print()
