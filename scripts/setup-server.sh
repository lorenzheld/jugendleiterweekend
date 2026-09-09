#!/bin/bash
###############################################################################
# Initial Server Setup Script for JLW 2026
###############################################################################
# This script sets up a fresh Ubuntu server for JLW 2026 deployment
# Run as root or with sudo privileges
###############################################################################

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    log_error "Please run as root or with sudo"
    exit 1
fi

log_info "Starting JLW 2026 Server Setup..."

# ─── Update System ───────────────────────────────────────────────────────────
log_info "Updating system packages..."
apt update && apt upgrade -y

# ─── Install Essential Tools ─────────────────────────────────────────────────
log_info "Installing essential tools..."
apt install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    ufw \
    fail2ban \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# ─── Install Docker ──────────────────────────────────────────────────────────
log_info "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    
    # Add user to docker group (replace 'ubuntu' with your username)
    usermod -aG docker ubuntu || true
    
    log_info "Docker installed successfully"
else
    log_info "Docker already installed"
fi

# ─── Install Docker Compose ──────────────────────────────────────────────────
log_info "Installing Docker Compose Plugin..."
apt install -y docker-compose-plugin

# ─── Install Nginx ───────────────────────────────────────────────────────────
log_info "Installing Nginx..."
apt install -y nginx

# ─── Install Certbot ─────────────────────────────────────────────────────────
log_info "Installing Certbot for Let's Encrypt..."
apt install -y certbot python3-certbot-nginx

# ─── Configure Firewall ──────────────────────────────────────────────────────
log_info "Configuring UFW firewall..."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw status

# ─── Configure Fail2Ban ──────────────────────────────────────────────────────
log_info "Configuring Fail2Ban..."
systemctl enable fail2ban
systemctl start fail2ban

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
EOF

systemctl restart fail2ban

# ─── Create Project Directory ────────────────────────────────────────────────
log_info "Creating project directory..."
mkdir -p /opt/jlw2026
mkdir -p /opt/jlw2026/backups
chown -R ubuntu:ubuntu /opt/jlw2026 || true

# ─── Configure Nginx Base ────────────────────────────────────────────────────
log_info "Configuring Nginx..."

# Increase client_max_body_size for media uploads
cat > /etc/nginx/conf.d/client_max_body_size.conf << 'EOF'
client_max_body_size 50M;
EOF

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
nginx -t
systemctl reload nginx

# ─── Install AWS CLI (Optional) ──────────────────────────────────────────────
log_info "Installing AWS CLI..."
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip
    log_info "AWS CLI installed"
else
    log_info "AWS CLI already installed"
fi

# ─── Setup Swap (if needed) ──────────────────────────────────────────────────
SWAP_SIZE="2G"
if [ ! -f /swapfile ]; then
    log_info "Creating ${SWAP_SIZE} swap file..."
    fallocate -l $SWAP_SIZE /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    log_info "Swap created and enabled"
else
    log_info "Swap file already exists"
fi

# ─── Setup Log Rotation ──────────────────────────────────────────────────────
log_info "Setting up log rotation..."
cat > /etc/logrotate.d/jlw2026 << 'EOF'
/var/log/nginx/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}

/var/lib/docker/containers/*/*.log {
    daily
    rotate 7
    compress
    size=10M
    missingok
    delaycompress
    copytruncate
}
EOF

# ─── Setup Automatic Security Updates ────────────────────────────────────────
log_info "Configuring automatic security updates..."
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# ─── Setup Monitoring (Optional) ─────────────────────────────────────────────
log_info "Installing monitoring tools..."
apt install -y htop iotop nethogs ncdu

# ─── Create Deployment User (if not exists) ──────────────────────────────────
if ! id -u deploy &>/dev/null; then
    log_info "Creating deployment user..."
    useradd -m -s /bin/bash deploy
    usermod -aG docker deploy
    usermod -aG sudo deploy
fi

# ─── Final Summary ───────────────────────────────────────────────────────────
log_info "═══════════════════════════════════════════════════════════════════"
log_info "Server Setup Complete! 🎉"
log_info "═══════════════════════════════════════════════════════════════════"
log_info ""
log_info "Installed Components:"
log_info "  ✓ Docker $(docker --version | cut -d' ' -f3)"
log_info "  ✓ Docker Compose $(docker compose version | cut -d' ' -f4)"
log_info "  ✓ Nginx $(nginx -v 2>&1 | cut -d'/' -f2)"
log_info "  ✓ Certbot $(certbot --version | cut -d' ' -f2)"
log_info "  ✓ UFW Firewall (enabled)"
log_info "  ✓ Fail2Ban (enabled)"
log_info ""
log_info "Next Steps:"
log_info "  1. Clone your repository to /opt/jlw2026"
log_info "     cd /opt/jlw2026 && git clone <your-repo-url> ."
log_info ""
log_info "  2. Copy and configure environment file:"
log_info "     cp .env.example .env.production"
log_info "     nano .env.production"
log_info ""
log_info "  3. Copy Nginx configuration:"
log_info "     cp nginx/jlw2026.conf /etc/nginx/sites-available/"
log_info "     ln -s /etc/nginx/sites-available/jlw2026 /etc/nginx/sites-enabled/"
log_info ""
log_info "  4. Setup SSL with Certbot:"
log_info "     certbot --nginx -d jlw2026.example.com -d api.jlw2026.example.com -d gm.jlw2026.example.com"
log_info ""
log_info "  5. Deploy the application:"
log_info "     chmod +x deploy.sh"
log_info "     ./deploy.sh production"
log_info ""
log_info "⚠️  IMPORTANT: If you added user to docker group, logout and login again!"
log_info "═══════════════════════════════════════════════════════════════════"
