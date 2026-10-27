#!/bin/bash
# 个人工作与能力提升看板 - 服务器端一键安装脚本
# 用法：以 root 在服务器上执行 bash setup.sh
set -e

echo "==> [1/6] 安装 Java 17 与 Nginx"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq openjdk-17-jre-headless nginx > /dev/null

echo "==> [2/6] 创建运行用户与目录"
id dashboard &>/dev/null || useradd -r -s /usr/sbin/nologin dashboard
mkdir -p /opt/growth-dashboard/data
cp /tmp/deploy/app.env /opt/growth-dashboard/app.env
chmod 600 /opt/growth-dashboard/app.env
mv /tmp/deploy/growth-dashboard-1.0.0.jar /opt/growth-dashboard/
chown -R dashboard:dashboard /opt/growth-dashboard

echo "==> [3/6] 配置 systemd 服务"
cp /tmp/deploy/growth-dashboard.service /etc/systemd/system/growth-dashboard.service
systemctl daemon-reload
systemctl enable growth-dashboard > /dev/null 2>&1

echo "==> [4/6] 配置 Nginx（默认站点反代到 7100）"
rm -f /etc/nginx/sites-enabled/default
cp /tmp/deploy/nginx-ip.conf /etc/nginx/sites-available/growth-dashboard
ln -sf /etc/nginx/sites-available/growth-dashboard /etc/nginx/sites-enabled/growth-dashboard
nginx -t

echo "==> [5/6] 配置防火墙（放行 22/80/443，7100 仅本机）"
if command -v ufw > /dev/null; then
  ufw allow 22/tcp > /dev/null 2>&1 || true
  ufw allow 80/tcp > /dev/null 2>&1 || true
  ufw allow 443/tcp > /dev/null 2>&1 || true
  ufw --force enable > /dev/null 2>&1 || true
fi

echo "==> [6/6] 启动服务"
systemctl restart growth-dashboard
systemctl restart nginx
sleep 8

echo ""
echo "==> 服务状态："
systemctl is-active growth-dashboard nginx
echo ""
curl -s -o /dev/null -w "本地 7100 端口 HTTP 状态码: %{http_code}\n" http://127.0.0.1:7100/ || echo "7100 暂未就绪，可执行 journalctl -u growth-dashboard -n 50 查看日志"
echo "==> 安装完成"
