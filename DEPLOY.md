# استقرار CRM اسپان روی crm.spunholding.com

این راهنما برای راه‌اندازی نسخهٔ زنده (production) روی یک سرور است.

---

## ۱) پیشنهاد میزبانی (Hosting)

چون کاربران داخل ایران هستند، یک **سرور مجازی (VPS) ایرانی** بهترین گزینه است
(تأخیر کم، پرداخت ریالی، بدون مشکل تحریم برای دانلود ایمیج‌ها):

| گزینه | مناسب برای | هزینهٔ تقریبی ماهانه |
|------|------------|----------------------|
| **VPS ایرانی** (ابرآروان / پارس‌پک / ایران‌سرور) — پیشنهاد اصلی | تیم داخل ایران، پرداخت ریالی | ~۲۰۰٬۰۰۰ تا ۵۰۰٬۰۰۰ تومان |
| Hetzner (آلمان، CX22) | اگر کارت ارزی دارید | ~€۴.۵ |

**مشخصات حداقلی سرور:** Ubuntu 24.04 LTS، ۲ هسته CPU، ۴ گیگ RAM، ۲۵ گیگ SSD.

> نکتهٔ مهم ایران: Docker Hub و npm گاهی در ایران فیلتر هستند. اسکریپت `deploy.sh`
> به‌صورت خودکار **میرور داکر ابرآروان** را تنظیم می‌کند تا دانلود ایمیج‌ها کار کند.
> اگر سرور خارج از ایران است، این بخش بی‌اثر و بی‌ضرر است.

---

## ۲) کارهایی که فقط شما می‌توانید انجام دهید

1. **تهیهٔ سرور** و گرفتن IP عمومی آن.
2. **رکورد DNS**: در پنل مدیریت دامنهٔ `spunholding.com` یک رکورد اضافه کنید:
   ```
   نوع: A     نام: crm     مقدار: <IP سرور>     TTL: 3600
   ```
   (مستقل از سایت وردپرسی است؛ فقط زیر‌دامنه را اضافه می‌کنید.)
3. **باز بودن پورت‌ها** ۸۰ و ۴۴۳ در فایروال سرور.

---

## ۳) استقرار (روی سرور)

```bash
# ۱. فایل‌های پروژه را روی سرور کپی کنید (همین بسته)
scp spun-crm-deploy.tar.gz root@<IP>:/opt/
ssh root@<IP>
cd /opt && tar xzf spun-crm-deploy.tar.gz && cd nexus-crm

# ۲. اجرای اسکریپت آماده‌سازی (نصب داکر + میرور ایران)
sudo bash deploy.sh

# ۳. تنظیم متغیرها
cp .env.production.example .env
nano .env        # DB_PASSWORD، AUTH_SECRET (با: openssl rand -base64 32)،
                 # NEXTAUTH_URL=https://crm.spunholding.com، ADMIN_*

# ۴. بالا آوردن سرویس‌ها (اپ + دیتابیس)
docker compose up -d --build
```

برنامه روی پورت داخلی ۳۰۰۰ بالا می‌آید و در اولین اجرا به‌صورت خودکار:
مهاجرت دیتابیس (`prisma migrate deploy`) و ساخت حساب مدیر را انجام می‌دهد.

> دادهٔ نمونهٔ فارسی اختیاری است؛ برای محیط واقعی لازم نیست. اگر خواستید:
> `docker compose exec app node node_modules/prisma/build/index.js db seed`

---

## ۴) دامنه + HTTPS (Nginx + گواهی رایگان)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx-crm.conf /etc/nginx/sites-available/crm.conf
sudo ln -s /etc/nginx/sites-available/crm.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# بعد از اینکه رکورد DNS بالا آمد:
sudo certbot --nginx -d crm.spunholding.com
```

تمام. حالا `https://crm.spunholding.com` در دسترس است.

---

## ۵) نگه‌داری (تقریباً خودکار)

اسکریپت `deploy.sh` این موارد را خودکار می‌کند:
- **روشن‌ماندن خودکار**: کانتینرها با `restart: unless-stopped` بعد از ری‌استارت/کرش خودشان بالا می‌آیند.
- **تمدید خودکار HTTPS**: certbot هر ۹۰ روز گواهی را تمدید می‌کند.
- **به‌روزرسانی امنیتی خودکار سیستم‌عامل**: از طریق `unattended-upgrades`.
- **پشتیبان‌گیری شبانه از دیتابیس**: هر شب ساعت ۰۳:۳۰ در `/opt/spun-crm-backups` (نگه‌داری ۱۴ روز).

بنابراین تنها کار ماهانهٔ اجباری شما **پرداخت هزینهٔ VPS** است. هر چند وقت یک‌بار (~۱۰ دقیقه) فقط سلامت را چک کنید:

```bash
docker compose ps                 # وضعیت سرویس‌ها
docker compose logs -f app        # مشاهدهٔ لاگ
ls -lh /opt/spun-crm-backups      # اطمینان از وجود پشتیبان‌ها
```

**به‌روزرسانی برنامه** (فقط وقتی نسخهٔ جدید می‌دهیم):
```bash
docker compose up -d --build
```

**بازگردانی از پشتیبان** (در صورت نیاز):
```bash
gunzip -c /opt/spun-crm-backups/crm_<DATE>.sql.gz | docker compose exec -T db psql -U crm crm
```

اولین کاری که بعد از ورود انجام دهید: گذرواژهٔ مدیر را از داخل برنامه عوض کنید.
