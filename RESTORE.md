# بازیابی و تاب‌آوری (Disaster Recovery) — اسپان CRM

این سند می‌گوید اگر سرور از کار افتاد چه کنید.

## ۰) چه چیزهایی از قبل فعال است
- کانتینرها با `restart: unless-stopped` بعد از کرش/ری‌استارت خودکار بالا می‌آیند.
- سرویس `autoheal` اگر اپ هنگ کند (unhealthy شود) آن را ری‌استارت می‌کند.
- پشتیبان شبانهٔ محلی در `/opt/spun-crm-backups` (۱۴ روز).
- پشتیبان شبانهٔ **خارج از سرور** روی فضای ابری (اگر `scripts/offsite-backup.sh` تنظیم شده باشد).

---

## ۱) سناریو: سرور بالاست ولی از بعضی شبکه‌ها باز نمی‌شود (مشکل شبکهٔ میزبان)
کاری در کد لازم نیست. یا صبر کنید تا میزبان مسیر شبکه را درست کند، یا
اگر ArvanCloud جلوی سایت باشد، ترافیک خودکار از طریق edge آروان سرو می‌شود.

## ۲) سناریو: کل سرور از بین رفت — بازیابی روی سرور جدید (~۲۰ دقیقه)
```bash
# روی سرور جدید (Ubuntu 24.04):
scp spun-crm-deploy.tar.gz root@<NEW_IP>:/opt/
ssh root@<NEW_IP>
cd /opt && tar xzf spun-crm-deploy.tar.gz && cd nexus-crm
bash deploy.sh
cp .env.production.example .env && nano .env   # همان مقادیر قبلی (یا جدید)
docker compose up -d --build                   # دیتابیس خالی ساخته می‌شود

# بازگرداندن آخرین پشتیبان خارج از سرور:
aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://$S3_BUCKET/crm_<DATE>.sql.gz" /tmp/r.sql.gz
gunzip -c /tmp/r.sql.gz | docker compose exec -T db psql -U crm crm
```
سپس DNS (یا origin در آروان) را به آی‌پی سرور جدید اشاره دهید.

## ۳) سناریو: failover به سرور آماده‌به‌کار (HA)
اگر سرور دوم (standby) با replication راه‌اندازی شده باشد:
```bash
# روی standby، promote کردن دیتابیس replica به primary:
docker compose exec -T db pg_ctl promote -D /var/lib/postgresql/<PGDATA>
# سپس در پنل ArvanCloud، origin/health-check ترافیک را به standby می‌فرستد
# (یا به‌صورت دستی رکورد DNS را به آی‌پی standby تغییر دهید).
```

## ۴) تست منظم پشتیبان (مهم)
ماهی یک‌بار یک پشتیبان را روی یک محیط آزمایشی restore کنید تا مطمئن شوید سالم است.

---

### چک‌لیست اطلاعات حیاتی (در جای امن نگه دارید)
- آی‌پی و رمز root هر دو سرور
- مقادیر `.env` (DB_PASSWORD, AUTH_SECRET, ADMIN_*)
- کلیدهای فضای ذخیرهٔ ابری (Object Storage)
- محل ثبت دامنه و دسترسی DNS / ArvanCloud
