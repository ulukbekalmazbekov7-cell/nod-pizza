export type UserRole = "admin" | "manager" | "qc";

export type InspectionStatus = "draft" | "in_progress" | "completed" | "needs_review";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
  branch_id: number | null;
  branch_ids: number[];
  created_at?: string;
  updated_at?: string;
};

export type Branch = {
  id: number;
  name: string;
  manager?: string;
  address?: string;
  status?: string;
  created_at?: string;
};

export type Employee = {
  id?: number;
  full_name: string;
  position: string;
  status: string;
  branch_id: number | null;
  branches?: { name: string } | null;
};

export type CriterionSeverity = "minor" | "medium" | "critical" | "none" | "informational";

export type CriterionAnswer = "yes" | "no" | "no_data" | "not_applicable";

export type InspectionSubcategory = {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
  description?: string | null;
  criteria?: InspectionCriterion[];
};

export type InspectionCategory = {
  id: string;
  name: string;
  sort_order: number;
  description?: string | null;
  subcategories?: InspectionSubcategory[];
};

export type InspectionCriterion = {
  id: string;
  subcategory_id: string;
  title: string;
  severity: CriterionSeverity;
  penalty_points: number;
  is_evaluated: boolean;
  sort_order: number;
  description?: string | null;
  subcategory?: InspectionSubcategory & {
    category?: Pick<InspectionCategory, "id" | "name"> | Pick<InspectionCategory, "id" | "name">[] | null;
  };
};

export type InspectionResult = {
  id?: string;
  inspection_id: number;
  criterion_id: string;
  answer: CriterionAnswer;
  comment?: string | null;
  criterion?: InspectionCriterion;
};

export type Inspection = {
  id?: number;
  branch_id: number;
  inspector: string;
  score: number | null;
  comment: string;
  status: InspectionStatus;
  author_id?: string | null;
  inspected_at?: string | null;
  minor_violations?: number;
  medium_violations?: number;
  critical_violations?: number;
  non_scoring_findings?: number;
  total_penalties?: number;
  created_at?: string;
  branches?: { name: string } | { name: string }[] | null;
  results?: InspectionResult[];
};

export type InspectionPhoto = {
  id: string;
  inspection_id: number;
  storage_path: string;
  uploaded_by: string | null;
  criterion_id?: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};
