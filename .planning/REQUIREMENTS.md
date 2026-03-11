# 📋 REQUIREMENTS: CRM SWAT Squad

## V1 (Current State - Already Built)
- [x] Star Schema Database (`fact_leads`, `fact_deals`, `dim_contactos`, etc.)
- [x] Vue 3 SPA Frontend with Tailwind/Glassmorphism.
- [x] Dual Views (Table & Kanban) driven by `SortableJS`.
- [x] Role-Based Access Control (SDR vs UE vs ADMIN).
- [x] Analytics Module with BANT segmentation and historical deltas.
- [x] Automated BANT Handoff Trigger (SDR -> AE cloning to `fact_deals`).
- [x] Unified Audit Logging (`log_transacciones`).
- [x] Global HMN configurable variables panel.

## V2 (Pending Optimizations & Next Steps)
- [ ] Stabilize any remaining UI edge-case bugs (e.g. string interpolation bugs in Vue).
- [ ] Optimize GAS Execution Time (Cold start reduction for `getLeads`).
- [ ] Improve Error Handling in UI (Graceful degradation if `google.script.run` times out).
- [ ] Automated SLA Tracking (Alertings based on `HMN_SLA_Respuesta_SDR`).
- [ ] Deeply verify the Analytics reporting metrics for accuracy against manual CSV data.

## Out of Scope
- Migration to a real SQL Database (must remain in Google Sheets).
- Third-party REST API integrations (unless strictly requested).
- WebSockets for real-time reactivity (GAS limitation).
