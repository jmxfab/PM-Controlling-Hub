import { redirect } from "next/navigation";

// Startseite zeigt jetzt direkt die Aufgaben.
// Das Controlling-Dashboard ist vorübergehend nicht über "/" erreichbar.
export default function HomePage() {
  redirect("/aufgaben");
}
