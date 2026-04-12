-- EduFlow — PostgreSQL init SQL
-- Bu fayl konteyner birinchi marta ishga tushganda avtomatik bajariladi.
-- (docker-entrypoint-initdb.d/00_init.sql)
--
-- Alembic migratsiyalari bu fayldan KEYIN ishlaydi.
-- Bu yerda faqat extension va db-level sozlamalar bo'lishi kerak.

-- uuid-ossp extension (UUID generatsiya uchun, PostgreSQL tomonida)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pg_trgm (ILIKE full-text search tezlashtirish uchun, kelajakda kerak bo'lishi mumkin)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Timezone sozlash
SET timezone = 'Asia/Tashkent';
