import { redirect } from "next/navigation";

export default function LegacyExplorerPage(): never {
  redirect("/role-matching");
}
