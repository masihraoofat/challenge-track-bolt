-- Challenge types are fully defined by scoring_mode, unit_label, and description.
ALTER TABLE competitions DROP COLUMN IF EXISTS competition_type;
