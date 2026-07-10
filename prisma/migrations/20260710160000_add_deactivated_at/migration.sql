-- Track when an account was deactivated so a daily job can purge long-deactivated ones.
ALTER TABLE "User" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
