import React from "react";
import { cookies } from "next/headers";

import CohortsTable from "@/components/bootcamps/CohortsTable";

type Props = { params: { id: string } };

export default function CohortsPage({ params }: Props) {
  const id = params.id;
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Cohorts</h1>
      <CohortsTable bootcampId={id} />
    </div>
  );
}
