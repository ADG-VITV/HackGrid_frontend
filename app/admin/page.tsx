import type { Metadata } from "next";
import { AdminClient } from "./admin-client";
import { AdminSignIn } from "./admin-sign-in";
import { getAdminSession } from "./session";

export const metadata: Metadata = { title: "Admin | HackGrid", description: "HackGrid organiser controls." };

export default async function AdminPage() {
  const admin = await getAdminSession();
  return admin ? <AdminClient /> : <AdminSignIn />;
}
