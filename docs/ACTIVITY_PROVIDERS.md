# Activity Providers

`activity_logs` is provider-neutral: provider, provider activity ID, type/name, start, duration, distance, estimated energy, energy source and data quality. `(user_id, provider, provider_activity_id)` is unique for idempotent imports.

Current capability policy:

| Provider | User display | Adaptive influence |
|---|---:|---:|
| MANUAL | Yes | Context only |
| HEALTH_CONNECT importer | Yes | Context only |
| STRAVA | Not implemented | No |
| APPLE_HEALTH | Not implemented | No |

Estimated energy is labelled as estimated and is never treated as exact or added 1:1 to calorie allowance. Provider implementations must normalize before reaching the engine.
