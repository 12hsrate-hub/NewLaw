DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'newlaw_app') THEN
    GRANT USAGE ON SCHEMA public TO newlaw_app;
    GRANT USAGE ON TYPE "AITestRunStatus" TO newlaw_app;
    GRANT USAGE ON TYPE "AITestRunResultStatus" TO newlaw_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "AITestScenario" TO newlaw_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "AITestRun" TO newlaw_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "AITestRunResult" TO newlaw_app;

    ALTER DEFAULT PRIVILEGES FOR ROLE newlaw_admin IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO newlaw_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE newlaw_admin IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO newlaw_app;
  END IF;
END $$;
