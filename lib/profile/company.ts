import { getPool } from "@/lib/db/pool";
import type {
  CompanyProfile,
  CompanyProfileInput,
  GoalId,
  NicheId,
  ServiceId,
  BudgetRange,
} from "@/lib/profile/types";

type DbCompanyRow = {
  id: string;
  user_id: string;
  company_name: string;
  niche: string;
  phone: string | null;
  city: string | null;
  website: string | null;
  address: string | null;
  goals: GoalId[] | string;
  budget_range: BudgetRange | null;
  desired_services: ServiceId[] | string;
  team_size: string | null;
  description: string | null;
  onboarding_step: number;
  onboarding_completed: boolean;
  created_at: Date;
  updated_at: Date;
};

function parseJsonArray<T>(value: T[] | string): T[] {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value as string) as T[];
  } catch {
    return [];
  }
}

export function rowToCompany(row: DbCompanyRow): CompanyProfile {
  return {
    id: row.id,
    userId: row.user_id,
    companyName: row.company_name,
    niche: row.niche as NicheId,
    phone: row.phone,
    city: row.city,
    website: row.website,
    address: row.address,
    goals: parseJsonArray<GoalId>(row.goals),
    budgetRange: row.budget_range,
    desiredServices: parseJsonArray<ServiceId>(row.desired_services),
    teamSize: row.team_size,
    description: row.description,
    onboardingStep: row.onboarding_step,
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getCompanyByUserId(
  userId: string
): Promise<CompanyProfile | null> {
  const pool = getPool();
  const { rows } = await pool.query<DbCompanyRow>(
    `SELECT * FROM company_profiles WHERE user_id = $1`,
    [userId]
  );
  return rows[0] ? rowToCompany(rows[0]) : null;
}

export async function upsertCompanyProfile(
  userId: string,
  input: CompanyProfileInput
): Promise<CompanyProfile> {
  const pool = getPool();
  const existing = await getCompanyByUserId(userId);

  if (!existing) {
    const { rows } = await pool.query<DbCompanyRow>(
      `INSERT INTO company_profiles (
        user_id, company_name, niche, phone, city, website, address,
        goals, budget_range, desired_services, team_size, description,
        onboarding_step, onboarding_completed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        userId,
        input.companyName ?? "",
        input.niche ?? "restaurants",
        input.phone ?? null,
        input.city ?? null,
        input.website ?? null,
        input.address ?? null,
        JSON.stringify(input.goals ?? []),
        input.budgetRange ?? null,
        JSON.stringify(input.desiredServices ?? []),
        input.teamSize ?? null,
        input.description ?? null,
        input.onboardingStep ?? 0,
        input.onboardingCompleted ?? false,
      ]
    );
    return rowToCompany(rows[0]);
  }

  const merged = {
    companyName: input.companyName ?? existing.companyName,
    niche: input.niche ?? existing.niche,
    phone: input.phone !== undefined ? input.phone : existing.phone,
    city: input.city !== undefined ? input.city : existing.city,
    website: input.website !== undefined ? input.website : existing.website,
    address: input.address !== undefined ? input.address : existing.address,
    goals: input.goals ?? existing.goals,
    budgetRange:
      input.budgetRange !== undefined
        ? input.budgetRange
        : existing.budgetRange,
    desiredServices: input.desiredServices ?? existing.desiredServices,
    teamSize:
      input.teamSize !== undefined ? input.teamSize : existing.teamSize,
    description:
      input.description !== undefined ? input.description : existing.description,
    onboardingStep: input.onboardingStep ?? existing.onboardingStep,
    onboardingCompleted:
      input.onboardingCompleted ?? existing.onboardingCompleted,
  };

  const { rows } = await pool.query<DbCompanyRow>(
    `UPDATE company_profiles SET
      company_name = $2,
      niche = $3,
      phone = $4,
      city = $5,
      website = $6,
      address = $7,
      goals = $8,
      budget_range = $9,
      desired_services = $10,
      team_size = $11,
      description = $12,
      onboarding_step = $13,
      onboarding_completed = $14,
      updated_at = NOW()
    WHERE user_id = $1
    RETURNING *`,
    [
      userId,
      merged.companyName,
      merged.niche,
      merged.phone,
      merged.city,
      merged.website,
      merged.address,
      JSON.stringify(merged.goals),
      merged.budgetRange,
      JSON.stringify(merged.desiredServices),
      merged.teamSize,
      merged.description,
      merged.onboardingStep,
      merged.onboardingCompleted,
    ]
  );

  return rowToCompany(rows[0]);
}
