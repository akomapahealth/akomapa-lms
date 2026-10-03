-- Atomic Certificate numbering (#51).
--
-- Certificate numbers (GHELP-<year>-<nnnnn>) were computed as "highest this year
-- + 1" in application code, so two learners finishing at once were given the
-- same number and one Certificate failed to save -- or, for one learner's double
-- click, the PDF carried a number the stored row did not. Numbers are now
-- allocated from this table with one INSERT ... ON CONFLICT DO UPDATE, which
-- PostgreSQL serialises.
--
-- Backfill: each year's counter starts at the highest number already issued in
-- that year, so the next allocation continues the sequence. Only numbers in the
-- generated format are read; any other value was never produced by this code
-- and cannot collide with one that is.
--
-- Rollback: DROP TABLE "CertificateNumberSequence"; with the previous code,
-- which reads the existing Certificates instead. Nothing else changes.

CREATE TABLE "CertificateNumberSequence" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL,
    CONSTRAINT "CertificateNumberSequence_pkey" PRIMARY KEY ("year")
);

INSERT INTO "CertificateNumberSequence" ("year", "lastValue")
SELECT split_part("certificateNumber", '-', 2)::integer,
       max(split_part("certificateNumber", '-', 3)::integer)
  FROM "Certificate"
 WHERE "certificateNumber" ~ '^GHELP-[0-9]{4}-[0-9]+$'
 GROUP BY 1;
