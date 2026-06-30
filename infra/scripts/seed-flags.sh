#!/usr/bin/env bash
# ==============================================================================
# CyberGuard AI — Feature Flag Seeding Script
# ==============================================================================
set -euo pipefail

APPCONFIG_NAME=${1:-"cs-dev-appconfig"}

echo "========================================="
echo "⚙️  Seeding Feature Flags to App Config: ${APPCONFIG_NAME}"
echo "========================================="

# Helper to set KV in App Configuration
set_flag() {
    local key=$1
    local value=$2
    local content_type=${3:-""}
    
    echo "→ Seeding: ${key} = ${value}"
    
    if [ -n "${content_type}" ]; then
        az appconfig kv set \
            --name "${APPCONFIG_NAME}" \
            --key "${key}" \
            --value "${value}" \
            --content-type "${content_type}" \
            --yes
    else
        az appconfig kv set \
            --name "${APPCONFIG_NAME}" \
            --key "${key}" \
            --value "${value}" \
            --yes
    fi
}

# 11 default flags from Sprint 0 Plan v1.1 §22.2
set_flag "module.academy.enabled" "false" "application/vnd.microsoft.appconfig.ff+json"
set_flag "module.sarah.enabled" "false" "application/vnd.microsoft.appconfig.ff+json"
set_flag "module.ecocold.enabled" "false" "application/vnd.microsoft.appconfig.ff+json"

set_flag "feature.cyberguard.streaming" "false"
set_flag "feature.cyberguard.rag_context" "false"
set_flag "feature.platform.whatsapp_notifications" "false"

set_flag "infra.openai_degraded_mode" "false"
set_flag "infra.knowledge_rag_module" "false"
set_flag "infra.enhanced_security_logging" "false"

set_flag "rollout.new_assessment_engine" "0"
set_flag "experiment.guardrail_threshold_92" "0"

echo "✓ Successfully seeded 11 feature flags."
