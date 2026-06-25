'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useApiQuery } from '@/lib/api/query';
import {
  addCohortLesson,
  addCohortWeek,
  enrollCohortMember,
  fetchCohortById,
  fetchCohortCurriculum,
  fetchCohortMembers,
  removeCohortLesson,
  removeCohortMember,
  removeCohortWeek,
  reorderCohortLessons,
  reorderCohortWeeks,
  updateCohortLessonStatus,
  type CohortDetail,
  type CohortMember,
  type CohortWeek,
} from '@/lib/api/cohorts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';

type Lesson = CohortWeek['lessons'][number];
type Week = CohortWeek;

export default function CohortDetailClient({
  cohortId,
  bootcampId,
}: {
  cohortId: string;
  bootcampId: string;
}) {
  const router = useRouter();
  const [memberEmail, setMemberEmail] = useState('');
  const [newWeekTitle, setNewWeekTitle] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonType, setLessonType] = useState<Lesson['type']>('video');
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');
  const [message, setMessage] = useState('');

  const {
    data: cohort,
    isLoading,
    isError,
    refetch,
  } = useApiQuery<CohortDetail>(['cohort', cohortId], `/cohorts/${cohortId}`);

  const { data: memberData, refetch: refetchMembers } = useApiQuery<{ data: CohortMember[] }>(
    ['cohort-members', cohortId],
    `/cohorts/${cohortId}/members`,
  );

  const { data: curriculumData, refetch: refetchCurriculum } = useApiQuery<{ data: Week[] }>(
    ['cohort-curriculum', cohortId],
    `/cohorts/${cohortId}/curriculum`,
  );

  const members = memberData?.data || cohort?.members || [];
  const weeks = curriculumData?.data || cohort?.weeks || [];

  const assignmentRows = useMemo(
    () =>
      weeks.flatMap((week) =>
        week.lessons
          .filter((lesson) => lesson.type === 'assignment')
          .map((lesson) => ({ ...lesson, weekTitle: week.title })),
      ),
    [weeks],
  );

  async function handleEnrol() {
    await enrollCohortMember(cohortId, memberEmail);
    setMemberEmail('');
    setMessage('Member enrolled');
    await refetchMembers();
    await refetch();
  }

  async function handleAddWeek() {
    await addCohortWeek(cohortId, newWeekTitle);
    setNewWeekTitle('');
    await refetchCurriculum();
    await refetch();
  }

  async function handleAddLesson() {
    if (!selectedWeekId) return;
    await addCohortLesson(cohortId, {
      weekId: selectedWeekId,
      title: lessonTitle,
      type: lessonType,
    });
    setLessonTitle('');
    await refetchCurriculum();
    await refetch();
  }

  async function moveWeek(weekId: string, direction: -1 | 1) {
    const index = weeks.findIndex((week) => week.id === weekId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= weeks.length) return;
    const reordered = [...weeks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    await reorderCohortWeeks(
      cohortId,
      reordered.map((week) => week.id),
    );
    await refetchCurriculum();
  }

  async function moveLesson(weekId: string, lessonId: string, direction: -1 | 1) {
    const week = weeks.find((item) => item.id === weekId);
    if (!week) return;
    const index = week.lessons.findIndex((lesson) => lesson.id === lessonId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= week.lessons.length) return;
    const reordered = [...week.lessons];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    await reorderCohortLessons(cohortId, {
      weekId,
      orderedIds: reordered.map((lesson) => lesson.id),
    });
    await refetchCurriculum();
  }

  async function updateAssignmentStatus(
    weekId: string,
    lessonId: string,
    status: Lesson['status'],
  ) {
    if (!weekId) return;
    await updateCohortLessonStatus(cohortId, {
      weekId,
      lessonId,
      status,
    });
    await refetchCurriculum();
  }

  async function removeLesson(weekId: string, lessonId: string) {
    await removeCohortLesson(cohortId, { weekId, lessonId });
    await refetchCurriculum();
  }

  async function removeWeek(weekId: string) {
    await removeCohortWeek(cohortId, weekId);
    await refetchCurriculum();
    await refetch();
  }

  async function removeMember(memberId: string) {
    await removeCohortMember(cohortId, memberId);
    await refetchMembers();
    await refetch();
  }

  if (isLoading) return <LoadingState label="Loading cohort..." />;
  if (isError || !cohort) {
    return (
      <div className="p-6 space-y-4">
        <ErrorState message="Cohort not found." />
        <Button variant="outline" asChild>
          <Link href={`/bootcamps/${bootcampId}/cohorts`}>Back to cohorts</Link>
        </Button>
      </div>
    );
  }

  const headerActions = (
    <Button variant="outline" asChild>
      <Link href={`/bootcamps/${bootcampId}/cohorts`}>Back to cohorts</Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={cohort.name}
        description={`${cohort.startDate} → ${cohort.endDate} · ${cohort.memberCount || members.length} members`}
        actions={headerActions}
      />

      {/* Status badge */}
      <div className="flex gap-2">
        <StatusBadge
          label={cohort.active ? 'Active' : 'Inactive'}
          tone={cohort.active ? 'success' : 'neutral'}
        />
      </div>

      <Tabs defaultValue="Members">
        <TabsList>
          <TabsTrigger value="Members">Members</TabsTrigger>
          <TabsTrigger value="Curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="Assignments">Assignments</TabsTrigger>
        </TabsList>

        {/* Members tab */}
        <TabsContent value="Members">
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_auto]">
                <Input
                  placeholder="Search user email to enrol"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                />
                <Button onClick={handleEnrol}>Enrol member</Button>
              </div>
              {members.length === 0 ? (
                <EmptyState
                  title="No members yet"
                  description="Enrol a member using the form above."
                />
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-md border border-border p-3"
                    >
                      <div>
                        <p className="font-medium text-foreground">{member.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.email} · {member.role}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeMember(member.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Curriculum tab */}
        <TabsContent value="Curriculum">
          <Card>
            <CardHeader>
              <CardTitle>Curriculum</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add week */}
              <div className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_auto]">
                <Input
                  placeholder="New week title"
                  value={newWeekTitle}
                  onChange={(e) => setNewWeekTitle(e.target.value)}
                />
                <Button onClick={handleAddWeek}>Add week</Button>
              </div>

              {/* Add lesson */}
              <div className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_160px_1fr_auto]">
                <Input
                  placeholder="Lesson title"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                />
                <Select value={selectedWeekId} onValueChange={setSelectedWeekId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select week" />
                  </SelectTrigger>
                  <SelectContent>
                    {weeks.map((week) => (
                      <SelectItem key={week.id} value={week.id}>
                        {week.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={lessonType}
                  onValueChange={(v) => setLessonType(v as Lesson['type'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="assignment">Assignment</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAddLesson}>Add lesson</Button>
              </div>

              {weeks.length === 0 ? (
                <EmptyState
                  title="No weeks yet"
                  description="Add the first week using the form above."
                />
              ) : (
                <div className="space-y-4">
                  {weeks.map((week, weekIndex) => (
                    <div key={week.id} className="rounded-md border border-border p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-semibold text-foreground">{week.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {week.lessons.length} lessons
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => moveWeek(week.id, -1)}
                            disabled={weekIndex === 0}
                            aria-label="Move week up"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => moveWeek(week.id, 1)}
                            disabled={weekIndex === weeks.length - 1}
                            aria-label="Move week down"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeWeek(week.id)}
                          >
                            Delete week
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {week.lessons.map((lesson, lessonIndex) => (
                          <div
                            key={lesson.id}
                            className="flex items-center justify-between rounded border border-border p-3"
                          >
                            <div>
                              <p className="font-medium text-foreground">{lesson.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {lesson.type} · {lesson.status}
                              </p>
                            </div>
                            <div className="flex gap-2 flex-wrap justify-end">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => moveLesson(week.id, lesson.id, -1)}
                                disabled={lessonIndex === 0}
                                aria-label="Move lesson up"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => moveLesson(week.id, lesson.id, 1)}
                                disabled={lessonIndex === week.lessons.length - 1}
                                aria-label="Move lesson down"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateAssignmentStatus(week.id, lesson.id, 'reviewed')
                                }
                              >
                                Review
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateAssignmentStatus(week.id, lesson.id, 'approved')
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => removeLesson(week.id, lesson.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments tab */}
        <TabsContent value="Assignments">
          <Card>
            <CardHeader>
              <CardTitle>Assignments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignmentRows.length === 0 ? (
                <EmptyState
                  title="No assignments yet"
                  description="Lessons marked as assignment will appear here."
                />
              ) : (
                assignmentRows.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between rounded-md border border-border p-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignment.weekTitle} · {assignment.status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateAssignmentStatus(
                            weeks.find((week) => week.title === assignment.weekTitle)?.id || '',
                            assignment.id,
                            'reviewed',
                          )
                        }
                      >
                        Reviewed
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateAssignmentStatus(
                            weeks.find((week) => week.title === assignment.weekTitle)?.id || '',
                            assignment.id,
                            'approved',
                          )
                        }
                      >
                        Approved
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}
