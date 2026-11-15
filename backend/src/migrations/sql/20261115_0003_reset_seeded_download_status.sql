-- 20261013_0002 seeded a temporary "degraded" incident, so every new install
-- showed a YouTube outage banner. Clear it only if it is still that seed text;
-- an operator's own status update is left alone.
UPDATE service_statuses
SET status = 'operational',
    headline = 'Operational',
    description = 'Video downloads are working normally.',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'video-downloads'
  AND status = 'degraded'
  AND headline = 'Investigating'
  AND description LIKE 'We are investigating slow video downloads.%';
