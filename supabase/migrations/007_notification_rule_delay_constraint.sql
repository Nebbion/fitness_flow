-- Le regole di reminder possono condividere evento e canale, ma differire
-- per il ritardo (ad esempio 24 ore e 2 ore prima dell'appuntamento).
ALTER TABLE notification_rules
  DROP CONSTRAINT IF EXISTS notification_rules_tenant_id_event_trigger_channel_key;

ALTER TABLE notification_rules
  ADD CONSTRAINT notification_rules_tenant_event_channel_delay_key
  UNIQUE (tenant_id, event_trigger, channel, delay_minutes);
