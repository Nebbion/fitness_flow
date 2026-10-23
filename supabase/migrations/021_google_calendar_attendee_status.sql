-- Stato RSVP del cliente letto dalla copia organizzatore su Google Calendar.
-- Un rifiuto non annulla automaticamente l'appuntamento FitnessFlow.

ALTER TABLE appointments
  ADD COLUMN google_attendee_status TEXT
    CHECK (google_attendee_status IN ('needsAction', 'accepted', 'declined', 'tentative')),
  ADD COLUMN google_attendee_status_updated_at TIMESTAMPTZ;

CREATE INDEX appointments_google_attendee_status
  ON appointments(tenant_id, google_attendee_status)
  WHERE google_attendee_status IS NOT NULL;
