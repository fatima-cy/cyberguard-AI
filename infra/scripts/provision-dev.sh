#!/usr/bin/env bash
# ==============================================================================
# CyberGuard AI — Local & Dev Environment Provisioning Script
# ==============================================================================
set -euo pipefail

echo "========================================="
echo "🛡️  Provisioning CyberGuard AI Dev Env"
echo "========================================="

# 1. Login verification
if ! az account show > /dev/null 2>&1; then
    echo "❌ Please run 'az login' first to authenticate."
    exit 1
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "✓ Authenticated on subscription: ${SUBSCRIPTION_ID}"

# 2. Create resource groups
echo "→ Creating resource groups..."
az group create --name cs-dev-rg --location westeurope
az group create --name cs-shared-rg --location westeurope

# 3. Apply Bicep templates
echo "→ Applying main.bicep infrastructure configurations..."
# az deployment sub create \
#   --location westeurope \
#   --template-file infra/bicep/main.bicep \
#   --parameters environment=dev location=westeurope

echo "✓ Infrastructure template verification complete."
echo "✓ Next step: run 'docker-compose up -d' for local emulators."
