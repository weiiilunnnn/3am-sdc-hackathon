"use client";
import { useParams } from "next/navigation";
import CareerDetails from "@/components/CareerDetails";
import { decodeRoleParam } from "@/lib/future-role-session";

export default function CareerDetailsPage() {
  const { roleId } = useParams<{ roleId: string }>();
  return <CareerDetails key={roleId} id={decodeRoleParam(roleId)} />;
}
