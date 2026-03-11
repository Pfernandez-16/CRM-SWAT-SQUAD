# 🎯 PROJECT VISION: CRM SWAT Squad v7

## Concept
A serverless, Single-Page Application (SPA) CRM built on Google Apps Script and Vue 3, utilizing Google Sheets as a Star-Schema Database. It manages the entire sales lifecycle from Lead Top-of-Funnel (SDRs) to Deal Bottom-of-Funnel (AEs) with deep BI analytics.

## Core Pillars
1. **Serverless & Free-Tier Native**: Uses Google Workspace infrastructure entirely (`google.script.run` + Google Sheets).
2. **Strict Role Segmentation**: SDRs live in "Prospectos" (`fact_leads`); AEs live in "Negociaciones" (`fact_deals`). Roles are strictly enforced by the backend and Vue Reactivity.
3. **Omni-Channel Auditing**: Every touchpoint (call, WhatsApp) and field change is immutably logged in `fact_interacciones` and `log_transacciones`.
4. **Data Integrity**: Uses `LockService` for atomic transactions and a Star Schema (Dimensions and Facts) to prevent data corruption.
5. **Business Intelligence**: Native analytical computation (CarryOver, Deltas, BANT segmentation) without external dependencies (no Looker Studio needed).

## Target Audience
- **SDRs (Sales Development Reps)**: Need speed, clear tracking of "toques" (touches), and a zero-friction handoff process.
- **AEs (Account Executives)**: Need financial visibility, contract tracking, and pipeline management for closing deals.
- **ADMINs / Management**: Need bird's-eye analytical views to understand funnel health and SLA breaches.

## What Success Looks Like
- Zero data corruption during concurrent usage.
- Handoffs from SDR to AE require 100% adherence to BANT qualification.
- Reporting is instantaneous and accurate, reflecting historical deltas.
- UI feels like a premium SaaS product (Glassmorphism, Dark Mode, Kanban Drag & Drop).
