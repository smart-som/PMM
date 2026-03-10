import { redirect } from "next/navigation";

export default function HelperSignupPage() {
  redirect("/login?mode=signup&role=helper");
}
