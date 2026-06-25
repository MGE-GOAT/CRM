#!/usr/bin/env bash
# Spun CRM — server prep script. Run once on a fresh Ubuntu server (as root/sudo).
# Installs Docker + Compose, and (for Iran) configures the ArvanCloud Docker mirror.
set -euo pipefail

echo "==> Spun CRM server setup"

# --- Docker ---
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
else
  echo "==> Docker already installed."
fi

# --- Iran: Docker registry mirror (harmless elsewhere) ---
echo "==> Configuring Docker registry mirror (ArvanCloud) for reliable pulls in Iran..."
mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  cat > /etc/docker/daemon.json <<'JSON'
{
  "registry-mirrors": ["https://docker.arvancloud.ir"]
}
JSON
  systemctl restart docker || service docker restart || true
else
  echo "   /etc/docker/daemon.json already exists — leaving it unchanged."
  echo "   (If pulls fail in Iran, add \"registry-mirrors\": [\"https://docker.arvancloud.ir\"] manually.)"
fi

# --- Compose plugin sanity ---
if ! docker compose version >/dev/null 2>&1; then
  echo "==> Installing docker compose plugin..."
  apt-get update && apt-get install -y docker-compose-plugin
fi

# --- Firewall (if ufw is active) ---
if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp  || true
  ufw allow 443/tcp || true
fi

# --- Automatic OS security updates ---
echo "==> Enabling automatic security updates..."
apt-get update && apt-get install -y unattended-upgrades || true
dpkg-reconfigure -f noninteractive unattended-upgrades || true

# --- Nightly DB backup cron (03:30) ---
echo "==> Scheduling nightly database backup..."
APP_DIR="$(pwd)"
CRON_LINE="30 3 * * * cd $APP_DIR && bash backup.sh >> /var/log/spun-crm-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'spun-crm/backup.sh\|backup.sh' ; echo "$CRON_LINE" ) | crontab -
chmod +x backup.sh || true

echo ""
echo "==> Done. Next steps:"
echo "    1) cp .env.production.example .env   &&   edit .env"
echo "    2) docker compose up -d --build"
echo "    3) set up Nginx + certbot (see DEPLOY.md section 4)"
