import { redirect } from "next/navigation";

export default function PMLoginPage() {
  redirect("/login?mode=login&role=pm");
}
