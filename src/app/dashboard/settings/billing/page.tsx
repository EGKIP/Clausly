import { redirect } from "next/navigation";

export default function BillingSettingsRedirect() {
  redirect("/dashboard/settings#billing");
}
