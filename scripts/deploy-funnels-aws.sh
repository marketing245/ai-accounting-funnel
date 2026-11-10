#!/bin/bash
# Deploy marketing funnels to the AWS server (each runs as systemd aiae-funnel@<name>, behind its own CloudFront):
#   express    ~/aiae-funnel-express    → express.cavarshavaryani.com    (port 3102)
#   calculator ~/aiae-funnel-calculator → calculator.cavarshavaryani.com (port 3103)
#   b2b        ~/aiae-funnel-b2b        → teams.cavarshavaryani.com      (port 3104, data in /var/lib/aiae/b2b-prod)
# Usage: scripts/deploy-funnels-aws.sh [express] [calculator] [b2b]   (no args = all). Settings: /etc/aiae-<name>.env on the server.
set -euo pipefail
HOST=ec2-user@13.210.107.3
KEY="$HOME/.ssh/aiae-aws.pem"
NAMES=("$@"); [ ${#NAMES[@]} -eq 0 ] && NAMES=(express calculator b2b)
for n in "${NAMES[@]}"; do
  src="$HOME/aiae-funnel-$n"; [ -d "$src" ] || { echo "no $src"; exit 1; }
  ssh -i "$KEY" "$HOST" "sudo chown -R ec2-user:ec2-user /opt/aiae/funnels/$n"
  rsync -az --delete -e "ssh -i $KEY" --exclude node_modules --exclude .git --exclude '.env*' --exclude .vercel --exclude .data "$src/" "$HOST:/opt/aiae/funnels/$n/"
  ssh -i "$KEY" "$HOST" "cd /opt/aiae/funnels/$n && { [ -f package.json ] && grep -q '\"dependencies\"' package.json && npm install --omit=dev --no-audit --no-fund --loglevel=error || true; } && sudo chown -R root:root /opt/aiae/funnels/$n && sudo chmod -R a+rX /opt/aiae/funnels/$n && sudo systemctl restart aiae-funnel@$n && sleep 1 && echo \"$n: \$(systemctl is-active aiae-funnel@$n)\""
done
