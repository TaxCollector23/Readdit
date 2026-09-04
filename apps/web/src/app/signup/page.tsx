import { Header } from "@/components/Header";
import { SignupForm } from "@/components/SignupForm";

export const metadata = { title: "Create account — Readdit" };

export default function SignupPage() {
  return (
    <>
      <Header />
      <SignupForm />
    </>
  );
}
