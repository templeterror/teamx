"use client";
import Link from "next/link";
import { useState } from "react";
import { CourseSearch } from "./course-search";
import { usePlan, formatMeetings } from "./use-plan";
import "./plan.css";
import { SchedulePair } from "@/components/schedule-pair/schedule-pair";

export function WeekPlan({term="Spring 2027"}:{term?:string}) {
 const plan=usePlan();
 const [view,setView]=useState("plan");
 const active=plan.placements.filter(p=>!p.deferred);
 return <div className="plan workspace"><aside className="navigation"><Link href="/term" className="brand"><b>T</b><span>Course Planner<small>Temple University</small></span></Link><Link href="/term" className="term-switch">{term} ↗</Link><p className="nav-label">Workspace</p><nav aria-label="Planning workspace">{[["plan","Your plan"],["review","Review & register"]].map(([id,label],i)=><button key={id} aria-current={view===id?"page":undefined} onClick={()=>setView(id)}><span>0{i+1}</span>{label}</button>)}</nav><div className="student">Rafiat Amir<small>Computer Science · BS</small></div></aside><main className="workspace-main"><div className="breadcrumb">Registration / {term}<span>Demo · sample meeting times</span></div><header className="workspace-heading"><div><p className="eyebrow">{term} / Computer Science</p><h1>{view==="plan"?"A week that works for you.":"One last look."}</h1><p className="intro">{view==="plan"?"Your starting plan is here. Make room for what comes next.":"Check your courses before registering in Banner."}</p></div><button className="btn primary" onClick={()=>view==="review"?window.print():setView(view==="plan"?"review":"plan")}>{view==="review"?"Print course list":view==="plan"?"Review plan →":"Back to plan →"}</button></header>{view==="plan"?<><section className="top-course-search" aria-label="Find classes"><CourseSearch plan={plan}/></section><SchedulePair plan={plan}/></>:<section className="review-panel"><h2>Your course list</h2><p>Planning does not register you for classes. Confirm availability and prerequisites in Banner.</p>{active.map(p=><div className="review-row" key={p.id}><div><strong>{p.course.code}</strong><p>{p.course.title}</p><small>{formatMeetings(p.course)}</small>{plan.conflictsFor(p.id).length>0&&<p className="warn">Time conflict — adjust your plan.</p>}</div><span>{p.course.credits} credits</span></div>)}<p>{plan.credits} credits{plan.over?` · ${plan.over} over the planning limit`:""}</p></section>}</main></div>;
}
