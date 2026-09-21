#!/usr/bin/env bash
# One-time setup for a fresh Oracle Cloud "Always Free" Ubuntu VM.
# Run as the default user (ubuntu) via SSH: bash setup-vm.sh
#
# What this does:
#   1. Installs Docker Engine + the Compose plugin.
#   2. Opens 80/443 in the OS-level iptables rules Oracle's Ubuntu images
#      ship with (Canonical's Oracle image applies its own iptables INPUT
#      rules by default - a cloud security list rule alone is not enough,
#      both layers must allow the port). Uses iptables-persistent directly
#      rather than ufw - installing iptables-persistent on this image pulls
#      in a dependency resolution that removes ufw, so there is no point
#      installing it first.
#   3. Adds a 2G swapfile (cheap insurance against OOM-killed containers on
#      the smaller free-tier shapes; harmless on the larger ones).
set -euo pipefail

echo "==> Updating packages"
sudo apt-get update -y
sudo apt-get upgrade -y

echo "==> Installing Docker Engine + Compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"

echo "==> Opening 80/443 in the OS-level iptables rules"
sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || \
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || \
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
if ! command -v netfilter-persistent >/dev/null 2>&1; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
fi
sudo netfilter-persistent save

echo "==> Adding 2G swapfile (skips if one already exists)"
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "==> Done. Log out and back in for the docker group change to take effect,"
echo "    then remember to also open ingress rules 80/443 (and 22 for SSH) in the"
echo "    Oracle Cloud Console's Security List / Network Security Group for this"
echo "    VM's subnet - see docs/ORACLE_DEPLOYMENT.md step 3."
