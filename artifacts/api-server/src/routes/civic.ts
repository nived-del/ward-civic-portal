import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomInt } from "node:crypto";
import { logger } from "../lib/logger";

type Role = "citizen" | "admin";
type Status =
  | "Submitted"
  | "Under Review"
  | "Assigned"
  | "In Progress"
  | "Resolved"
  | "Rejected";
type Priority = "Low" | "Medium" | "High" | "Critical";

type User = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  passwordHash: string;
  ward: string;
  address: string;
  role: Role;
  isVerified: boolean;
  isActive: boolean;
};

type HistoryEntry = {
  status: Status;
  date: string;
  updatedBy: string;
  remark: string | null;
};

type Issue = {
  id: string;
  title: string;
  category: string;
  description: string;
  ward: string;
  location: string;
  landmark: string;
  priority: Priority;
  status: Status;
  image: string | null;
  adminRemark: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  citizenName: string;
  citizenEmail: string;
  history: HistoryEntry[];
};

type PendingOtp = {
  code: string;
  expiresAt: number;
  attempts: number;
  purpose: "registration" | "reset";
  cooldownUntil: number;
};

type AuthenticatedRequest = Request & {
  user?: User;
};

const router: IRouter = Router();
const jwtSecret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET ?? "civic-portal-development-secret";
const otpStore = new Map<string, PendingOtp>();
const users: User[] = [];
const issues: Issue[] = [];
let nextIssueNumber = 11;

const now = () => new Date().toISOString();
const publicUser = (user: User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  mobile: user.mobile,
  ward: user.ward,
  address: user.address,
  role: user.role,
  isVerified: user.isVerified,
});
const responseMessage = (res: Response, status: number, message: string) =>
  res.status(status).json({ success: status < 400, message });

function createUser(
  input: Omit<User, "passwordHash" | "isActive"> & { password: string },
) {
  const user: User = {
    ...input,
    passwordHash: bcrypt.hashSync(input.password, 10),
    isActive: true,
  };
  users.push(user);
  return user;
}

const demoCitizen = createUser({
  id: "USR001",
  name: "Aarav Mehta",
  email: "citizen@example.com",
  mobile: "9876543210",
  password: "citizen123",
  ward: "Ward 5",
  address: "14 Lake View Road",
  role: "citizen",
  isVerified: true,
});
createUser({
  id: "ADM001",
  name: "Ward Office",
  email: "admin@example.com",
  mobile: "9000000000",
  password: "admin123",
  ward: "Ward 5",
  address: "Ward 5 Municipal Office",
  role: "admin",
  isVerified: true,
});

const seededIssues: Array<
  Omit<Issue, "userId" | "citizenName" | "citizenEmail" | "history"> & {
    history?: HistoryEntry[];
  }
> = [
  {
    id: "ISS001",
    title: "Broken streetlight on Lake View Road",
    category: "Streetlight",
    description: "The streetlight beside the bus stop has been out for four nights.",
    ward: "Ward 5",
    location: "Lake View Road",
    landmark: "Bus stop near gate 2",
    priority: "High",
    status: "Submitted",
    image: null,
    adminRemark: null,
    createdAt: "2026-09-18T08:20:00.000Z",
    updatedAt: "2026-09-18T08:20:00.000Z",
  },
  {
    id: "ISS002",
    title: "Overflowing waste collection point",
    category: "Garbage/Waste",
    description: "Waste has not been collected and is blocking the footpath.",
    ward: "Ward 5",
    location: "Market Lane",
    landmark: "Opposite the community hall",
    priority: "Medium",
    status: "In Progress",
    image: null,
    adminRemark: "Sanitation crew has been assigned for the next collection round.",
    createdAt: "2026-09-15T06:15:00.000Z",
    updatedAt: "2026-09-17T10:00:00.000Z",
  },
  {
    id: "ISS003",
    title: "Large pothole at school crossing",
    category: "Road Damage",
    description: "A deep pothole has formed at the crossing used by school children.",
    ward: "Ward 3",
    location: "Station Road",
    landmark: "Government primary school",
    priority: "Critical",
    status: "Resolved",
    image: null,
    adminRemark: "Road patching was completed on 16 September.",
    createdAt: "2026-09-08T12:00:00.000Z",
    updatedAt: "2026-09-16T09:30:00.000Z",
  },
  {
    id: "ISS004",
    title: "Blocked drain after rainfall",
    category: "Drainage",
    description: "The open drain is blocked with silt and water is entering nearby homes.",
    ward: "Ward 2",
    location: "Old Mill Street",
    landmark: "House 22",
    priority: "High",
    status: "Under Review",
    image: null,
    adminRemark: "The ward engineer is reviewing the site assessment.",
    createdAt: "2026-09-17T14:40:00.000Z",
    updatedAt: "2026-09-18T09:00:00.000Z",
  },
  {
    id: "ISS005",
    title: "Irregular water supply",
    category: "Water Supply",
    description: "Water supply has been intermittent for the last three mornings.",
    ward: "Ward 4",
    location: "Gandhi Nagar",
    landmark: "Community water tank",
    priority: "Medium",
    status: "Assigned",
    image: null,
    adminRemark: "A pipeline inspection has been scheduled.",
    createdAt: "2026-09-14T07:05:00.000Z",
    updatedAt: "2026-09-18T07:20:00.000Z",
  },
  {
    id: "ISS006",
    title: "Illegal dumping beside playground",
    category: "Illegal Dumping",
    description: "Construction waste is being dumped near the public playground.",
    ward: "Ward 1",
    location: "Green Park Extension",
    landmark: "Children's playground",
    priority: "High",
    status: "Rejected",
    image: null,
    adminRemark: "This location is managed by the development authority; the report was forwarded.",
    createdAt: "2026-09-10T11:10:00.000Z",
    updatedAt: "2026-09-12T15:00:00.000Z",
  },
  {
    id: "ISS007",
    title: "Public toilet needs maintenance",
    category: "Public Toilet",
    description: "The public toilet near the market needs cleaning and a working tap.",
    ward: "Ward 5",
    location: "Central Market",
    landmark: "East entrance",
    priority: "Medium",
    status: "Submitted",
    image: null,
    adminRemark: null,
    createdAt: "2026-09-18T13:25:00.000Z",
    updatedAt: "2026-09-18T13:25:00.000Z",
  },
  {
    id: "ISS008",
    title: "Damaged footpath tiles",
    category: "Public Infrastructure",
    description: "Several footpath tiles are loose outside the library.",
    ward: "Ward 5",
    location: "Library Street",
    landmark: "Public library",
    priority: "Low",
    status: "Resolved",
    image: null,
    adminRemark: "Replacement tiles were installed.",
    createdAt: "2026-09-05T09:45:00.000Z",
    updatedAt: "2026-09-13T11:40:00.000Z",
  },
];

for (const seed of seededIssues) {
  issues.push({
    ...seed,
    userId: demoCitizen.id,
    citizenName: demoCitizen.name,
    citizenEmail: demoCitizen.email,
    history: seed.history ?? [
      {
        status: seed.status,
        date: seed.updatedAt,
        updatedBy: seed.status === "Submitted" ? "Citizen" : "Ward Admin",
        remark: seed.adminRemark,
      },
    ],
  });
}

function getUserByIdentifier(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  return users.find(
    (user) => user.email.toLowerCase() === normalized || user.mobile === normalized,
  );
}

function issueForResponse(issue: Issue) {
  const { userId: _userId, ...result } = issue;
  return result;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: () => void) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    responseMessage(res, 401, "Authentication required");
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret) as { sub?: string };
    const user = users.find((candidate) => candidate.id === payload.sub);
    if (!user || !user.isActive) {
      responseMessage(res, 401, "Invalid or inactive account");
      return;
    }
    req.user = user;
    next();
  } catch {
    responseMessage(res, 401, "Invalid or expired session");
  }
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: () => void) {
  if (req.user?.role !== "admin") {
    responseMessage(res, 403, "Administrator access required");
    return;
  }
  next();
}

function validateIssueInput(body: Record<string, unknown>) {
  const required = ["title", "category", "description", "ward", "location", "landmark", "priority"];
  for (const field of required) {
    if (typeof body[field] !== "string" || !body[field]) return `${field} is required`;
  }
  if (String(body.title).length < 4) return "Title must contain at least 4 characters";
  if (String(body.description).length < 10) return "Description must contain at least 10 characters";
  if (!["Low", "Medium", "High", "Critical"].includes(String(body.priority))) return "Invalid priority";
  if (body.image && typeof body.image === "string" && body.image.length > 7_000_000) {
    return "Image must be less than 5 MB";
  }
  return null;
}

function generateOtp(email: string, purpose: PendingOtp["purpose"]) {
  const code = String(randomInt(100000, 1000000));
  const pending = {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0,
    purpose,
    cooldownUntil: Date.now() + 60 * 1000,
  } satisfies PendingOtp;
  otpStore.set(email.toLowerCase(), pending);
  if ((process.env.OTP_MODE ?? "development") === "development") {
    logger.info({ email, otp: code }, `[DEV OTP] OTP generated for ${email}`);
  }
}

router.post("/auth/register", (req, res) => {
  const { name, email, mobile, password, ward, address } = req.body as Record<string, unknown>;
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof mobile !== "string" ||
    typeof password !== "string" ||
    typeof ward !== "string" ||
    typeof address !== "string"
  ) {
    responseMessage(res, 400, "All registration fields are required");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    responseMessage(res, 400, "Please enter a valid email address");
    return;
  }
  if (!/^\d{10}$/.test(mobile)) {
    responseMessage(res, 400, "Please enter a valid 10-digit mobile number");
    return;
  }
  if (password.length < 8) {
    responseMessage(res, 400, "Password must contain at least 8 characters");
    return;
  }
  if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    responseMessage(res, 409, "An account with this email already exists");
    return;
  }
  const user = createUser({
    id: `USR${String(users.length + 1).padStart(3, "0")}`,
    name,
    email: email.toLowerCase(),
    mobile,
    password,
    ward,
    address,
    role: "citizen",
    isVerified: false,
  });
  generateOtp(user.email, "registration");
  responseMessage(res, 201, "Registration started. Verify the OTP to activate your account.");
});

router.post("/auth/send-otp", (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string") {
    responseMessage(res, 400, "Email is required");
    return;
  }
  const pending = otpStore.get(email.toLowerCase());
  if (pending && pending.cooldownUntil > Date.now()) {
    responseMessage(res, 429, "Please wait before requesting another OTP");
    return;
  }
  if (!users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    responseMessage(res, 404, "No account was found for that email");
    return;
  }
  generateOtp(email, "registration");
  responseMessage(res, 200, "OTP sent successfully");
});

router.post("/auth/verify-otp", (req, res) => {
  const { email, otp } = req.body as { email?: string; otp?: string };
  const pending = email ? otpStore.get(email.toLowerCase()) : undefined;
  if (!email || !otp || !pending) {
    responseMessage(res, 400, "No active OTP found");
    return;
  }
  if (Date.now() > pending.expiresAt) {
    otpStore.delete(email.toLowerCase());
    responseMessage(res, 400, "OTP has expired");
    return;
  }
  if (pending.attempts >= 5) {
    otpStore.delete(email.toLowerCase());
    responseMessage(res, 429, "Too many incorrect attempts");
    return;
  }
  if (pending.code !== otp) {
    pending.attempts += 1;
    responseMessage(res, 400, "Invalid OTP");
    return;
  }
  const user = users.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    responseMessage(res, 404, "Account not found");
    return;
  }
  if (pending.purpose === "registration") user.isVerified = true;
  otpStore.delete(email.toLowerCase());
  responseMessage(res, 200, "OTP verified successfully");
});

router.post("/auth/login", async (req, res) => {
  const { identifier, password } = req.body as { identifier?: string; password?: string };
  if (!identifier || !password) {
    responseMessage(res, 400, "Email/mobile and password are required");
    return;
  }
  const user = getUserByIdentifier(identifier);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    responseMessage(res, 401, "Invalid email/mobile or password");
    return;
  }
  if (!user.isVerified) {
    responseMessage(res, 403, "Please verify your account with OTP first");
    return;
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: "8h" });
  res.json({ success: true, message: "Login successful", token, user: publicUser(user) });
});

router.post("/auth/logout", (_req, res) => responseMessage(res, 200, "Logged out successfully"));

router.post("/auth/forgot-password", (req, res) => {
  const { email } = req.body as { email?: string };
  const user = email ? users.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase()) : undefined;
  if (!user) {
    responseMessage(res, 404, "No account was found for that email");
    return;
  }
  generateOtp(user.email, "reset");
  responseMessage(res, 200, "Password reset OTP sent successfully");
});

router.post("/auth/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body as { email?: string; otp?: string; newPassword?: string };
  const pending = email ? otpStore.get(email.toLowerCase()) : undefined;
  if (!email || !otp || !newPassword || !pending) {
    responseMessage(res, 400, "Email, OTP, and new password are required");
    return;
  }
  if (pending.purpose !== "reset" || pending.code !== otp || Date.now() > pending.expiresAt) {
    responseMessage(res, 400, "Invalid or expired OTP");
    return;
  }
  if (newPassword.length < 8) {
    responseMessage(res, 400, "Password must contain at least 8 characters");
    return;
  }
  const user = users.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    responseMessage(res, 404, "Account not found");
    return;
  }
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  otpStore.delete(email.toLowerCase());
  responseMessage(res, 200, "Password updated successfully");
});

router.get("/issues", requireAuth, (req: AuthenticatedRequest, res) => {
  const query = req.query as Record<string, string | undefined>;
  const visible = issues.filter((issue) => req.user?.role === "admin" || issue.userId === req.user?.id);
  const filtered = visible.filter((issue) => {
    const haystack = `${issue.id} ${issue.title} ${issue.category} ${issue.citizenName}`.toLowerCase();
    return (
      (!query.search || haystack.includes(query.search.toLowerCase())) &&
      (!query.status || issue.status === query.status) &&
      (!query.category || issue.category === query.category) &&
      (!query.priority || issue.priority === query.priority) &&
      (!query.ward || issue.ward === query.ward)
    );
  });
  res.json(filtered.map(issueForResponse));
});

router.post("/issues", requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== "citizen") {
    responseMessage(res, 403, "Only citizens can report issues");
    return;
  }
  const body = req.body as Record<string, unknown>;
  const validationError = validateIssueInput(body);
  if (validationError) {
    responseMessage(res, 400, validationError);
    return;
  }
  const created = now();
  const issue: Issue = {
    id: `ISS${String(nextIssueNumber++).padStart(3, "0")}`,
    title: String(body.title),
    category: String(body.category),
    description: String(body.description),
    ward: String(body.ward),
    location: String(body.location),
    landmark: String(body.landmark),
    priority: String(body.priority) as Priority,
    status: "Submitted",
    image: typeof body.image === "string" ? body.image : null,
    adminRemark: null,
    createdAt: created,
    updatedAt: created,
    userId: req.user.id,
    citizenName: req.user.name,
    citizenEmail: req.user.email,
    history: [{ status: "Submitted", date: created, updatedBy: "Citizen", remark: null }],
  };
  issues.unshift(issue);
  res.status(201).json(issueForResponse(issue));
});

router.get("/issues/:id", requireAuth, (req: AuthenticatedRequest, res) => {
  const issue = issues.find((candidate) => candidate.id === req.params.id);
  if (!issue || (req.user?.role !== "admin" && issue.userId !== req.user?.id)) {
    responseMessage(res, 404, "Issue not found");
    return;
  }
  res.json(issueForResponse(issue));
});

function updateIssue(issue: Issue, body: Record<string, unknown>, updatedBy: string) {
  const nextStatus = body.status as Status | undefined;
  const nextPriority = body.priority as Priority | undefined;
  if (nextStatus && !["Submitted", "Under Review", "Assigned", "In Progress", "Resolved", "Rejected"].includes(nextStatus)) {
    return "Invalid status";
  }
  if (nextPriority && !["Low", "Medium", "High", "Critical"].includes(nextPriority)) return "Invalid priority";
  const changedStatus = Boolean(nextStatus && nextStatus !== issue.status);
  if (nextStatus) issue.status = nextStatus;
  if (nextPriority) issue.priority = nextPriority;
  if (typeof body.adminRemark === "string") issue.adminRemark = body.adminRemark;
  issue.updatedAt = now();
  if (changedStatus) {
    issue.history.push({
      status: issue.status,
      date: issue.updatedAt,
      updatedBy,
      remark: issue.adminRemark,
    });
  }
  return null;
}

router.put("/issues/:id", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const issue = issues.find((candidate) => candidate.id === req.params.id);
  if (!issue) {
    responseMessage(res, 404, "Issue not found");
    return;
  }
  const error = updateIssue(issue, req.body as Record<string, unknown>, req.user?.name ?? "Ward Admin");
  if (error) {
    responseMessage(res, 400, error);
    return;
  }
  res.json(issueForResponse(issue));
});

router.patch("/issues/:id/status", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const issue = issues.find((candidate) => candidate.id === req.params.id);
  if (!issue) {
    responseMessage(res, 404, "Issue not found");
    return;
  }
  const error = updateIssue(issue, req.body as Record<string, unknown>, req.user?.name ?? "Ward Admin");
  if (error) {
    responseMessage(res, 400, error);
    return;
  }
  res.json(issueForResponse(issue));
});

router.patch("/issues/:id/priority", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const issue = issues.find((candidate) => candidate.id === req.params.id);
  if (!issue) {
    responseMessage(res, 404, "Issue not found");
    return;
  }
  const error = updateIssue(issue, req.body as Record<string, unknown>, req.user?.name ?? "Ward Admin");
  if (error) {
    responseMessage(res, 400, error);
    return;
  }
  res.json(issueForResponse(issue));
});

router.delete("/issues/:id", requireAuth, requireAdmin, (req, res) => {
  const index = issues.findIndex((candidate) => candidate.id === req.params.id);
  if (index === -1) {
    responseMessage(res, 404, "Issue not found");
    return;
  }
  issues.splice(index, 1);
  responseMessage(res, 200, "Issue deleted successfully");
});

router.get("/users/profile", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json(publicUser(req.user!));
});

router.put("/users/profile", requireAuth, (req: AuthenticatedRequest, res) => {
  const body = req.body as Record<string, unknown>;
  for (const field of ["name", "mobile", "ward", "address"]) {
    if (body[field] !== undefined && typeof body[field] !== "string") {
      responseMessage(res, 400, `${field} must be text`);
      return;
    }
  }
  Object.assign(req.user!, {
    ...(body.name ? { name: body.name } : {}),
    ...(body.mobile ? { mobile: body.mobile } : {}),
    ...(body.ward ? { ward: body.ward } : {}),
    ...(body.address ? { address: body.address } : {}),
  });
  res.json(publicUser(req.user!));
});

router.get("/dashboard/citizen", requireAuth, (req: AuthenticatedRequest, res) => {
  const mine = issues.filter((issue) => issue.userId === req.user?.id);
  res.json({
    total: mine.length,
    submitted: mine.filter((issue) => issue.status === "Submitted").length,
    inProgress: mine.filter((issue) => issue.status === "In Progress").length,
    resolved: mine.filter((issue) => issue.status === "Resolved").length,
    recent: mine.slice(0, 4).map(issueForResponse),
  });
});

router.get("/dashboard/admin", requireAuth, requireAdmin, (_req, res) => {
  const count = (status: Status) => issues.filter((issue) => issue.status === status).length;
  const byCategory = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.category] = (acc[issue.category] ?? 0) + 1;
    return acc;
  }, {});
  res.json({
    total: issues.length,
    submitted: count("Submitted"),
    underReview: count("Under Review"),
    assigned: count("Assigned"),
    inProgress: count("In Progress"),
    resolved: count("Resolved"),
    rejected: count("Rejected"),
    byCategory,
  });
});

export default router;