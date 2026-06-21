# FleetCore UX Audit: Owner of 500 Rental Vehicles

Date: 2026-06-21

Perspective: owner/operator of a 500-car rental business. The system must reduce daily operational load, not display every possible object at once.

## Core Business Process

FleetCore should be organized around one primary workflow:

1. Booking
2. Client
3. Vehicle
4. Contract
5. Payment
6. Pickup
7. Return

Every screen should answer one question: what is blocking this rental from becoming completed revenue?

## Where Users Make Extra Clicks

1. Creating a rental currently competes with separate actions for vehicle, client, document, payment and service.
2. Dashboard mixes KPI viewing with operational tasks; the owner has to interpret numbers manually.
3. Documents live across vehicle, client, rental and service contexts; users need a single document center.
4. Finance actions are separated from rental status, so payment is not naturally part of the rental flow.
5. Contract actions are not always visible at the exact moment they are needed.
6. Mobile users see too many equally weighted actions.
7. Search is useful but should behave as a universal command center for plate, VIN, client, phone, rental and document.
8. Timeline data is fragmented between contracts, checklists, payments and documents.
9. AI is not yet used to suggest the next operational action.

## New Screen Structure

### 1. Command Center Dashboard

Purpose: daily control room.

Blocks:
- Process map: Booking -> Client -> Vehicle -> Contract -> Payment -> Pickup -> Return.
- Operations Inbox: urgent tasks sorted by business risk.
- AI Assistant: one recommended next action.
- Activity Feed: contracts, payments, active rentals and returns.
- KPI strip: only operational KPIs.

Primary actions:
- Start rental.
- Close overdue return.
- Send contract.
- Record payment.
- Upload missing document.

### 2. Universal Search

Search must find:
- plate number;
- VIN;
- client name;
- phone;
- email;
- rental;
- document.

Expected result behavior:
- Vehicle result opens vehicle context.
- Client result opens CRM context.
- Rental result opens Rental Details.
- Document result opens preview or Document Center.

### 3. Timeline System

Each customer, vehicle and rental should have a timeline:
- booking created;
- customer intake completed;
- contract generated;
- contract sent/viewed/signed;
- payment received;
- deposit received/refunded;
- pickup checklist completed;
- return checklist completed;
- damage reported;
- document uploaded/expired.

### 4. Activity Feed

Activity Feed is not a notification dump. It should show business events:
- signed contracts;
- received payments;
- upcoming/overdue returns;
- uploaded documents;
- completed service;
- damage claims.

### 5. Document Center

Single DMS entry point:
- all documents;
- vehicle documents;
- client documents;
- rental documents;
- contracts;
- damage photos;
- service PDFs;
- insurance and inspection expiry.

Filters:
- entity type;
- status;
- expiry;
- tag;
- owner;
- missing/expired.

### 6. Finance Center

Finance must be tied to rental completion:
- invoice status;
- deposit status;
- paid amount;
- outstanding amount;
- refund;
- final settlement.

### 7. Mobile First

Rules:
- one primary action per screen;
- cards instead of tables;
- horizontal workflow rail for rental process;
- sticky search and create;
- bottom sheets for secondary actions;
- minimum 44px touch targets;
- no dense desktop panels on phone.

### 8. Quick Actions

Quick actions should be contextual, not global noise.

Dashboard:
- New rental;
- Close return;
- Payment;
- Document.

Rental:
- Send contract;
- Record payment;
- Pickup;
- Return;
- Final settlement.

Vehicle:
- Book;
- Expense;
- Service;
- Document;
- Photo.

Client:
- Send intake link;
- Attach vehicle;
- Upload ID;
- New rental.

### 9. AI Assistant

AI should start as deterministic recommendations, then become model-powered:
- next best action;
- missing document detection;
- overdue prediction;
- client risk summary;
- price recommendation;
- photo damage comparison.

## Implementation Started

Implemented first priority block:
- new `CommandCenterDashboard` feature component;
- rental process map;
- AI next action card;
- activity feed;
- mobile responsive process rail.

Files:
- `apps/web/src/features/operations/command-center-dashboard.tsx`
- `apps/web/src/app/dashboard-client.tsx`
- `apps/web/src/app/globals.css`

## Next Priority

1. Move Universal Search into a separate feature component.
2. Add backend timeline endpoint.
3. Replace Service section label with Documents.
4. Convert Rental Details into full step-by-step workspace.
5. Add deterministic validation: cannot pickup without signed contract and payment/deposit state.
