import { courses, sections } from "@/data";

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

type CourseLike = { code: string; title: string; credits: { value?: number } };
type SectionLike = { course: string; days: string[]; start: string; end: string };

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/* A course at the meeting time of one of its sections. The finder builds its rows the same way. */
export function sectionOffering(course: CourseLike, section: SectionLike, why: string): Offering {
  return {
    code: course.code,
    title: course.title,
    credits: course.credits.value ?? 0,
    days: section.days.map((d) => d.slice(0, 3) as Day),
    start: minutes(section.start),
    end: minutes(section.end),
    why,
  };
}

/* The placeholder section in sections.json for a course in courses.json. */
export function offeringFor(code: string, why: string): Offering {
  const course = (courses as Record<string, CourseLike | undefined>)[code];
  const section = (sections as SectionLike[]).find((s) => s.course === code);
  if (!course || !section) throw new Error(`${code} needs a course and a section`);
  return sectionOffering(course, section, why);
}

/*
 * Spring 2027. The first five are what the student registered for; the rest are the
 * "Or" options beside them. Each option is open to this student (prerequisites met
 * by completed or in-progress courses) and meets at a time none of the five does.
 */

/* Core */
export const softwareDesign = offeringFor("CIS 3296", "Required. Writing intensive.");

/* Elective slot: CIS 4526 */
export const machineLearning = offeringFor("CIS 4526", "Major elective. Prerequisites met.");
export const dataScience = offeringFor("CIS 3715", "Major elective. Prerequisites met.");
export const dataIntensive = offeringFor("CIS 4517", "Major elective. Prerequisites met.");

/* Elective slot: CIS 4360 */
export const seminar = offeringFor("CIS 4360", "Major elective. Prerequisites met.");
export const compilers = offeringFor("CIS 4324", "Major elective. Prerequisites met.");
export const microservices = offeringFor("CIS 3523", "Major elective. Prerequisites met.");

/* The elective that takes Software Design's place when it moves to a later term */
export const webApps = offeringFor("CIS 3308", "Major elective. Prerequisites met.");
export const automata = offeringFor("CIS 3211", "Major elective. Prerequisites met.");

/* Gen ed slot: Arts */
export const meaningOfArts = offeringFor("PHIL 0847", "Gen ed · Arts.");
export const sacredSpace = offeringFor("ARTH 0803", "Gen ed · Arts.");
export const shakespeareMovies = offeringFor("ENG 0822", "Gen ed · Arts.");

/* Gen ed slot: U.S. Society */
export const whyCollege = offeringFor("AMST 0855", "Gen ed · U.S. Society.");
export const socialMovements = offeringFor("COMC 0801", "Gen ed · U.S. Society.");
export const constitution = offeringFor("LAWU 0825", "Gen ed · U.S. Society.");

/* Every Offering above, so the finder and the record agree with the plan. */
export const PLAN_OFFERINGS: Offering[] = [
  softwareDesign,
  machineLearning,
  dataScience,
  dataIntensive,
  seminar,
  compilers,
  microservices,
  webApps,
  automata,
  meaningOfArts,
  sacredSpace,
  shakespeareMovies,
  whyCollege,
  socialMovements,
  constitution,
];

export const DAY_START = 9 * 60;
export const DAY_END = 17 * 60;
export const CREDIT_MIN = 12;
export const CREDIT_MAX = 18;
