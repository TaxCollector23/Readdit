import { Header } from "@/components/Header";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Sign in - Readdit" };

export default function LoginPage() {
  return (
    <>
      <Header />
      <LoginForm />
    </>
  );
}
