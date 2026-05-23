CREATE TABLE "background_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp NOT NULL,
	"interval_ms" integer NOT NULL,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"last_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "background_jobs_job_type_unique" UNIQUE("job_type")
);
--> statement-breakpoint
CREATE INDEX "idx_bg_jobs_status" ON "background_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bg_jobs_next_run" ON "background_jobs" USING btree ("next_run_at");