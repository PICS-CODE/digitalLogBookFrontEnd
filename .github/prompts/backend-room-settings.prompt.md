---
name: Backend Room Settings
description: "Use when implementing or reviewing backend support for configurable BIWAG and MALANA reservation time slots and the frontend room settings contract."
argument-hint: "Describe the backend stack or repository path, then implement the room time settings contract."
---
Implement the backend changes required by the frontend room settings feature for the CPLRC reservation system.

## Context
The frontend Admin Dashboard has a Room Settings screen for:
- `Discussion Room (BIWAG)`
- `Discussion Room (MALANA)`

An administrator configures available reservation time slots in a modal. The frontend persists room settings through:
- `GET /api/settings`
- `PUT /api/settings`

The settings payload already contains `institutions`, `patronTypes`, and `rooms`. Each room object should support:
```json
{
  "name": "Discussion Room (BIWAG)",
  "enabled": true,
  "disabledReason": "",
  "timeSlots": ["7:30am-8:30am", "8:30am-9:30am"]
}
```

## Requirements
1. Inspect the existing backend settings model, storage, routes, and validation before editing.
2. Preserve existing settings fields and existing room availability behavior.
3. Persist `rooms[].timeSlots` as an array of non-empty strings.
4. Support both BIWAG and MALANA room records without requiring a breaking migration for existing data.
5. When old room records have no `timeSlots`, return the established default slots or safely normalize them on read/write:
   - `7:30am-8:30am`
   - `8:30am-9:30am`
   - `9:30am-10:30am`
   - `10:30am-11:30am`
   - `11:30am-12:30pm`
   - `12:30pm-1:30pm`
   - `1:30pm-2:30pm`
   - `2:30pm-3:30pm`
   - `3:30pm-4:30pm`
   - `4:30pm-5:30pm`
   - `5:30pm-6:30pm`
6. Validate `timeSlots` on `PUT /api/settings`: reject malformed values, arrays containing blank entries, or unsupported non-array values with the backend's standard 4xx error format.
7. Return the normalized settings object from `PUT /api/settings` so the frontend immediately reflects saved values.
8. Keep reservation creation/update validation aligned with configured room slots where the backend already validates reservation data. BIWAG/MALANA reservations must not accept a slot outside that room's configured `timeSlots`.
9. Avoid changing unrelated reservation, user, log, authentication, or frontend behavior.
10. Add or update focused backend tests for:
    - reading legacy settings without `timeSlots`
    - saving BIWAG and MALANA custom slots
    - rejecting invalid slot payloads
    - accepting a reservation with a configured slot
    - rejecting a reservation with an unconfigured slot

## Implementation Guidance
- Follow the backend repository's existing framework, persistence layer, naming, error handling, and test conventions.
- Normalize room records in one owning settings layer instead of duplicating defaults across routes.
- Do not trust room names from the client when validating slots; resolve the room from stored settings.
- Preserve the exact slot strings after trimming whitespace, unless the backend already has a canonical time format validator.
- Consider an atomic settings update so institutions, patron types, and rooms cannot be partially persisted.

## Validation
Run the narrowest relevant backend test command first, then the full backend test/build command if available. Also manually verify:
- `GET /api/settings` includes `timeSlots` for BIWAG and MALANA.
- `PUT /api/settings` persists custom arrays.
- A client configured with the frontend can save and reload room times without a 4xx or 5xx response.

## Output
Report:
1. Backend files changed.
2. API/schema behavior added.
3. Migration or legacy-data handling.
4. Tests and commands run, including results.
5. Any assumptions about the backend repository or persistence layer.
