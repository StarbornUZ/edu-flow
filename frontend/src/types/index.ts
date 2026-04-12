// ─── User & Auth ─────────────────────────────────────────────────────────────
export type UserRole = "admin" | "org_admin" | "teacher" | "student" | "parent";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  org_id: string | null;
  avatar_url: string | null;
  phone: string | null;
  xp: number;
  level: number;
  streak_count: number;
  streak_last_date: string | null;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ─── Organization ────────────────────────────────────────────────────────────
export type OrgType = "school" | "learning_center" | "university";
export type OrgPlan = "free_trial" | "starter" | "growth" | "scale";
export type OrgStatus = "active" | "suspended" | "trial";
export type OrgRequestStatus = "pending" | "approved" | "rejected";

export interface Organization {
  id: string;
  name: string;
  type: OrgType;
  plan: OrgPlan;
  status: OrgStatus;
  address: string | null;
  phone: string | null;
  ai_tokens_used: number;
  ai_token_limit: number | null;
}

export interface OrgRequest {
  id: string;
  user_id: string;
  org_data: {
    name: string;
    type: OrgType;
    address?: string;
    phone?: string;
    stir?: string;
    responsible_person: string;
  };
  status: OrgRequestStatus;
  review_note: string | null;
  organization_id: string | null;
  created_at?: string;
}

// ─── Subject ─────────────────────────────────────────────────────────────────
export interface Subject {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_default: boolean;
  org_id: string | null;
}

// ─── Course ──────────────────────────────────────────────────────────────────
export type CourseStatus = "draft" | "published" | "archived";
export type CourseDifficulty = "beginner" | "intermediate" | "advanced";

export interface Course {
  id: string;
  teacher_id: string;
  org_id: string | null;
  title: string;
  description: string;
  subject: string;
  subject_id: string | null;
  difficulty: CourseDifficulty;
  cover_url: string | null;
  is_ai_generated: boolean;
  status: CourseStatus;
  created_at: string;
  updated_at: string;
}

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  content_md: string;
  order_number: number;
  is_published: boolean;
}

// ─── Topic ───────────────────────────────────────────────────────────────────
export interface Topic {
  id: string;
  module_id: string;
  title: string;
  order_index: number;
  content_md: string | null;
  content_latex: string | null;
  video_url: string | null;
  is_published: boolean;
}

// ─── Class ───────────────────────────────────────────────────────────────────
export interface Class {
  id: string;
  teacher_id: string;
  org_id: string | null;
  name: string;
  subject: string;
  academic_year: string;
  class_code: string;
  class_code_expires_at: string | null;
  grade_level: number | null;
  created_at: string;
}

export interface ClassEnrollment {
  id: string;
  class_id: string;
  student_id: string;
  status: "active" | "inactive";
  created_at: string;
}

// ─── Assignment & Questions ──────────────────────────────────────────────────
export type QuestionType = "mcq" | "fill" | "matching" | "ordering" | "open_answer" | "timed";

export interface Assignment {
  id: string;
  course_id: string;
  topic_id: string | null;
  teacher_id: string;
  title: string;
  instructions: string | null;
  question_type: QuestionType;
  time_limit_sec: number | null;
  max_attempts: number;
  deadline: string | null;
  is_ai_generated: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  assignment_id: string;
  question_text: string;
  question_type: QuestionType;
  options_json: unknown;
  correct_answer_json?: unknown;
  rubric_json?: unknown;
  explanation: string | null;
  points_max: number;
  order_number: number;
}

// ─── Submission ──────────────────────────────────────────────────────────────
export type SubmissionStatus = "pending" | "ai_reviewed" | "teacher_confirmed";

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  answers_json: Record<string, unknown>;
  attempt_num: number;
  status: SubmissionStatus;
  submitted_at: string;
  results?: SubmissionResult[];
}

export interface SubmissionResult {
  id: string;
  submission_id: string;
  question_id: string;
  student_answer: string;
  is_correct: boolean | null;
  ai_score: number | null;
  ai_feedback: string | null;
  teacher_score: number | null;
  teacher_note: string | null;
  xp_earned: number;
}

// ─── Live Session ────────────────────────────────────────────────────────────
export type GameType = "lucky_card" | "blitz" | "relay" | "question_duel" | "territory" | "pyramid" | "puzzle";
export type SessionStatus = "pending" | "active" | "finished";

export interface LiveSession {
  id: string;
  teacher_id: string;
  course_id: string | null;
  game_type: GameType;
  status: SessionStatus;
  config: Record<string, unknown>;
  questions: Record<string, unknown>[];
  current_question_index: number;
}

export interface LiveSessionTeam {
  id: string;
  session_id: string;
  name: string;
  color: string;
  score: number;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export interface TeacherDashboard {
  classes: { class_id: string; name: string; subject: string; student_count: number; active_assignments: number }[];
  pending_reviews: { submission_id: string; assignment_id: string; student_id: string; student_name: string; attempt_num: number; submitted_at: string }[];
  pending_count: number;
  problem_questions: { question_id: string; question_text: string; total_attempts: number; error_rate: number }[];
}

export interface StudentDashboard {
  xp: number;
  level: number;
  streak_count: number;
  streak_last_date: string | null;
  active_courses: { course_id: string; title: string; subject: string; difficulty: string; cover_url: string | null; completed_modules: number }[];
  active_courses_count: number;
  recent_achievements: { badge_type: string; metadata: Record<string, unknown>; earned_at: string }[];
}

export interface OrgDashboard {
  org_id: string;
  stats: {
    teachers: number;
    students: number;
    classes: number;
    courses: number;
  };
}

// ─── Badge ───────────────────────────────────────────────────────────────────
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: Record<string, unknown>;
}

export interface GamificationResult {
  xp_earned: number;
  new_level: number | null;
  new_badges: string[];
}
