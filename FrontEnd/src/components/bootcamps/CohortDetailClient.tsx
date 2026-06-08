"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { axiosInstance } from "@/lib/api/axios";
import { useApiQuery } from "@/lib/api/query";

type CohortMember = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type Lesson = {
  id: number;
  title: string;
  type: "video" | "live" | "assignment";
  status: "pending" | "reviewed" | "approved";
};

type Week = {
  id: number;
  title: string;
  lessons: Lesson[];
};

type CohortDetail = {
  id: number;
  bootcampId: number;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
  size: number;
  members: CohortMember[];
  weeks: Week[];
  memberCount: number;
  weekCount: number;
};

const tabs = ["Members", "Curriculum", "Assignments"] as const;

export default function CohortDetailClient({ cohortId, bootcampId }: { cohortId: number; bootcampId: number }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Members");
  const [memberEmail, setMemberEmail] = useState("");
  const [newWeekTitle, setNewWeekTitle] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonType, setLessonType] = useState<Lesson["type"]>("video");
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const { data: cohort, isLoading, isError, refetch } = useApiQuery<CohortDetail>(
    ["cohort", cohortId],
    `/cohorts/${cohortId}`
  );

  const { data: memberData, refetch: refetchMembers } = useApiQuery<{ data: CohortMember[] }>(
    ["cohort-members", cohortId],
    `/cohorts/${cohortId}/members`
  );

  const { data: curriculumData, refetch: refetchCurriculum } = useApiQuery<{ data: Week[] }>(
    ["cohort-curriculum", cohortId],
    `/cohorts/${cohortId}/curriculum`
  );

  const members = memberData?.data || cohort?.members || [];
  const weeks = curriculumData?.data || cohort?.weeks || [];

  const assignmentRows = useMemo(
    () =>
      weeks.flatMap((week) =>
        week.lessons
          .filter((lesson) => lesson.type === "assignment")
          .map((lesson) => ({ ...lesson, weekTitle: week.title }))
      ),
    [weeks]
  );

  async function handleEnrol() {
    await axiosInstance.post(`/cohorts/${cohortId}/members`, { email: memberEmail });
    setMemberEmail("");
    setMessage("Member enrolled");
    await refetchMembers();
    await refetch();
  }

  async function handleAddWeek() {
    await axiosInstance.post(`/cohorts/${cohortId}/curriculum`, { action: "week", title: newWeekTitle });
    setNewWeekTitle("");
    await refetchCurriculum();
    await refetch();
  }

  async function handleAddLesson() {
    if (!selectedWeekId) return;
    await axiosInstance.post(`/cohorts/${cohortId}/curriculum`, {
      action: "lesson",
      weekId: selectedWeekId,
      title: lessonTitle,
      type: lessonType,
    });
    setLessonTitle("");
    await refetchCurriculum();
    await refetch();
  }

  async function moveWeek(weekId: number, direction: -1 | 1) {
    const index = weeks.findIndex((week) => week.id === weekId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= weeks.length) return;
    const reordered = [...weeks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    await axiosInstance.patch(`/cohorts/${cohortId}/curriculum`, {
      action: "reorder-weeks",
      orderedIds: reordered.map((week) => week.id),
    });
    await refetchCurriculum();
  }

  async function moveLesson(weekId: number, lessonId: number, direction: -1 | 1) {
    const week = weeks.find((item) => item.id === weekId);
    if (!week) return;
    const index = week.lessons.findIndex((lesson) => lesson.id === lessonId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= week.lessons.length) return;
    const reordered = [...week.lessons];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    await axiosInstance.patch(`/cohorts/${cohortId}/curriculum`, {
      action: "reorder-lessons",
      weekId,
      orderedIds: reordered.map((lesson) => lesson.id),
    });
    await refetchCurriculum();
  }

  async function updateAssignmentStatus(weekId: number, lessonId: number, status: Lesson["status"]) {
    await axiosInstance.put(`/cohorts/${cohortId}/curriculum`, {
      action: "lesson",
      weekId,
      lessonId,
      status,
    });
    await refetchCurriculum();
  }

  async function removeLesson(weekId: number, lessonId: number) {
    await axiosInstance.delete(`/cohorts/${cohortId}/curriculum`, {
      params: { action: "lesson", weekId, lessonId },
    });
    await refetchCurriculum();
  }

  async function removeWeek(weekId: number) {
    await axiosInstance.delete(`/cohorts/${cohortId}/curriculum`, {
      params: { action: "week", weekId },
    });
    await refetchCurriculum();
    await refetch();
  }

  async function removeMember(memberId: number) {
    await axiosInstance.delete(`/cohorts/${cohortId}/members`, {
      params: { memberId },
    });
    await refetchMembers();
    await refetch();
  }

  if (isLoading) return <div className="p-6">Loading cohort...</div>;
  if (isError || !cohort) {
    return (
      <div className="p-6 space-y-4">
        <p>Cohort not found.</p>
        <Link href={`/bootcamps/${bootcampId}/cohorts`} className="btn btn-sm btn-primary">
          Back to cohorts
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{cohort.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {cohort.startDate} → {cohort.endDate} · {cohort.active ? "Active" : "Inactive"} · {cohort.memberCount || members.length} members
          </p>
        </div>
        <Link href={`/bootcamps/${bootcampId}/cohorts`} className="btn btn-sm btn-ghost">
          Back to cohorts
        </Link>
      </div>

      <div className="flex gap-2 border-b pb-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? "rounded-md border-b-2 border-sky-500 px-3 py-2 text-sm font-medium"
                : "rounded-md px-3 py-2 text-sm text-muted-foreground"
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Members" && (
        <div className="space-y-4 rounded-lg border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              className="input input-bordered"
              placeholder="Search user email to enrol"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleEnrol}>
              Enrol member
            </button>
          </div>
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.email} · {member.role}</p>
                </div>
                <button className="btn btn-sm btn-ghost text-red-600" onClick={() => removeMember(member.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "Curriculum" && (
        <div className="space-y-4 rounded-lg border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              className="input input-bordered"
              placeholder="New week title"
              value={newWeekTitle}
              onChange={(e) => setNewWeekTitle(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleAddWeek}>
              Add week
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_160px_1fr_auto]">
            <input
              className="input input-bordered"
              placeholder="Lesson title"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
            />
            <select
              className="select select-bordered"
              value={selectedWeekId || ""}
              onChange={(e) => setSelectedWeekId(Number(e.target.value))}
            >
              <option value="">Select week</option>
              {weeks.map((week) => (
                <option key={week.id} value={week.id}>
                  {week.title}
                </option>
              ))}
            </select>
            <select className="select select-bordered" value={lessonType} onChange={(e) => setLessonType(e.target.value as Lesson["type"]) }>
              <option value="video">Video</option>
              <option value="live">Live</option>
              <option value="assignment">Assignment</option>
            </select>
            <button className="btn btn-primary" onClick={handleAddLesson}>
              Add lesson
            </button>
          </div>

          <div className="space-y-4">
            {weeks.map((week, weekIndex) => (
              <div key={week.id} className="rounded-md border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold">{week.title}</p>
                    <p className="text-xs text-muted-foreground">{week.lessons.length} lessons</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-sm" onClick={() => moveWeek(week.id, -1)} disabled={weekIndex === 0}>
                      Up
                    </button>
                    <button className="btn btn-sm" onClick={() => moveWeek(week.id, 1)} disabled={weekIndex === weeks.length - 1}>
                      Down
                    </button>
                    <button className="btn btn-sm btn-ghost text-red-600" onClick={() => removeWeek(week.id)}>
                      Delete week
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {week.lessons.map((lesson, lessonIndex) => (
                    <div key={lesson.id} className="flex items-center justify-between rounded border p-3">
                      <div>
                        <p className="font-medium">{lesson.title}</p>
                        <p className="text-xs text-muted-foreground">{lesson.type} · {lesson.status}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        <button className="btn btn-sm" onClick={() => moveLesson(week.id, lesson.id, -1)} disabled={lessonIndex === 0}>
                          Up
                        </button>
                        <button className="btn btn-sm" onClick={() => moveLesson(week.id, lesson.id, 1)} disabled={lessonIndex === week.lessons.length - 1}>
                          Down
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => updateAssignmentStatus(week.id, lesson.id, "reviewed") }>
                          Review
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => updateAssignmentStatus(week.id, lesson.id, "approved") }>
                          Approve
                        </button>
                        <button className="btn btn-sm btn-ghost text-red-600" onClick={() => removeLesson(week.id, lesson.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "Assignments" && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          {assignmentRows.length ? (
            assignmentRows.map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{assignment.title}</p>
                  <p className="text-xs text-muted-foreground">{assignment.weekTitle} · {assignment.status}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-sm btn-outline" onClick={() => updateAssignmentStatus(weeks.find((week) => week.title === assignment.weekTitle)?.id || 0, assignment.id, "reviewed") }>
                    Reviewed
                  </button>
                  <button className="btn btn-sm btn-outline" onClick={() => updateAssignmentStatus(weeks.find((week) => week.title === assignment.weekTitle)?.id || 0, assignment.id, "approved") }>
                    Approved
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No assignment lessons yet.</p>
          )}
        </div>
      )}

      {message ? <p className="text-sm text-sky-700">{message}</p> : null}
    </div>
  );
}
