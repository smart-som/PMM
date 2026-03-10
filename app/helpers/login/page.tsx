import { redirect } from "next/navigation";

export default function HelperLoginPage() {
  redirect("/login?mode=login&role=helper");
}
