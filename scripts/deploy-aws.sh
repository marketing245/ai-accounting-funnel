#!/bin/bash
# Deploy this checkout to the AWS website server (EC2 "aiae-website" behind CloudFront).
# Usage: scripts/deploy-aws.sh        (needs ~/.ssh/aiae-aws.pem; SSH is allowed only from the admin IP in the security group)
# Settings live on the server in /etc/aiae.env (root, 600) — this script never touches them.
set -euo pipefail
HOST=ec2-user@13.210.107.3
KEY="$HOME/.ssh/aiae-aws.pem"
SITE=https://www.cavarshavaryani.com
cd "$(dirname "$0")/.."

ssh -i "$KEY" "$HOST" 'sudo chown -R ec2-user:ec2-user /opt/aiae/app'
rsync -az --delete -e "ssh -i $KEY" --exclude node_modules --exclude .git --exclude '.env*' --exclude .vercel --exclude .data --exclude parked ./ "$HOST:/opt/aiae/app/"
ssh -i "$KEY" "$HOST" 'cd /opt/aiae/app && npm ci --omit=dev --no-audit --no-fund --loglevel=error && sudo chown -R root:root /opt/aiae/app && sudo chmod -R a+rX /opt/aiae/app && sudo systemctl restart aiae && sleep 2 && systemctl is-active aiae'
curl -fsS "$SITE/api/health" && echo && echo "Deployed → $SITE"
