-- Account-scoped flag for the learner-mode WelcomeModal. Replaces the
-- per-device localStorage flag so dismissing on phone also dismisses on web.
ALTER TABLE "users" ADD COLUMN "learnerWelcomeSeenAt" TIMESTAMP(3);
