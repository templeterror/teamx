export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";

export type Offering = {
  code: string;
  title: string;
  credits: number;
  days: Day[];
  start: number;
  end: number;
  why: string;
};

export const os: Offering = {
  code: "CIS 3207",
  title: "Introduction to Systems Programming and Operating Systems",
  credits: 4,
  days: ["Mon", "Wed", "Fri"],
  start: 10 * 60,
  end: 10 * 60 + 50,
  why: "Required. Closes the systems course.",
};

export const writing: Offering = {
  code: "CIS 3296",
  title: "Software Design",
  credits: 4,
  days: ["Tue", "Thu"],
  start: 11 * 60,
  end: 12 * 60 + 20,
  why: "Writing intensive. Required, and you can move it to a later term.",
};

export const databases: Offering = {
  code: "CIS 4331",
  title: "Principles of Database Systems",
  credits: 4,
  days: ["Tue", "Thu"],
  start: 14 * 60,
  end: 15 * 60 + 20,
  why: "Suggested major elective. Prerequisite met.",
};

export const dataScience: Offering = {
  code: "CIS 3715",
  title: "Principles of Data Science",
  credits: 4,
  days: ["Mon", "Wed", "Fri"],
  start: 13 * 60,
  end: 13 * 60 + 50,
  why: "Major elective. Prerequisite met.",
};

export const agi: Offering = {
  code: "CIS 4203",
  title: "Artificial General Intelligence",
  credits: 3,
  days: ["Mon", "Wed", "Fri"],
  start: 15 * 60,
  end: 15 * 60 + 50,
  why: "Suggested major elective. Prerequisite met.",
};

export const webApps: Offering = {
  code: "CIS 3308",
  title: "Web Application Programming",
  credits: 4,
  days: ["Tue", "Thu"],
  start: 9 * 60 + 30,
  end: 10 * 60 + 50,
  why: "Major elective. Prerequisite met.",
};

export const college: Offering = {
  code: "AMST 0862",
  title: "Why care about College: Higher Education in American Life",
  credits: 3,
  days: ["Tue", "Thu"],
  start: 15 * 60 + 30,
  end: 16 * 60 + 50,
  why: "Suggested for the one gen ed still open.",
};

export const society: Offering = {
  code: "AMST 0859",
  title: "The Making of American Society: Melting Pot or Culture Wars?",
  credits: 3,
  days: ["Mon", "Wed"],
  start: 11 * 60 + 20,
  end: 12 * 60 + 35,
  why: "Also satisfies the gen ed still open.",
};

export const DAY_START = 9 * 60;
export const DAY_END = 17 * 60;
export const CREDIT_MIN = 12;
export const CREDIT_MAX = 18;
