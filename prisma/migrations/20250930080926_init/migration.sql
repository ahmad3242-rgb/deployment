-- CreateTable
CREATE TABLE "public"."User" (
    "user_id" TEXT NOT NULL,
    "date_of_birth" TEXT,
    "height_cm" INTEGER,
    "weight_kg" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "sex" TEXT,
    "time_zone" TEXT,
    "offset" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."HealthData" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "data_type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_user_id_key" ON "public"."User"("user_id");
