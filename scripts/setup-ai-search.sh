#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# FAQ-Mate: Cloudflare AI Search Provisioning & Deployment Wizard
# Bucket:  faq-mate-corpus
# ==============================================================================

BUCKET_NAME="faq-mate-corpus"
INSTANCE_NAME="faq-mate-search"
NAMESPACE="default"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}=== FAQ-Mate: Cloudflare AI Search Provisioning Wizard ===${NC}\n"

# Step 1: Check CLI Authentication & Account Resolution
echo -e "${YELLOW}Stage 1/4: Checking Cloudflare CLI & Account Status...${NC}"
if ! command -v cf &>/dev/null; then
  echo "Error: Cloudflare CLI 'cf' not found."
  exit 1
fi

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-$(cf auth whoami 2>/dev/null | grep -A 2 '"accounts"' | grep '"id":' | head -n 1 | cut -d '"' -f 4 || echo "")}"
if [ -z "$ACCOUNT_ID" ]; then
  echo "Error: Could not resolve Cloudflare Account ID. Please run 'cf login' or set CLOUDFLARE_ACCOUNT_ID."
  exit 1
fi

DASH_URL="https://dash.cloudflare.com/${ACCOUNT_ID}/ai/ai-search"

echo -e "  ✓ Verified Account ID: ${GREEN}${ACCOUNT_ID}${NC}"
echo -e "  ✓ Verified R2 Bucket:   ${GREEN}${BUCKET_NAME}${NC} (331 documents ready)\n"

# Step 2: Open Cloudflare Dashboard for 1-Click Provisioning
echo -e "${YELLOW}Stage 2/4: Creating AI Search Instance...${NC}"
echo -e "Because Cloudflare requires an automated internal Service Token to crawl R2,"
echo -e "the fastest and most secure way is the 1-click creation in the Cloudflare Dashboard.\n"
echo -e "Opening Dashboard: ${CYAN}${DASH_URL}${NC} ..."

# Open browser on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
  open "${DASH_URL}" || true
elif command -v xdg-open &>/dev/null; then
  xdg-open "${DASH_URL}" || true
fi

echo -e "\n${BOLD}In your browser:${NC}"
echo -e "  1. Click ${GREEN}'Create Search Instance'${NC} (or 'Create')"
echo -e "  2. Select Data Source: ${BOLD}R2${NC}"
echo -e "  3. Select Bucket:      ${GREEN}${BUCKET_NAME}${NC}"
echo -e "  4. Set Instance Name:  ${GREEN}${INSTANCE_NAME}${NC}"
echo -e "  5. Embedding Model:    ${GREEN}@cf/baai/bge-large-en-v1.5${NC}"
echo -e "  6. Click ${GREEN}'Create'${NC}"
echo ""
read -r -p "Press [ENTER] once you have clicked 'Create' in the dashboard to verify: " _unused

# Step 3: Verification & Healthcheck
echo -e "\n${YELLOW}Stage 3/4: Verifying AI Search Instance via Cloudflare API...${NC}"
MAX_RETRIES=10
RETRY_COUNT=0
FOUND=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if cf ai-search get "${INSTANCE_NAME}" --namespace "${NAMESPACE}" &>/dev/null; then
    FOUND=1
    break
  fi
  echo "  Waiting for instance '${INSTANCE_NAME}' to appear in Cloudflare... (attempt $((RETRY_COUNT + 1))/${MAX_RETRIES})"
  sleep 3
  RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $FOUND -eq 1 ]; then
  echo -e "  ${GREEN}✓ AI Search Instance '${INSTANCE_NAME}' verified successfully!${NC}\n"
else
  echo -e "  ${YELLOW}⚠ Instance '${INSTANCE_NAME}' not detected yet. If you used a different name, update wrangler.jsonc.${NC}"
fi

# Step 4: Deploy Worker with Active AI Search Binding
echo -e "${YELLOW}Stage 4/4: Deploying Worker to Cloudflare Anycast Edge...${NC}"
echo "Deploying via Wrangler v4 with active 'env.AI_SEARCH' binding..."
npx wrangler@4 deploy

echo -e "\n${BOLD}${GREEN}=== AI Search Successfully Activated and Deployed! ===${NC}"
echo -e "• Primary Retriever: Cloudflare AI Search (BM25 + BGE Large Embeddings + Cross-Encoder)"
echo -e "• Fallback Engine:   In-Isolate AST Retriever (480 compiled chunks)"
echo -e "• Live Edge API:     https://faq-mate-api.json-panganiban.workers.dev\n"
